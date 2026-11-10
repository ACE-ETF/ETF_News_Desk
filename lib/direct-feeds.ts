import {env} from 'cloudflare:workers';
// Fixed publisher-provided feeds. No arbitrary feed URLs or credentials.
export const DIRECT_FEEDS=[
 {id:'yonhap-market',name:'연합뉴스',url:'https://www.yna.co.kr/rss/market.xml',gl:'KR',hl:'ko',ceid:'KR:ko',articleHosts:['www.yna.co.kr','yna.co.kr'],sourceType:undefined},
 {id:'newsis-finance',name:'뉴시스',url:'https://www.newsis.com/RSS/bank.xml',gl:'KR',hl:'ko',ceid:'KR:ko',articleHosts:['www.newsis.com','newsis.com'],sourceType:undefined},
 {id:'globenewswire-managers',name:'GlobeNewswire',url:'https://www.globenewswire.com/RssFeed/industry/8771-Asset%20Managers%2026%20Custodians/feedTitle/GlobeNewswire%20-%20Industry%20News%20on%20Asset%20Managers%20and%20Custodians',gl:'US',hl:'en-US',ceid:'US:en',articleHosts:['www.globenewswire.com','globenewswire.com'],sourceType:'press_release' as const},
] as const;
export const directFeedsEnabled=()=>(env as unknown as {DIRECT_RSS_ENABLED?:string}).DIRECT_RSS_ENABLED!=='0';
export function directFeed(id?:string){return DIRECT_FEEDS.find(f=>f.id===id)}
export function directQueries(){return DIRECT_FEEDS.map(f=>({q:f.name+' ETF 직접 RSS',provider:'direct-rss' as const,feedId:f.id,feedUrl:f.url,gl:f.gl,hl:f.hl,ceid:f.ceid}))}
export function providerKey(q:{provider?:string;feedId?:string}){return q.provider==='direct-rss'?'direct-rss:'+q.feedId:q.provider||'google-rss'}
