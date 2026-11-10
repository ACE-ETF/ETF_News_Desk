import type {Article} from './news';

const issuers: [RegExp,string][] = [
 [/삼성(?:자산)?운용|KODEX/i,'KODEX'], [/미래에셋(?:자산)?운용|TIGER/i,'TIGER'],
 [/한국투자(?:신탁)?운용|한투운용|\bACE\b/i,'ACE'], [/KB(?:자산)?운용|RISE/i,'RISE'],
 [/신한(?:자산)?운용|\bSOL\b/i,'SOL'], [/한화(?:자산)?운용|\bPLUS\b/i,'PLUS'],
 [/NH아문디|HANARO/i,'HANARO'], [/키움(?:투자)?(?:자산)?운용|KIWOOM/i,'KIWOOM'],
];
const compact=(s:string)=>s.normalize('NFKC').replace(/[\s'"‘’“”]/g,'').toUpperCase();
const productPattern=/(KODEX|TIGER|ACE|RISE|SOL|PLUS|HANARO|KIWOOM)([가-힣A-Z0-9&+().·%/-]{1,80}?커버드콜(?:액티브)?(?:\([A-Z]+\))?)/g;
const period=(s:string)=>/하루|일간|당일|일일|전일|어제/.test(s)?'daily':/최근한달|1개월|한달|월간/.test(s)?'month':/연초|올해|올들어/.test(s)?'ytd':'';
type Metric={kind:string;value:number;unit:number;threshold:boolean;period:string;currency:string};
function metrics(text:string):Metric[]{
 const out:Metric[]=[];
 for(const m of text.matchAll(/(\d[\d,]*(?:\.\d+)?)\s*(천)?\s*(조|억)(?:\s*(\d[\d,]*)\s*억)?/g)){
  const before=text.slice(0,m.index),clause=before.split(/[,。!?…]/).at(-1)||'';
  const labels=[...before.matchAll(/개인(?:누적)?(?:순매수|매수|자금)|누적순매수|순매수|자금유입|유입|순자산|운용자산/g)];
  const label=labels.at(-1)?.[0];if(!label)continue;
  const kind=/순자산|운용자산/.test(label)?'aum':'inflow';
  const unit=(m[2]?1000:1)*(m[3]==='조'?1e12:1e8);
  const value=Number(m[1].replace(/,/g,''))*unit+Number((m[4]||'0').replace(/,/g,''))*1e8;
  const tail=text.slice((m.index||0)+m[0].length);
  const currency=/^(?:달러|USD|弗)/.test(tail)?'USD':'KRW';
  out.push({kind,value,unit:m[4]?1e8:unit,threshold:/^(?:원)?(?:을|를)?(?:돌파|넘|상회|초과)/.test(tail),period:period(clause)||period(before),currency});
 }
 return out;
}
// One verified body can connect the exact fund, cumulative personal buying and
// AUM in the same announcement. A generic title joins only one compatible anchor;
// a shared issuer/theme alone is never enough to infer a product or an amount.
export function fundFlowAnnouncementKeys(articles:Article[]):Map<string,string>{
 const records=articles.flatMap(a=>{
  const title=compact(a.title),names=issuers.filter(([r])=>r.test(a.title)).map(([,name])=>name);
  if(names.length!==1||!/ETF|상장지수펀드/i.test(title)||!/커버드콜/.test(title))return [];
  if(/순매도|순유출|자금유출|상장폐지|청산|거래정지|신규상장|출시|보수|수수료|목표|예상|전망|비교|경쟁|도전장|증권톡톡|이모저모/.test(title))return [];
  if(!/순매수|개인.*(?:매수|자금)|순자산|운용자산/.test(title))return [];
  const body=a.summaryKind==='summary'?compact(a.summary||''):'';
  const named=[...title.matchAll(productPattern)].map(m=>m[0]);
  const bodyNames=[...body.matchAll(productPattern)].map(m=>m[0]);
  return [{a,title,issuer:names[0],named:[...new Set(named)],bodyNames:[...new Set(bodyNames)],titleMetrics:metrics(title),bodyMetrics:metrics(body),period:period(title)}];
 });
 const anchors=records.filter(r=>r.bodyNames.length===1&&r.bodyNames[0].startsWith(r.issuer)&&r.bodyMetrics.some(m=>m.kind==='inflow'&&m.period==='ytd'&&m.currency==='KRW'));
 const keys=new Map<string,string>();
 for(const r of records){
  const candidates=anchors.filter(anchor=>{
   if(r.a.date!==anchor.a.date||r.issuer!==anchor.issuer||Math.abs(Date.parse(r.a.published)-Date.parse(anchor.a.published))>18*3600000)return false;
   if(r.period&&r.period!=='ytd')return false;
   const product=anchor.bodyNames[0];
   if(r.named.length&&r.named.some(n=>n!==product))return false;
   const features=['200','150','타겟','위클리','데일리','액티브','미국','나스닥','배당','레버리지','인버스'];
   if(features.some(f=>r.title.includes(f)&&!product.includes(f)))return false;
   // Even an abbreviated brand-prefixed name must agree (e.g. 200타겟위클리).
   const partial=r.title.match(new RegExp(r.issuer+'([가-힣A-Z0-9%]+?)(?:,|ETF|중|$)'))?.[1];
   if(partial&&partial!=='커버드콜'&&!product.includes(partial))return false;
   return r.titleMetrics.every(m=>m.currency==='KRW'&&(!m.period||m.period==='ytd'||m.kind==='aum')&&anchor.bodyMetrics.some(b=>b.kind===m.kind&&b.currency===m.currency&&(!m.period||m.kind==='aum'||b.period===m.period)&&(b.value===m.value||m.threshold&&b.value>=m.value&&b.value<m.value*1.1)));
  });
  const signatures=[...new Set(candidates.map(a=>{
   const flow=a.bodyMetrics.find(m=>m.kind==='inflow'&&m.period==='ytd')!;
   return ['fund-flow',a.a.date,a.bodyNames[0],'ytd',flow.value].join(':');
  }))];
  if(signatures.length===1)keys.set(r.a.id,signatures[0]);
 }
 return keys;
}
