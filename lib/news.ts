import type {NaverImportItem} from './naver-import';
import type {DailyBriefing} from './daily-briefing';
import {articleBrands} from './verified-brands';
import {serialFeeds} from './feed-requests';
import {verifiedArticleImage,verifiedArticleMedia} from './verified-images';
import { env } from "cloudflare:workers";
import {category,collectionWindow,calendarDates,isBusinessDay} from "./classify";
export {category,collectionWindow,calendarDates,isBusinessDay} from "./classify";
export type Article={id:string;title:string;url:string;source:string;published:string;date:string;category:string;brands:string[];summary?:string;summaryKind?:'summary'|'title_translation';marketHint?:'overseas';language?:'ko'|'en';imageUrl?:string;imageCaption?:string;imageLabel?:string;summarySource?:string};
const bucket=()=>{const b=(env as unknown as {BUCKET:R2Bucket}).BUCKET;if(!b)throw new Error("뉴스 저장소가 연결되지 않았습니다.");return b};
export const kdate=(t:number)=>new Date(t+9*3600000).toISOString().slice(0,10);
function decode(s:string){return s.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g,"$1").replace(/&amp;/g,"&").replace(/&lt;/g,"<").replace(/&gt;/g,">").replace(/&quot;/g,'"').replace(/&#39;|&apos;/g,"'").replace(/&#(\d+);/g,(_,n)=>String.fromCodePoint(+n))}
const tag=(s:string,n:string)=>decode(s.match(new RegExp("<"+n+"(?: [^>]*)?>([\\s\\S]*?)</"+n+">"))?.[1]||"");
export async function readDay(day:string):Promise<Article[]>{const o=await bucket().get('days/'+day+'.json');return o?await o.json():[]}
export async function getNews(day?:string){const b=bucket();let keys:string[]=[];let cursor:string|undefined;do{const p=await b.list({prefix:'days/',cursor});keys.push(...p.objects.map(o=>o.key.slice(5,-5)));cursor=p.truncated?p.cursor:undefined}while(cursor);const dates=keys.sort().reverse();const summaryObject=await b.get("brief-summaries.json");const summaries:Record<string,{text:string;sourceUrl:string;kind?:'summary'|'title_translation';imageUrl?:string}>=summaryObject?await summaryObject.json():{};const statusObject=await b.get('status.json');const status:any=statusObject?await statusObject.json():null;const latest=collectionWindow();const windowStart=status?.windowStart?Date.parse(status.windowStart):latest.start,windowEnd=status?.windowEnd?Date.parse(status.windowEnd):latest.end;const selected=day?[day]:calendarDates(windowStart,windowEnd);const articles=(await Promise.all([...new Set(selected)].map(readDay))).flat().filter(a=>day||(Date.parse(a.published)>=windowStart&&Date.parse(a.published)<windowEnd)).map(a=>({...a,category:category(a.title),summary:summaries[a.id]?.text,summaryKind:summaries[a.id]?.kind,summarySource:summaries[a.id]?.sourceUrl,imageUrl:verifiedArticleImage(a),imageCaption:verifiedArticleMedia(a)?.caption,imageLabel:verifiedArticleMedia(a)?.label})).map(a=>({...a,brands:articleBrands(a)})).sort((a,b)=>b.published.localeCompare(a.published));const briefingObject=day?null:await b.get('briefings/'+new Date(windowEnd).toISOString()+'.json');const storedBriefing:DailyBriefing|null=briefingObject?await briefingObject.json():null;const briefing=storedBriefing?.windowStart===new Date(windowStart).toISOString()&&storedBriefing?.windowEnd===new Date(windowEnd).toISOString()?storedBriefing:null;return {articles,dates,status,briefing,window:{start:new Date(day?Date.parse(day+'T00:00:00+09:00'):windowStart).toISOString(),end:new Date(day?Date.parse(day+'T00:00:00+09:00')+86400000:windowEnd).toISOString()}}}
async function saveDay(day:string,articles:Article[]){const b=bucket(),key='days/'+day+'.json';for(let i=0;i<5;i++){const old=await b.get(key);const prior:Article[]=old?await old.json():[];const merged=new Map(prior.map(a=>[a.id,a]));articles.forEach(a=>merged.set(a.id,a));const ok=await b.put(key,JSON.stringify([...merged.values()]),{onlyIf:old?{etagMatches:old.etag}:{etagDoesNotMatch:'*'},httpMetadata:{contentType:'application/json'}});if(ok)return}throw new Error('동시 저장 충돌. 다시 수집해 주세요.')}
export function collectionQueries(window:{start:number;end:number}){
 const bases=[
  {q:'ETF',hl:'ko',gl:'KR',ceid:'KR:ko'},
  {q:'상장지수펀드',hl:'ko',gl:'KR',ceid:'KR:ko'},
  {q:'(ACE OR "한국투자신탁운용") ETF',hl:'ko',gl:'KR',ceid:'KR:ko'},
  // Separate asset searches prevent high-volume crypto publishers from filling every RSS page.
  ...[
   'ETF (equity OR sector OR dividend OR launch OR fees OR regulation) (Vanguard OR iShares OR SPDR OR Invesco OR Schwab OR Nasdaq)',
   'ETF (bond OR Treasury OR credit OR "fixed income" OR gold OR commodity)'
  ].map(q=>({q:q+' -bitcoin -ethereum -crypto -cryptocurrency -solana -XRP -dogecoin -blockchain',hl:'en-US',gl:'US',ceid:'US:en'})),
  {q:'ETF (launch OR fees OR regulation OR "active ETF" OR dividend) -bitcoin -ethereum -crypto -cryptocurrency -solana -XRP -blockchain',hl:'en-US',gl:'US',ceid:'US:en'}
 ];
 const period=window.end-window.start===86400000?' when:2d':' after:'+kdate(window.start-86400000)+' before:'+kdate(window.end+86400000);
 // One wide search window also covers weekends/holidays without multiplying requests per day.
 return bases.map(base=>({...base,q:base.q+period}));
}
export async function collect(options:{retryFailed?:boolean}={}){
 const now=Date.now();if(!isBusinessDay(now))return {skipped:true,reason:'주말·한국 공휴일에는 갱신하지 않고 다음 영업일에 합산합니다.'};
 const window=collectionWindow(now),queries=collectionQueries(window);
 const attemptKey='collection-attempts/'+new Date(window.end).toISOString()+'.json';
 const claimed=await bucket().put(attemptKey,JSON.stringify({attemptedAt:new Date(now).toISOString()}),{onlyIf:{etagDoesNotMatch:'*'},httpMetadata:{contentType:'application/json'}});
 if(!claimed){
  if(!options.retryFailed)return {skipped:true,reason:'이번 영업일 수집을 이미 시도했습니다. 제한 방지를 위해 재요청하지 않습니다.'};
  const previousObject=await bucket().get('status.json'),previous:any=previousObject?await previousObject.json():null;
  if(previous?.windowEnd===new Date(window.end).toISOString())return {skipped:true,reason:'이 구간은 이미 저장됐습니다. 추가 수집하지 않습니다.'};
  const attemptObject=await bucket().get(attemptKey),attempt:any=attemptObject?await attemptObject.json():null;
  if(!attempt?.attemptedAt||!Number.isFinite(Date.parse(attempt.attemptedAt))||now-Date.parse(attempt.attemptedAt)<180000)return {skipped:true,reason:'기존 요청 처리 여부를 확인 중입니다. 동시 재시도하지 않습니다.'};
  const retryKey='manual-retry-attempts/'+new Date(window.end).toISOString()+'.json';
  const retryClaim=await bucket().put(retryKey,JSON.stringify({attemptedAt:new Date(now).toISOString(),reason:'authenticated explicit retry after unsuccessful collection'}),{onlyIf:{etagDoesNotMatch:'*'},httpMetadata:{contentType:'application/json'}});
  if(!retryClaim)return {skipped:true,reason:'이 구간의 수동 재시도도 이미 실행했습니다. 추가 요청하지 않습니다.'};
 }
 const results=await serialFeeds(queries,async query=>{
  const u='https://news.google.com/rss/search?'+new URLSearchParams(query);
  const r=await fetch(u,{signal:AbortSignal.timeout(20000)});if(!r.ok){await r.body?.cancel();throw Object.assign(new Error('뉴스 피드 응답 '+r.status),{status:r.status})}
  const xml=await r.text();if(!xml.includes('<rss'))throw new Error('유효하지 않은 뉴스 피드');
  return [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)].flatMap(m=>{
   const x=m[1],source=tag(x,'source'),raw=tag(x,'title'),title=raw.endsWith(' - '+source)?raw.slice(0,-source.length-3):raw;
   const timestamp=Date.parse(tag(x,'pubDate')),url=tag(x,'link');
   if(!Number.isFinite(timestamp)||!(/ETFs?|exchange[ -]traded funds?|상장지수펀드/i.test(title))||timestamp<window.start||timestamp>=window.end||!url.startsWith('https://news.google.com/'))return [];
   const published=new Date(timestamp).toISOString();
   return [{title,source,published,url,date:kdate(timestamp),category:category(title),brands:[...(query.gl==='KR'&&query.q.startsWith('(ACE OR "한국투자신탁운용")')?['ACE']:[]),...['ACE','TIGER','KODEX','RISE','SOL','PLUS','HANARO','KIWOOM','TIMEFOLIO','KoAct','1Q'].filter(b=>new RegExp('\\b'+b+'\\b','i').test(title))],language:query.gl==='US'?'en' as const:'ko' as const,...(query.gl==='US'?{marketHint:'overseas' as const}:{})}];
  });
 });
 const errors=results.flatMap((r,i)=>r.status==='rejected'?[queries[i].q+': '+String(r.reason)]:[]);
 if(errors.length===queries.length)throw new Error('뉴스 수집 실패: '+errors.join('; '));
 const map=new Map<string,Article>();for(const r of results)if(r.status==='fulfilled')for(const a of r.value){
  const hash=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(a.url));
  const id=Array.from(new Uint8Array(hash)).map(x=>x.toString(16).padStart(2,'0')).join('');
  const prior=map.get(id);map.set(id,{...prior,...a,id,brands:[...new Set([...(prior?.brands||[]),...a.brands])],marketHint:prior?.marketHint||a.marketHint});
 }
 const days=new Map<string,Article[]>();for(const a of map.values())days.set(a.date,[...(days.get(a.date)||[]),a]);
 for(const [day,items]of days)await saveDay(day,items);
 const status={windowStart:new Date(window.start).toISOString(),windowEnd:new Date(window.end).toISOString(),schedule:'한국 영업일 07:40 KST',updated:new Date().toISOString(),fetched:map.size,errors,source:'Google 뉴스 RSS · 한국어/영어',overseasFetched:[...map.values()].filter(a=>a.marketHint==='overseas').length};
 await bucket().put('status.json',JSON.stringify(status),{httpMetadata:{contentType:'application/json'}});return status;
}

// Explicitly requested fallback only. No RSS, search, image or AI calls occur here.
export async function importNaverArticles(items:NaverImportItem[],window:{start:number;end:number}){
 const map=new Map<string,Article>();
 for(const item of items){
  const parsed=new URL(item.url),url=parsed.origin+parsed.pathname;
  const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(url));
  const id=Array.from(new Uint8Array(digest)).map(b=>b.toString(16).padStart(2,'0')).join('');
  const a:Article={id,title:item.title.trim(),url,source:item.source.trim(),published:new Date(item.published).toISOString(),date:kdate(Date.parse(item.published)),category:category(item.title),brands:[],language:'ko'};
  a.brands=articleBrands(a);map.set(id,a);
 }
 const days=new Map<string,Article[]>();for(const a of map.values())days.set(a.date,[...(days.get(a.date)||[]),a]);
 for(const [day,articles] of days)await saveDay(day,articles);
 const status={windowStart:new Date(window.start).toISOString(),windowEnd:new Date(window.end).toISOString(),schedule:'한국 영업일 07:40 KST',updated:new Date().toISOString(),fetched:map.size,errors:['Google 뉴스 연결 실패 · 네이버 확인 기사 보완'],source:'네이버 뉴스 · 원문 확인 보완',partial:true,coverageNote:'구글 뉴스 연결 지연으로 네이버에서 확인한 일부 기사만 보완했습니다.'};
 await bucket().put('status.json',JSON.stringify(status),{httpMetadata:{contentType:'application/json'}});
 return {saved:map.size,partial:true,window:{start:status.windowStart,end:status.windowEnd},items:[...map.values()].map(({id,date,title,url})=>({id,date,title,url}))};
}
