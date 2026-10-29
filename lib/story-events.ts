import {sameOverseasEvent} from './overseas-events';
import {sameStatementEvent} from './statement-events';
import type {Article} from './news';
// Preserve stored articles; suppress quote pages and recurring templates only in the view.
export function isRoutineStory(a:Pick<Article,'title'>){return /earn.{0,20}\$[\d,]+.{0,12}daily|Form\s+FWP\b|(?:Bitcoin|Ethereum|Solana|XRP).{0,15}(?:price|trades?|falls|struggles|reclaims).*ETFs?|CryptoQuant Founder.*(?:bullish|recovery)|could top \d+x|price (?:forecast|prediction)|presale|stock price,?\s*news,?\s*quote\s*(?:&|and)\s*history|options? chain|unsponsored brazilian deposit[ao]ry receipt|latest stock price, analysis|\bForm\s+\d+[A-Z-]*\b|if you invested|how much you would have made|prediction:|should (?:you invest|.{0,70}be on your investing radar)|is .{0,80}a strong ETF right now|what .{0,90}ETF.{0,20}(?:bought|sold):|\bETF\b.{0,30}(?:adds|sells) (?:NVIDIA|Apple|Amazon).{0,35}on Oct|\b\d+ (?:defensive sector )?ETFs? (?:a retiree|to (?:consider|protect)|can buy)|these \d+ ETFs? put it to work/i.test(a.title)}
// Used for briefing diversity only; all original crypto articles remain available.
export function isCryptoStory(a:Pick<Article,'title'>){return /bitcoin|ethereum|\bether\b|solana|\b(?:BTC|ETH|XRP|IBIT|FBTC|GBTC|ETHA|ETHE)\b|hyperliquid|zcash|dogecoin|litecoin|\b(?:HYPE|ZEC|DOGE|LTC)\b|crypto|blockchain|하이퍼리퀴드|지캐시|도지코인|라이트코인|비트코인|이더리움|솔라나|리플|가상자산|암호화폐/i.test(a.title)}
const issuers:[RegExp,string][]=[[/BlackRock|iShares|블랙록/i,'blackrock'],[/Vanguard|뱅가드/i,'vanguard'],[/VanEck|반에크/i,'vaneck'],[/Fidelity|피델리티/i,'fidelity'],[/State Street|SPDR/i,'statestreet'],[/\bACE\b|한국투자/i,'ace'],[/\bTIGER\b|미래에셋/i,'tiger'],[/\bKODEX\b|삼성(?:자산)?운용/i,'kodex'],[/\bKIWOOM\b|키움(?:투자)?(?:자산)?운용/i,'kiwoom'],[/한화(?:자산)?운용|\bPLUS\s*[가-힣]/i,'plus']];
const assets:[RegExp,string][]=[[/bitcoin|비트코인|\bBTC\b/i,'bitcoin'],[/ethereum|ether\b|이더리움|\bETH\b/i,'ethereum'],[/solana|솔라나/i,'solana'],[/hyperliquid|하이퍼리퀴드/i,'hyperliquid'],[/\bXRP\b|리플/i,'xrp'],[/zcash|\bZEC\b/i,'zcash']];
const excluded=new Set('ETF ETFS US USA USD SEC NYSE NASDAQ ARCA CFTC AI AUM IPO ESG BTC ETH SOL XRP ZEC HBM ACE TIGER KODEX RISE PLUS HANARO KIWOOM TIMEFOLIO MSCI FTSE SPDR UCITS'.split(' '));
function tickers(t:string){return [...new Set((t.match(/\b[A-Z]{2,5}\b/g)||[]).filter(x=>!excluded.has(x)))].sort()}
function issuer(t:string){return issuers.filter(([r])=>r.test(t)).map(([,id])=>id).sort().join('+')}
function asset(t:string){return assets.filter(([r])=>r.test(t)).map(([,id])=>id).sort().join('+')}
function period(t:string){const month=t.match(/\b(January|February|March|April|May|June|July|August|September|October|November|December)\b/i)?.[1]?.toLowerCase();if(month)return 'month:'+month;if(/two.day|2.day|이틀|2일간/i.test(t))return '2day';if(/week|주간/i.test(t))return 'week';if(/month|월간/i.test(t))return 'month';if(/year|연간|올해/i.test(t))return 'year';return 'day'}
function referenceDate(t:string){return t.match(/\b20\d{2}-\d{2}-\d{2}\b|\b(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?\s+\d{1,2}(?:\s*[-–]\s*\d{1,2})?/i)?.[0]?.toLowerCase().replace(/\./g,'')||''}
function dollars(t:string){return [...t.matchAll(/\$\s*(\d[\d,]*(?:\.\d+)?)\s*(billion|million|[mb])\b/gi)].map(m=>Number((Number(m[1].replace(/,/g,''))*(/^b/i.test(m[2])?1e9:1e6)).toPrecision(3))).sort((a,b)=>a-b).join('+')}
function fingerprint(a:Article){
 const t=a.title,id=issuer(t),fund=tickers(t).join('+'),theme=asset(t);
 const clean=t.replace(/avoid(?:s|ed)?\s+(?:net\s+)?outflows?/gi,'');
 const direction=clean.match(/inflows?|outflows?|순유입|순유출|자금\s*유입|자금\s*유출|순매수|순매도|attract/gi)?.[0]?.toLowerCase();
 if(direction&&(/ETFs?|상장지수펀드/i.test(t))&&(theme||fund)){
  const direct=/\b(?:Bitcoin|Ethereum|Ether|Solana|Hyperliquid|XRP|Zcash|BTC|ETH)\s*(?:spot\s*)?ETFs?\b/i.test(t);
  const amount=dollars(t);if(amount||direct)return ['flow',fund||theme,id,/out|유출|매도/.test(direction)?'out':'in',period(t),amount].join(':');
 }
 if(/launch|debut|introduc|출시|신규\s*상장|expand.{0,30}(?:ETF|range)/i.test(t)){
  if(fund)return 'launch:'+id+':'+fund;
  if(theme&&id)return 'launch:'+id+':'+theme;
  const descriptors=[[/euro(?:pean)?|유럽/i,'europe'],[/credit|크레딧/i,'credit'],[/active|액티브/i,'active'],[/bond|채권/i,'bond'],[/equity|주식/i,'equity']].filter(([r])=>(r as RegExp).test(t)).map(([,s])=>s);
  const count=t.match(/\b(two|three|four|[2-4])\b/i)?.[1]?.toLowerCase().replace('two','2').replace('three','3').replace('four','4');
  if(id&&count&&descriptors.length>=3)return 'launch:'+id+':'+descriptors.sort().join('+')+':'+count;
 }
 return '';
}
function productEvent(a:Article){
 const t=a.title;const match=t.match(/\b(ACE|TIGER|KODEX|RISE|SOL|PLUS|HANARO|KIWOOM|TIMEFOLIO|KoAct)\s*([^'"“”‘’,;:]+?)(?:\s*ETF\b|['"“”‘’,;:])/i);
 let product=match?(match[1]+match[2]).replace(/\s+/g,'').toUpperCase():'';
 if(/TIGER배당커버드콜(?:액티브)?$/.test(product))product='TIGER배당커버드콜';
 if(!product&&/미래에셋/.test(t)&&/['‘“]배당커버드콜(?:액티브)?\s*ETF/.test(t))product='TIGER배당커버드콜';
 const event=/순매수|개인.*유입/.test(t)?'buy':/순매도|개인.*유출/.test(t)?'sell':/순자산/.test(t)?'aum':/수익률.*\d+위/.test(t)?'return-rank':'';
 const period=t.match(/(\d+)\s*개월/)?.[1]+'month';
 const horizon=period!=='undefinedmonth'?period:/연초|올해/.test(t)?'ytd':t.match(/(\d+)\s*년/)?.[1]?t.match(/(\d+)\s*년/)![1]+'year':'';
 const amount=t.match(/(\d[\d,.]*)\s*(조|억)/);const value=amount?Number(amount[1].replace(/,/g,''))*(amount[2]==='조'?1e12:1e8):0;
 return {product,event,horizon,value,threshold:/돌파|넘어|넘었|넘는/.test(t),rank:t.match(/수익률.*?(\d+)\s*위/)?.[1]||''};
}
function sameProductEvent(a:Article,b:Article){
 const crossDay=a.date!==b.date;
 const x=productEvent(a),y=productEvent(b);
 if(x.product&&y.product&&x.product!==y.product)return false;
 if(!x.product||!y.product||!x.event||x.event!==y.event)return undefined;
 if(crossDay&&(Math.abs(Date.parse(a.published)-Date.parse(b.published))>18*3600000||!x.value||x.value!==y.value||!x.horizon&&!y.horizon))return undefined;
 if(x.horizon&&y.horizon&&x.horizon!==y.horizon||x.rank&&y.rank&&x.rank!==y.rank)return false;
 if(x.value&&y.value&&x.value!==y.value){const ratio=Math.max(x.value,y.value)/Math.min(x.value,y.value);if(!(x.threshold||y.threshold)||ratio>1.25)return false}
 return true;
}
function pensionDisclosure(t:string){return /퇴직연금/.test(t)&&/ETF/.test(t)&&/위험등급|투자한도|100%/.test(t)&&/보장|표시|표기/.test(t)}
export function canGroupStories(a:Article,b:Article){
 const t=a.title,u=b.title,ia=issuer(t),ib=issuer(u),aa=asset(t),ab=asset(u),ta=tickers(t),tb=tickers(u);
 
 const ra=referenceDate(t),rb=referenceDate(u);if(ra&&rb&&ra!==rb)return false;
 const gap=Math.abs(Date.parse(a.published)-Date.parse(b.published));if(gap>36*3600000)return false;
 const overseasMatch=sameOverseasEvent(a,b);if(overseasMatch!==undefined)return overseasMatch;
 if(ia&&ib&&ia!==ib||aa&&ab&&aa!==ab||ta.length&&tb.length&&ta.join('+')!==tb.join('+'))return false;
 const statementMatch=sameStatementEvent(a,b);if(statementMatch!==undefined)return statementMatch;
 const productMatch=sameProductEvent(a,b);if(productMatch!==undefined)return productMatch;
 if(a.date===b.date&&pensionDisclosure(t)&&pensionDisclosure(u))return true;
 if(a.date===b.date&&/SK하이닉스/.test(t)&&/SK하이닉스/.test(u)&&/레버리지.*청산/.test(t)&&/레버리지.*청산/.test(u))return true;
 const ka=fingerprint(a),kb=fingerprint(b);
 if(ka&&kb&&ka===kb){if(!dollars(t)&&!ka.startsWith('launch:')&&a.date!==b.date&&!ra&&!rb)return false;return true}
 // Different event periods, flow amounts/directions and launch identities must stay separate.
 if(ka&&kb&&ka!==kb)return false;
 const norm=(s:string)=>s.replace(/[\s\p{P}\p{S}]/gu,'').toLowerCase();const n=norm(t),m=norm(u);
 if(n===m)return a.date===b.date||!!ra&&ra===rb;
 if(a.date!==b.date||n.length<14||m.length<14)return false;
 const grams=(s:string)=>new Set(Array.from({length:s.length-2},(_,i)=>s.slice(i,i+3)));const x=grams(n),y=grams(m);
 return [...x].filter(g=>y.has(g)).length/Math.max(x.size,y.size)>.83;
}
