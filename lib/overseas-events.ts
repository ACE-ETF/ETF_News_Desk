import type {Article} from './news';
function reference(t:string){return t.match(/\b(?:Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?|Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?)\.?\s+\d{1,2}\b/i)?.[0].toLowerCase().replace(/\./g,'')}
function goldAum(t:string){
 if(!/gold\s+ETFs?\b/i.test(t)||!/AUM|manage|assets/i.test(t)||/\b(?:GLD|IAU|SGOL|SPDR|iShares)\b/i.test(t))return;
 const m=t.match(/(?:Rs\.?|INR|₹)\s*([\d.]+)\s*(lakh\s*crore|trillion)/i);if(!m)return;
 const decimals=m[1].split('.')[1]?.length||0;
 return {value:Number(m[1]),resolution:10**-decimals,share:t.match(/(?:account for|hold|control)\s*(\d+)\s*(?:%|pc)/i)?.[1],period:t.match(/(?:as of|at the end of|in)\s+(September|October|November|December)/i)?.[1]?.toLowerCase()};
}
function flow(t:string){
 // Aggregate asset flows; individual issuer/ticker articles retain their own identity.
 const asset=/\b(?:bitcoin|BTC)\b/i.test(t)?'bitcoin':/\b(?:ethereum|ether|ETH)\b/i.test(t)?'ethereum':'';
 if(!asset||!/\bETFs?\b/i.test(t)||/\b(?:price|prediction|trades?|trading volume|AUM|assets under management)\b/i.test(t))return;
 if(/\b(?:bitcoin|BTC)\b/i.test(t)&&/\b(?:ethereum|ether|ETH)\b/i.test(t))return;
 const aggregate=/\b(?:bitcoin|ethereum|ether)\s*(?:spot\s*)?ETFs\b|\bspot\s+(?:bitcoin|ethereum|ether)\s+ETFs\b/i.test(t);
 if(!aggregate&&/\b(?:IBIT|FBTC|GBTC|ETHA|ETHE|BlackRock|Fidelity)\b/i.test(t))return;
 const direct=t.split(/\bled by\b|\bas IBIT leads\b/i)[0];
 const money=direct.match(/\$\s*([\d,.]+)\s*(million|billion|m|b)\b/i);if(!money)return;
 const s=direct.replace(/avoid(?:s|ed)?\s+(?:net\s+)?outflows?/gi,'').replace(/despite.*$/i,'');
 const direction=/outflows?|lose|lost|withdraw/i.test(s)?'out':/inflows?|took in|draw|add|pull|attract/i.test(s)?'in':'';if(!direction)return;
 const value=Number(money[1].replace(/,/g,''))*(/^b/i.test(money[2])?1e9:1e6);
 const number=money[1].replace(/,/g,'');const decimals=number.split('.')[1]?.length||0;
 const period=s.match(/(?:over|in|during)\s*(?:the\s*)?(30|three|3|two|2)\s*[- ]?days?|\b(30)[- ]day\b/i);
 return {asset,direction,value,resolution:10**-decimals*(/^b/i.test(money[2])?1e9:1e6),period:period?(period[1]||period[2]).toLowerCase().replace('three','3').replace('two','2'):/monthly|month|\b(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+(?:inflows?|outflows?)/i.test(s)?'month':/weekly|week/i.test(s)?'week':/year/i.test(s)?'year':'1',date:reference(t)};
}
function rounded(a:{value:number;resolution:number},b:{value:number;resolution:number}){return Math.abs(a.value-b.value)<=Math.max(a.resolution,b.resolution)/2+1e-6}
export function sameOverseasEvent(a:Article,b:Article):boolean|undefined{
 const gap=Math.abs(Date.parse(a.published)-Date.parse(b.published));if(gap>18*3600000)return undefined;
 const x=goldAum(a.title),y=goldAum(b.title);
 if(x&&y){if(x.period&&y.period&&x.period!==y.period||x.share&&y.share&&x.share!==y.share)return false;return rounded(x,y)}
 const f=flow(a.title),g=flow(b.title);if(!f||!g)return undefined;
 if(f.asset!==g.asset||f.direction!==g.direction||f.period!==g.period||f.date&&g.date&&f.date!==g.date)return false;
 return rounded(f,g);
}
