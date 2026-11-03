import {env} from 'cloudflare:workers';
import {collectionQueries,collectionWindow,calendarDates,isBusinessDay,kdate,category,getNews,readDay,saveDay,type Article} from './news';
import {validNaverItems} from './naver-import';
import {articleBrands} from './verified-brands';
const HOUR=3600000;
const db=()=>(env as unknown as {BUCKET:R2Bucket}).BUCKET;
const jsonOptions={httpMetadata:{contentType:'application/json'}};
const read=async<T>(key:string):Promise<T|null>=>{const o=await db().get(key);return o?o.json<T>():null};
export type Batch={id:string;mode:'stage'|'release';started:string;finished?:string;start:string;end:string;queries:{q:string;hl:string;gl:string;ceid:string}[];results:Record<string,{state:'started'|'success'|'failed';received?:number;accepted?:number;saturated?:boolean;rejected?:FeedRejections;code?:number;reason?:string}>;fallbackCount:number;coverageGap?:boolean};
type FeedRejections = { invalidDate: number; outsideWindow: number; invalidMetadata: number; unrelatedTitle: number };

export function plan(now=Date.now(),mode:'stage'|'release'='stage'){
 const window=collectionWindow(now);const slot=Math.floor(now/(6*HOUR));
 const end=mode==='release'?window.end:now;
 // Twelve-hour overlap absorbs delayed feed indexing; bootstrap/catch-up is bounded to 72 hours.
 const start=end-12*HOUR;
 const bases=collectionQueries({start,end});
 const chosen=mode==='release'?[bases[0],bases[3+slot%3]]:[bases[0],bases[1+slot%2],bases[3+slot%3]];
 const queries = chosen.flatMap(query => {
  const base = query.q.replace(/ when:2d$| after:.*$/, '');
  let terms = [base];
  if (mode === 'stage' && base === '상장지수펀드') {
   terms = [
    base + ' (신규상장 OR 출시 OR 상품 OR 제도 OR 규제)',
    base + ' -신규상장 -출시 -상품 -제도 -규제',
   ];
  }
  if (mode === 'stage' && base.includes('(equity OR sector OR dividend OR launch OR fees OR regulation)')) {
   const topic = '(equity OR sector OR dividend OR launch OR fees OR regulation)';
   terms = [
    base.replace(topic, '(equity OR sector)'),
    base.replace(topic, '(dividend OR launch OR fees OR regulation) -equity -sector'),
   ];
  }
  return terms.map(q => ({
   ...query,
   q: q + (query.gl === 'KR' && base === 'ETF' ? ' -비트코인 -이더리움 -가상자산 -암호화폐' : '') + ' when:1d',
  }));
 });
 return {id:mode==='release'?'release-'+new Date(window.end).toISOString():'stage-'+slot,mode,start:new Date(start).toISOString(),end:new Date(end).toISOString(),queries,publicationWindow:{start:new Date(window.start).toISOString(),end:new Date(window.end).toISOString()},businessDay:isBusinessDay(now),cadence:'매일 01:10·07:10·13:10·19:10 수집 / 한국 영업일 07:40 공개'};
}
export async function startBatch(mode:'stage'|'release'){
 const p=plan(Date.now(),mode);if(mode==='release'&&!p.businessDay)return {skipped:true,reason:'한국 주말·공휴일',...p};
 const key='pipeline/batches/'+p.id+'.json';const prior=await read<Batch>(key);if(prior)return {skipped:true,reason:'이미 시작한 회차입니다. 원문을 재요청하지 않습니다.',batch:prior,...p};
 const latest=await read<{end:string}>('pipeline/latest-success.json');
 const earliest=Math.max(Date.parse(p.end)-72*HOUR,latest?Date.parse(latest.end)-2*HOUR:collectionWindow().start);
 const batch:Batch={id:p.id,mode,started:new Date().toISOString(),start:new Date(Math.min(Date.parse(p.start),earliest)).toISOString(),end:p.end,queries:p.queries,results:{},fallbackCount:0,coverageGap:!!latest&&Date.parse(latest.end)<Date.parse(p.end)-72*HOUR};
 // Search bounds widen only after missed intervals, never by adding requests.
 const hours=Math.ceil((Date.parse(batch.end)-Date.parse(batch.start))/HOUR);
 batch.queries=batch.queries.map(q=>({...q,q:q.q.replace(/ when:1d$/,' when:'+Math.max(6,hours)+'h')}));
 const ok=await db().put(key,JSON.stringify(batch),{...jsonOptions,onlyIf:{etagDoesNotMatch:'*'}});
 return ok?{...p,batch}:{skipped:true,reason:'다른 작업이 이 회차를 시작했습니다.',...p};
}
const decode=(s:string)=>s.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g,'$1').replace(/&amp;/g,'&').replace(/&quot;/g,'"').replace(/&apos;|&#39;/g,"'").replace(/&lt;/g,'<').replace(/&gt;/g,'>');
const tag=(s:string,n:string)=>decode(s.match(new RegExp('<'+n+'(?: [^>]*)?>([\\s\\S]*?)</'+n+'>'))?.[1]||'');
export function parseFeed(xml:string,query:Batch['queries'][number],window:{start:string;end:string}){
 if(xml.length>2000000||!/<rss[\s>]/i.test(xml)||/<!ENTITY/i.test(xml))throw new Error('RSS 형식 오류');
 const received=[...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)];
 const rejected: FeedRejections = { invalidDate: 0, outsideWindow: 0, invalidMetadata: 0, unrelatedTitle: 0 };
 const start = Date.parse(window.start);
 const end = Date.parse(window.end);
 const rows=received.flatMap(m=>{const x=m[1],source=tag(x,'source'),raw=tag(x,'title'),title=raw.endsWith(' - '+source)?raw.slice(0,-source.length-3):raw;const published=Date.parse(tag(x,'pubDate')),url=tag(x,'link');
  if (!Number.isFinite(published)) { rejected.invalidDate++; return []; }
  if (published < start || published >= end) { rejected.outsideWindow++; return []; }
  if (!/^https:\/\/news\.google\.com\/(?:rss\/)?articles\//.test(url) || !title || title.length > 400) {
   rejected.invalidMetadata++;
   return [];
  }
  if (!/\bETFs?\b|exchange[ -]traded funds?|상장지수펀드/i.test(title)) {
   rejected.unrelatedTitle++;
   return [];
  }
  const a={title,url,source,published:new Date(published).toISOString(),date:kdate(published),category:category(title),brands:[] as string[],language:query.gl==='US'?'en' as const:'ko' as const,...(query.gl==='US'?{marketHint:'overseas' as const}:{})};a.brands=articleBrands({...a,id:''});if(query.q.startsWith('(ACE OR'))a.brands=[...new Set([...a.brands,'ACE'])];return [a];
 });return {rows,received:received.length,rejected,saturated:received.length>=100};
}
async function identify(rows:Omit<Article,'id'>[]){return Promise.all(rows.map(async a=>{const hash=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(a.url));return {...a,id:Array.from(new Uint8Array(hash)).map(x=>x.toString(16).padStart(2,'0')).join('')}}))}
async function saveStaged(rows:Article[]){for(const day of new Set(rows.map(a=>a.date)))await saveDay(day,rows.filter(a=>a.date===day),true)}
async function updateBatch(id:string,update:(b:Batch)=>Batch){const key='pipeline/batches/'+id+'.json';for(let n=0;n<5;n++){const o=await db().get(key);if(!o)throw new Error('수집 회차가 없습니다.');const b=update(await o.json<Batch>());if(await db().put(key,JSON.stringify(b),{...jsonOptions,onlyIf:{etagMatches:o.etag}}))return b}throw new Error('동시 저장 충돌')}
export async function reserveQuery(id:string,index:number){
 const b=await read<Batch>('pipeline/batches/'+id+'.json');if(!b||!Number.isInteger(index)||!b.queries[index])throw new Error('회차·질의 오류');
 if(b.finished||b.results[index])return {skipped:true};
 if(Object.values(b.results).some(r=>r.state==='failed'&&[403,429,502,503,0].includes(r.code||0)))return {skipped:true,reason:'이 회차의 Google 요청 중단'};
 const ok=await db().put('pipeline/requests/'+id+'/'+index+'.json',JSON.stringify({at:new Date().toISOString()}),{...jsonOptions,onlyIf:{etagDoesNotMatch:'*'}});if(!ok)return {skipped:true};
 await updateBatch(id,x=>({...x,results:{...x.results,[index]:{state:'started'}}}));return {reserved:true,query:b.queries[index]};
}
export async function receiveFeed(id:string,index:number,xml:string){
 const b=await read<Batch>('pipeline/batches/'+id+'.json');if(!b||b.finished||b.results[index]?.state!=='started')throw new Error('예약되지 않았거나 완료된 질의');
 const p=parseFeed(xml,b.queries[index],b),articles=await identify(p.rows);await saveStaged(articles);
 await updateBatch(id,x=>({...x,results:{...x.results,[index]:{state:'success',received:p.received,accepted:articles.length,saturated:p.saturated,rejected:p.rejected}}}));return {saved:articles.length,received:p.received,saturated:p.saturated,rejected:p.rejected};
}
export async function queryFailed(id:string,index:number,code:number){return updateBatch(id,b=>{if(b.finished||b.results[index]?.state!=='started')throw new Error('예약되지 않은 질의');return {...b,results:{...b.results,[index]:{state:'failed',code,reason:code?'피드 응답 '+code:'연결 실패'}}}})}
export async function fallbackImport(id:string,items:unknown){
 const b=await read<Batch>('pipeline/batches/'+id+'.json');if(!b||b.finished)throw new Error('유효하지 않은 회차');
 if(!validNaverItems(items,{start:Date.parse(b.start),end:Date.parse(b.end)}))throw new Error('보완 기사 URL·정확한 발행 시각 확인 필요');
 const rows=await identify(items.map(a=>({...a,url:new URL(a.url).hostname==='n.news.naver.com'?new URL(a.url).origin+new URL(a.url).pathname:a.url,date:kdate(Date.parse(a.published)),published:new Date(a.published).toISOString(),category:category(a.title),brands:articleBrands({...a,id:'',brands:[]}),language:'ko' as const})));
 await saveStaged(rows);await updateBatch(id,b=>({...b,fallbackCount:b.fallbackCount+rows.length}));return {saved:rows.length};
}
export async function finishBatch(id:string){const b=await updateBatch(id,b=>({...b,finished:b.finished||new Date().toISOString()}));
 const accepted=Object.values(b.results).reduce((n,r)=>n+(r.accepted||0),0)+b.fallbackCount;
 await db().put('staging/status.json',JSON.stringify({updated:b.finished,fetched:accepted,errors:Object.values(b.results).filter(r=>r.state==='failed').map(r=>r.reason),batch:id}),jsonOptions);
 if(accepted&&b.fallbackCount===0&&Object.keys(b.results).length===b.queries.length&&Object.values(b.results).every(r=>r.state==='success')){const previous=await read<{end:string}>('pipeline/latest-success.json');if(!previous||previous.end<b.end)await db().put('pipeline/latest-success.json',JSON.stringify({end:b.end}),jsonOptions)}return {saved:accepted,batch:b};
}
export async function publishStaged(){
 const now=Date.now(),w=collectionWindow(now);if(!isBusinessDay(now)||kdate(w.end)!==kdate(now))return {skipped:true,reason:'공개 시각 이전 또는 한국 휴일'};
 const data=await getNews(undefined,true);if(!data.articles.length){await db().put('pipeline/publication-error.json',JSON.stringify({at:new Date().toISOString(),window:data.window,reason:'현재 구간 수집 기사 없음 · 기존 공개본 유지'}),jsonOptions);return {published:false,reason:'현재 구간 기사 0건, 이전 공개본 유지'};}
 const old=await getNews();for(const day of new Set(data.articles.map(a=>a.date)))await saveDay(day,data.articles.filter(a=>a.date===day));
 const health=await collectionHealth();const batches=health.batches.filter(b=>Date.parse(b.end)>w.start&&Date.parse(b.start)<w.end);
 const problems=!batches.length||batches.some(b=>Object.values(b.results).some(r=>r.state!=='success'));
 const status={windowStart:data.window.start,windowEnd:data.window.end,schedule:'6시간 분산 수집 · 한국 영업일 07:40 공개',updated:new Date().toISOString(),fetched:data.articles.length,overseasFetched:data.articles.filter(a=>a.marketHint==='overseas').length,source:'누적 Google 뉴스 RSS · 필요 시 네이버 보완',partial:problems,errors:problems?['일부 피드 실패 또는 미완료']:[],...(problems?{coverageNote:'일부 피드가 지연돼 확보된 기사와 대체 수집 결과를 공개했습니다. 수집 현황에서 확인할 수 있습니다.'}:{})};
 // Public status is the commit point. Staging never changes the public archive or date selector.
 await db().put('status.json',JSON.stringify(status),jsonOptions);await db().delete('pipeline/publication-error.json');return {published:true,added:data.articles.length-old.articles.filter(a=>Date.parse(a.published)>=w.start&&Date.parse(a.published)<w.end).length,articles:data.articles.length,window:data.window};
}
export async function collectionHealth(){const allObjects: R2Object[]=[];let cursor:string|undefined;do{const page=await db().list({prefix:'pipeline/batches/',cursor});allObjects.push(...page.objects);cursor=page.truncated?page.cursor:undefined}while(cursor);const objects={objects:allObjects.sort((a,b)=>b.uploaded.getTime()-a.uploaded.getTime()).slice(0,24)};const batches=(await Promise.all(objects.objects.map(o=>read<Batch>(o.key)))).filter((b):b is Batch=>!!b).sort((a,b)=>b.started.localeCompare(a.started)).slice(0,20);
 const pendingKeys=await db().list({prefix:'staging/days/'});const pending=(await Promise.all(pendingKeys.objects.map(async o=>{const p=await db().get(o.key);return p?await p.json<Article[]>():[]}))).flat();const visible=await read<{windowStart:string;windowEnd:string;updated:string}>('status.json');
 const dayWindow=collectionWindow();return {cadence:'매일 01:10·07:10·13:10·19:10 누적 수집, 영업일 07:40 공개 작업',publicStatus:visible,pending:pending.filter(a=>!visible||Date.parse(a.published)>=Date.parse(visible.windowEnd)).length,publicationError:await read('pipeline/publication-error.json'),batches,window:{start:new Date(dayWindow.start).toISOString(),end:new Date(dayWindow.end).toISOString()},rawArticles:pending.sort((a,b)=>b.published.localeCompare(a.published)).slice(0,80).map(({id,title,url,source,published})=>({id,title,url,source,published})),note:'검색 RSS는 전체 기사 전수조사가 아닙니다. 100건 응답·미완료·실패는 아래 회차에 표시합니다.'};
}
