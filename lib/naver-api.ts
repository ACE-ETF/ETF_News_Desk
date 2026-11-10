import {env} from 'cloudflare:workers';
type Keys={NAVER_CLIENT_ID?:string;NAVER_CLIENT_SECRET?:string};
export function naverConfigured(){const e=env as unknown as Keys;return !!(e.NAVER_CLIENT_ID?.trim()&&e.NAVER_CLIENT_SECRET?.trim())}
export function naverSearchTerm(q:string){return q.replace(/ when:\d+[hd]$/,'').slice(0,500)}
export async function readNaverNews(q:string){
 const e=env as unknown as Keys;
 if(!naverConfigured())throw new Error('NAVER_NOT_CONFIGURED');
 // Fixed destination and no redirects: credentials never reach article URLs.
 const url=new URL('https://openapi.naver.com/v1/search/news.json');
 url.search=new URLSearchParams({query:naverSearchTerm(q),display:'100',start:'1',sort:'date'}).toString();
 const r=await fetch(url,{headers:{'X-Naver-Client-Id':e.NAVER_CLIENT_ID!,'X-Naver-Client-Secret':e.NAVER_CLIENT_SECRET!},redirect:'manual',signal:AbortSignal.timeout(22000)});
 if(!r.ok)return {ok:false as const,code:r.status};
 const data=await r.json() as {items?:unknown[]};
 if(!Array.isArray(data.items)||data.items.length>100)throw new Error('NAVER_INVALID_RESPONSE');
 return {ok:true as const,items:data.items};
}
const clean=(s:string)=>s.replace(/<[^>]*>/g,'').replace(/&amp;/g,'&').replace(/&quot;/g,'"').replace(/&#39;|&apos;/g,"'").replace(/&lt;/g,'<').replace(/&gt;/g,'>');
export function parseNaverNews(items:unknown[],window:{start:string;end:string}){
 const rejected={invalidDate:0,outsideWindow:0,invalidMetadata:0,unrelatedTitle:0};
 const rows=items.flatMap(raw=>{
  const a=raw as {title?:unknown;originallink?:unknown;link?:unknown;pubDate?:unknown};
  const published=typeof a?.pubDate==='string'?Date.parse(a.pubDate):NaN;
  if(!Number.isFinite(published)){rejected.invalidDate++;return []}
  if(published<Date.parse(window.start)||published>=Date.parse(window.end)){rejected.outsideWindow++;return []}
  const title=typeof a.title==='string'?clean(a.title):'';
  if(!/ETF|exchange[ -]traded funds?|상장지수펀드/i.test(title)){rejected.unrelatedTitle++;return []}
  // Store links only. No publisher page is fetched during metadata collection.
  const urls=[a.originallink,a.link].flatMap(u=>{try{const x=new URL(String(u));return x.protocol==='https:'&&!x.username&&!x.password&&!x.port&&x.hostname.includes('.')?[x]:[]}catch{return []}});
  if(!title||title.length>400||!urls.length){rejected.invalidMetadata++;return []}
  const u=urls[0];
  return [{title,url:u.href,source:u.hostname.replace(/^www\./,''),published:new Date(published).toISOString()}];
 });
 return {rows,rejected,received:items.length,saturated:items.length===100};
}
