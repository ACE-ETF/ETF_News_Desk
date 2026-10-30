import type {Article} from './news';
function reference(a:Article){
 const t=a.title,m=t.match(/\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?\s+(\d{1,2})\b/i),months=['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'];
 if(m)return String(months.indexOf(m[1].toLowerCase())+1).padStart(2,'0')+'-'+m[2].padStart(2,'0');
 const ko=t.match(/(\d{1,2})월\s*(\d{1,2})일/);if(ko)return ko[1].padStart(2,'0')+'-'+ko[2].padStart(2,'0');
 if(/전날|yesterday/i.test(t))return new Date(Date.parse(a.published)+9*3600000-86400000).toISOString().slice(5,10);
 return t.match(/\b20\d{2}-(\d{2}-\d{2})\b/)?.[1];
}
function goldAum(t:string){
 if(!/gold\s+ETFs?\b/i.test(t)||!/AUM|manage|assets/i.test(t)||/\b(?:GLD|IAU|SGOL|SPDR|iShares)\b/i.test(t))return;
 const m=t.match(/(?:Rs\.?|INR|₹)\s*([\d.]+)\s*(lakh\s*crore|trillion)/i);if(!m)return;
 const decimals=m[1].split('.')[1]?.length||0;
 return {value:Number(m[1]),resolution:10**-decimals,share:t.match(/(?:account for|hold|control)\s*(\d+)\s*(?:%|pc)/i)?.[1],period:t.match(/(?:as of|at the end of|in)\s+(September|October|November|December)/i)?.[1]?.toLowerCase()};
}
function money(t:string){
 const m=t.match(/\$\s*([\d,.]+)\s*(million|billion|m|b)\b/i);
 if(m){const n=m[1].replace(/,/g,''),unit=/^b/i.test(m[2])?1e9:1e6;return {value:Number(n)*unit,resolution:10**-(n.split('.')[1]?.length||0)*unit}}
 const ko=t.match(/([\d,.]+)\s*억\s*(?:([\d,]+)\s*만\s*)?(?:달러|弗)/);
 if(ko){const n=ko[1].replace(/,/g,'');return {value:Number(n)*1e8+Number((ko[2]||'0').replace(/,/g,''))*1e4,resolution:ko[2]?1e4:10**-(n.split('.')[1]?.length||0)*1e8}}
 const small=t.match(/([\d,.]+)\s*만\s*(?:달러|弗)/);if(small){const n=small[1].replace(/,/g,'');return {value:Number(n)*1e4,resolution:10**-(n.split('.')[1]?.length||0)*1e4}}
}
export function cryptoFlowTopic(a:Pick<Article,'title'>){
 const t=a.title;if(!/\bETFs?\b|상장지수펀드/i.test(t)||!/inflows?|outflows?|inflo\b|took in|draw|pull|attract|\badd(?:s|ed)?\b|\blose\b|\blost\b|순유입|순유출|자금.{0,6}(?:유입|유출)/i.test(t)||/launch|debut|approv|regulat|lawsuit|delist|liquidat|expense ratio|출시|상장폐지|규제|승인|청산/i.test(t))return;
 const btc=/\bbitcoin\b|\bBTC\b|비트코인/i.test(t),eth=/\bethereum\b|\bether\b|\bETH\b|이더리움/i.test(t);
 return btc&&eth?'비트코인·이더리움 ETF 수급 비교':btc?'비트코인 ETF 수급':eth?'이더리움 ETF 수급':undefined;
}
function flow(a:Article){
 const t=a.title;
 const btc=/\b(?:bitcoin|BTC)\b|비트코인/i.test(t),eth=/\b(?:ethereum|ether|ETH)\b|이더리움/i.test(t);
 const asset=btc?'bitcoin':eth?'ethereum':'';
 if(!asset||!cryptoFlowTopic(a)||btc&&eth||/\b(?:trading volume|AUM|assets under management)\b/i.test(t))return;
 const aggregate=/\b(?:bitcoin|ethereum|ether)\s*(?:spot\s*)?ETFs\b|\bspot\s+(?:bitcoin|ethereum|ether)\s+ETFs\b|(?:비트코인|이더리움)(?:\([^)]*\))?\s*(?:현물\s*)?ETF/i.test(t);
 if(!aggregate&&/\b(?:IBIT|FBTC|GBTC|ETHA|ETHE|BlackRock|Fidelity)\b/i.test(t))return;
 const direct=t.split(/\bled by\b|\bas IBIT leads\b/i)[0];const amount=money(direct);if(!amount)return;
 const s=direct.replace(/avoid(?:s|ed)?\s+(?:net\s+)?outflows?/gi,'').replace(/despite.*$/i,'');
 const direction=/revers\w*\s+outflows?\s+with|유출.*반전.*유입/i.test(s)?'in':/outflows?|lose|lost|withdraw|순유출|자금\s*유출/i.test(s)?'out':/inflows?|inflo\b|took in|draw|add|pull|attract|순유입|자금\s*유입/i.test(s)?'in':'';if(!direction)return;
 const period=s.match(/(?:over|in|during)\s*(?:the\s*)?(30|three|3|two|2)\s*[- ]?days?|\b(30)[- ]day\b|(?<!\d)(30|3|2)\s*일간|이틀간/i);
 const horizon=period?(period[1]||period[2]||period[3]||'2').toLowerCase().replace('three','3').replace('two','2'):/monthly|month|월간|한\s*달|\b(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+(?:inflows?|outflows?)/i.test(s)?'month':/weekly|week|주간/i.test(s)?'week':/year|연간/i.test(s)?'year':/daily|전날|하루|일간|yesterday/i.test(s)||reference(a)?'1':'unknown';
 return {asset,direction,...amount,period:horizon,date:reference(a)};
}
function rounded(a:{value:number;resolution:number},b:{value:number;resolution:number}){return Math.abs(a.value-b.value)<=Math.max(a.resolution,b.resolution)/2+1e-6}
function compatible(a:ReturnType<typeof flow>,b:ReturnType<typeof flow>){return !!a&&!!b&&a.asset===b.asset&&a.direction===b.direction&&(!a.date||!b.date||a.date===b.date)&&rounded(a,b)}
// Missing periods can inherit a period only when nearby evidence is unambiguous.
export function canJoinUnspecifiedFlow(a:Article,b:Article,articles:Article[]):boolean|undefined{
 const f=flow(a),g=flow(b);if(!f||!g||(f.period==='unknown')===(g.period==='unknown'))return;
 if(!compatible(f,g)||Math.abs(Date.parse(a.published)-Date.parse(b.published))>18*3600000)return false;
 const missing=f.period==='unknown'?a:b,known=f.period==='unknown'?g:f,m=f.period==='unknown'?f:g;
 const periods=new Set(articles.filter(c=>Math.abs(Date.parse(c.published)-Date.parse(missing.published))<=18*3600000).map(flow).filter(c=>c&&c.period!=='unknown'&&compatible(m,c)).map(c=>c!.period));
 return periods.size===1&&periods.has(known.period);
}
export function sameOverseasEvent(a:Article,b:Article):boolean|undefined{
 const gap=Math.abs(Date.parse(a.published)-Date.parse(b.published));if(gap>18*3600000)return undefined;
 const x=goldAum(a.title),y=goldAum(b.title);
 if(x&&y){if(x.period&&y.period&&x.period!==y.period||x.share&&y.share&&x.share!==y.share)return false;return rounded(x,y)}
 const f=flow(a),g=flow(b);if(!f||!g)return undefined;
 return compatible(f,g)&&f.period===g.period;
}
