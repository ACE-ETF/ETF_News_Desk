import {serialFeeds} from './feed-requests';
import {verifiedArticleImage} from './verified-images';
import { env } from "cloudflare:workers";
import {category,collectionWindow,calendarDates,isBusinessDay} from "./classify";
export {category,collectionWindow,calendarDates,isBusinessDay} from "./classify";
export type Article={id:string;title:string;url:string;source:string;published:string;date:string;category:string;brands:string[];summary?:string;summaryKind?:'summary'|'title_translation';marketHint?:'overseas';language?:'ko'|'en';imageUrl?:string;summarySource?:string};
const bucket=()=>{const b=(env as unknown as {BUCKET:R2Bucket}).BUCKET;if(!b)throw new Error("뉴스 저장소가 연결되지 않았습니다.");return b};
export const kdate=(t:number)=>new Date(t+9*3600000).toISOString().slice(0,10);
function decode(s:string){return s.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g,"$1").replace(/&amp;/g,"&").replace(/&lt;/g,"<").replace(/&gt;/g,">").replace(/&quot;/g,'"').replace(/&#39;|&apos;/g,"'").replace(/&#(\d+);/g,(_,n)=>String.fromCodePoint(+n))}
const tag=(s:string,n:string)=>decode(s.match(new RegExp("<"+n+"(?: [^>]*)?>([\\s\\S]*?)</"+n+">"))?.[1]||"");
export async function readDay(day:string):Promise<Article[]>{const o=await bucket().get('days/'+day+'.json');return o?await o.json():[]}
export async function getNews(day?:string){const b=bucket();let keys:string[]=[];let cursor:string|undefined;do{const p=await b.list({prefix:'days/',cursor});keys.push(...p.objects.map(o=>o.key.slice(5,-5)));cursor=p.truncated?p.cursor:undefined}while(cursor);const dates=keys.sort().reverse();const summaryObject=await b.get("brief-summaries.json");const summaries:Record<string,{text:string;sourceUrl:string;kind?:'summary'|'title_translation';imageUrl?:string}>=summaryObject?await summaryObject.json():{};const statusObject=await b.get('status.json');const status:any=statusObject?await statusObject.json():null;const latest=collectionWindow();const windowStart=status?.windowStart?Date.parse(status.windowStart):latest.start,windowEnd=status?.windowEnd?Date.parse(status.windowEnd):latest.end;const selected=day?[day]:calendarDates(windowStart,windowEnd);const articles=(await Promise.all([...new Set(selected)].map(readDay))).flat().filter(a=>day||(Date.parse(a.published)>=windowStart&&Date.parse(a.published)<windowEnd)).map(a=>({...a,category:category(a.title),summary:summaries[a.id]?.text,summaryKind:summaries[a.id]?.kind,summarySource:summaries[a.id]?.sourceUrl,imageUrl:verifiedArticleImage(a)})).sort((a,b)=>b.published.localeCompare(a.published));return {articles,dates,status,window:{start:new Date(day?Date.parse(day+'T00:00:00+09:00'):windowStart).toISOString(),end:new Date(day?Date.parse(day+'T00:00:00+09:00')+86400000:windowEnd).toISOString()}}}
async function saveDay(day:string,articles:Article[]){const b=bucket(),key='days/'+day+'.json';for(let i=0;i<5;i++){const old=await b.get(key);const prior:Article[]=old?await old.json():[];const merged=new Map(prior.map(a=>[a.id,a]));articles.forEach(a=>merged.set(a.id,a));const ok=await b.put(key,JSON.stringify([...merged.values()]),{onlyIf:old?{etagMatches:old.etag}:{etagDoesNotMatch:'*'},httpMetadata:{contentType:'application/json'}});if(ok)return}throw new Error('동시 저장 충돌. 다시 수집해 주세요.')}
export function collectionQueries(window:{start:number;end:number}){
 const bases=[
  {q:'ETF',hl:'ko',gl:'KR',ceid:'KR:ko'},
  {q:'상장지수펀드',hl:'ko',gl:'KR',ceid:'KR:ko'},
  {q:'(ACE OR TIGER OR KODEX OR RISE OR SOL OR PLUS) ETF',hl:'ko',gl:'KR',ceid:'KR:ko'},
  // Separate asset searches prevent high-volume crypto publishers from filling every RSS page.
  ...[
   'ETF (equity OR sector OR dividend OR launch OR fees OR regulation) (Vanguard OR iShares OR SPDR OR Invesco OR Schwab OR Nasdaq)',
   'ETF (bond OR Treasury OR credit OR "fixed income" OR gold OR commodity)'
  ].map(q=>({q:q+' -bitcoin -ethereum -crypto -cryptocurrency -solana -XRP -dogecoin -blockchain',hl:'en-US',gl:'US',ceid:'US:en'})),
  {q:'ETF (bitcoin OR ethereum OR crypto) (approval OR regulation OR launch OR inflows OR outflows)',hl:'en-US',gl:'US',ceid:'US:en'}
 ];
 const period=window.end-window.start===86400000?' when:2d':' after:'+new Date(window.start-86400000).toISOString().slice(0,10)+' before:'+new Date(window.end+86400000).toISOString().slice(0,10);
 // One wide search window also covers weekends/holidays without multiplying requests per day.
 return bases.map(base=>({...base,q:base.q+period}));
}
export async function collect(){
 const now=Date.now();if(!isBusinessDay(now))return {skipped:true,reason:'주말·한국 공휴일에는 갱신하지 않고 다음 영업일에 합산합니다.'};
 const window=collectionWindow(now),queries=collectionQueries(window);
 const attemptKey='collection-attempts/'+new Date(window.end).toISOString()+'.json';
 const claimed=await bucket().put(attemptKey,JSON.stringify({attemptedAt:new Date(now).toISOString()}),{onlyIf:{etagDoesNotMatch:'*'},httpMetadata:{contentType:'application/json'}});
 if(!claimed)return {skipped:true,reason:'이번 영업일 수집을 이미 시도했습니다. 제한 방지를 위해 재요청하지 않습니다.'};
 const results=await serialFeeds(queries,async query=>{
  const u='https://news.google.com/rss/search?'+new URLSearchParams(query);
  const r=await fetch(u,{signal:AbortSignal.timeout(20000)});if(!r.ok){await r.body?.cancel();throw Object.assign(new Error('뉴스 피드 응답 '+r.status),{status:r.status})}
  const xml=await r.text();if(!xml.includes('<rss'))throw new Error('유효하지 않은 뉴스 피드');
  return [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)].flatMap(m=>{
   const x=m[1],source=tag(x,'source'),raw=tag(x,'title'),title=raw.endsWith(' - '+source)?raw.slice(0,-source.length-3):raw;
   const timestamp=Date.parse(tag(x,'pubDate')),url=tag(x,'link');
   if(!Number.isFinite(timestamp)||!(/ETFs?|exchange[ -]traded funds?|상장지수펀드/i.test(title))||timestamp<window.start||timestamp>=window.end||!url.startsWith('https://news.google.com/'))return [];
   const published=new Date(timestamp).toISOString();
   return [{title,source,published,url,date:kdate(timestamp),category:category(title),brands:['ACE','TIGER','KODEX','RISE','SOL','PLUS','HANARO','KIWOOM','TIMEFOLIO','KoAct','1Q'].filter(b=>new RegExp('\\b'+b+'\\b','i').test(title)),language:query.gl==='US'?'en' as const:'ko' as const,...(query.gl==='US'?{marketHint:'overseas' as const}:{})}];
  });
 });
 const errors=results.flatMap((r,i)=>r.status==='rejected'?[queries[i].q+': '+String(r.reason)]:[]);
 if(errors.length===queries.length)throw new Error('뉴스 수집 실패: '+errors.join('; '));
 const map=new Map<string,Article>();for(const r of results)if(r.status==='fulfilled')for(const a of r.value){
  const hash=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(a.url));
  const id=Array.from(new Uint8Array(hash)).map(x=>x.toString(16).padStart(2,'0')).join('');
  const prior=map.get(id);map.set(id,{...prior,...a,id,marketHint:prior?.marketHint||a.marketHint});
 }
 const days=new Map<string,Article[]>();for(const a of map.values())days.set(a.date,[...(days.get(a.date)||[]),a]);
 for(const [day,items]of days)await saveDay(day,items);
 const status={windowStart:new Date(window.start).toISOString(),windowEnd:new Date(window.end).toISOString(),schedule:'한국 영업일 07:40 KST',updated:new Date().toISOString(),fetched:map.size,errors,source:'Google 뉴스 RSS · 한국어/영어',overseasFetched:[...map.values()].filter(a=>a.marketHint==='overseas').length};
 await bucket().put('status.json',JSON.stringify(status),{httpMetadata:{contentType:'application/json'}});return status;
}
