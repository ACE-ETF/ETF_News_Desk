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
 const mixedKeys=mixedIndexFlowKeys(articles);
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
 const keys=new Map<string,string>([...mixedKeys,...cashFundFlowKeys(articles)]);
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

// One cash-fund release can report monthly personal buying, AUM and ranks.
// Resolve those excerpts to the verified release, preserving metric/period
// conflicts instead of grouping every money-market story by its broad theme.
function cashFundFlowKeys(articles:Article[]):Map<string,string>{
 const names=(s:string)=>[...new Set([...s.matchAll(/(KODEX|TIGER|ACE|RISE|SOL|PLUS|HANARO|KIWOOM)((?:미국|달러)?머니마켓(?:액티브)?(?:\((?:H|UH)\))?)/g)].map(m=>m[0]))];
 const horizon=(s:string,date:string)=>{
  if(/하루|일간|당일|일일|전일|어제/.test(s))return 'daily';
  if(/최근한달|최근1개월|1개월|한달간|월간/.test(s))return 'rolling-month';
  if(/연초|올해|올들어/.test(s))return 'ytd:'+date.slice(0,4);
  const month=s.match(/(\d{1,2})월/)?.[1];
  return month||/이달|이번달|당월/.test(s)?'month:'+(s.match(/(\d{4})년/)?.[1]||date.slice(0,4))+'-'+(month||date.slice(5,7)).padStart(2,'0'):'';
 };
 const measures=(s:string)=>[...s.matchAll(/(\d[\d,]*(?:\.\d+)?)(천)?(조|억)(?:(\d[\d,]*)억)?/g)].flatMap(m=>{
  const before=s.slice(0,m.index),after=s.slice((m.index||0)+m[0].length);
  const label=[...before.matchAll(/순매수|개인(?:누적)?(?:매수|자금)|순유입|유입|순자산|운용자산/g)].at(-1)?.[0]
   ||after.match(/^(?:원)?(?:을|를)?(순매수|순유입|순자산)/)?.[1];
  if(!label)return [];
  const unit=(m[2]?1000:1)*(m[3]==='조'?1e12:1e8);
  const value=Number(m[1].replace(/,/g,''))*unit+Number((m[4]||'0').replace(/,/g,''))*1e8;
  const raw=(m[4]||m[1]).replace(/,/g,''),decimals=raw.split('.')[1]?.length||0;
  const step=Math.pow(10,(raw.replace('.','').match(/0*$/)?.[0].length||0)-decimals)*(m[4]?1e8:unit);
  return [{kind:/순자산|운용자산/.test(label)?'aum':'buy',value,step,
   currency:/^(?:원)?(?:달러|USD|유로|EUR|弗)/.test(after)?'foreign':'KRW',
   threshold:/^(?:원)?(?:을|를)?(?:돌파|넘|상회|초과)/.test(after),coarseAum:/순자산|운용자산/.test(label)&&!m[4]&&m[3]==='조'&&Number.isInteger(Number(m[1].replace(/,/g,'')))}];
 });
 const sameMeasure=(m:ReturnType<typeof measures>[number],b:ReturnType<typeof measures>[number])=>m.kind===b.kind&&m.currency===b.currency
  &&(m.value===b.value||(m.threshold||m.coarseAum)&&m.value<=b.value&&b.value<m.value+m.step);
 const ranks=(s:string)=>[...s.matchAll(/(전체ETF(?:중)?|(?:국내)?파킹형ETF(?:개인순매수)?)(\d+)위/g)].map(m=>[m[1].replace(/국내|중|개인순매수/g,''),Number(m[2])] as const)
  .concat(/파킹형ETF개인순매수선두/.test(s)?[['파킹형ETF',1] as const]:[]);
 const rows=articles.flatMap(a=>{
  const t=compact(a.title).replace(/美/g,'미국'),issuerNames=issuers.filter(([r])=>r.test(a.title)).map(([,name])=>name);
  if(issuerNames.length!==1||!/머니마켓|파킹형/.test(t))return [];
  if(/기관|외국인/.test(t)||/순유입|자금유입/.test(t)&&!/개인/.test(t))return [];
  if(/순매도|순유출|자금유출|상장폐지|청산|거래정지|신규상장|출시|보수|수수료|목표|예상|전망|비교|경쟁|도전장|증권톡톡|이모저모|투자의창|칼럼|오피니언|레버리지|인버스|커버드콜/.test(t))return [];
  if(!/순매수|개인.*(?:매수|자금)|순자산|운용자산|파킹형ETF(?:개인순매수)?(?:1위|선두)/.test(t))return [];
  const body=a.summaryKind==='summary'?compact(a.summary||''):'';
  return [{a,title:t,issuer:issuerNames[0],named:names(t),body,bodyNames:names(body),metrics:measures(t),horizon:horizon(t,a.date)}];
 });
 const anchors=rows.flatMap(r=>{
  const bodyMetrics=measures(r.body),h=horizon(r.body,r.a.date);
  return r.bodyNames.length===1&&r.bodyNames[0].startsWith(r.issuer)&&h&&bodyMetrics.some(m=>m.kind==='buy'&&m.currency==='KRW')
   ?[{...r,product:r.bodyNames[0],bodyMetrics,horizon:h}]:[];
 });
 const matches=(r:typeof rows[number],x:typeof anchors[number])=>{
  if(r.issuer!==x.issuer||r.a.date!==x.a.date||Math.abs(Date.parse(r.a.published)-Date.parse(x.a.published))>18*3600000)return false;
  if(r.horizon&&r.horizon!==x.horizon)return false;
  if(r.named.some(n=>n!==x.product&&n+'액티브'!==x.product))return false;
  if(['미국','달러','환헤지','(H)','(UH)'].some(f=>r.title.includes(f)&&!x.product.includes(f)))return false;
  const unbranded=r.title.match(/((?:미국|달러)?머니마켓(?:액티브)?(?:\((?:H|UH)\))?)/)?.[0];
  if(unbranded&&unbranded!==x.product.replace(new RegExp('^'+x.issuer),'')&&unbranded+'액티브'!==x.product.replace(new RegExp('^'+x.issuer),''))return false;
  const reference=r.title.match(/(\d{1,2})[월/](\d{1,2})일?기준/);
  if(reference&&Number(reference[1])+'-'+Number(reference[2])!==Number(x.a.date.slice(5,7))+'-'+Number(x.a.date.slice(8,10)))return false;
  return r.metrics.every(m=>x.bodyMetrics.some(b=>sameMeasure(m,b)));
 };
 const keys=new Map<string,string>();
 for(const r of rows){
  const candidates=anchors.filter(x=>{
   if(!matches(r,x))return false;
   // Rank-only copies require corroboration from a matching numerical report,
   // rather than inferring that two different ranking universes are equivalent.
   const verifiedRanks=ranks(x.body);
   const rankConflict=(t:string)=>ranks(t).some(([scope,rank])=>verifiedRanks.some(([s,n])=>s===scope&&n!==rank));
   if(rankConflict(r.title))return false;
   const knownRanks=[...verifiedRanks,...rows.filter(p=>p.named.includes(x.product)&&p.metrics.length&&matches(p,x)&&!rankConflict(p.title)).flatMap(p=>ranks(p.title))];
   const titleRanks=ranks(r.title);
   if(titleRanks.some(([scope,rank])=>!knownRanks.some(([s,n])=>scope===s&&rank===n)))return false;
   return r.metrics.length>0||r.named.includes(x.product)&&titleRanks.length>0;
  });
  const signatures=[...new Set(candidates.map(x=>['cash-fund-announcement',x.product,x.a.date,x.horizon,...x.bodyMetrics.map(m=>m.kind+':'+m.value).sort()].join(':')))];
  if(signatures.length===1)keys.set(r.a.id,signatures[0]);
 }
 return keys;
}

// Normalize the aggregate US equity-index/bond pair separately from a single
// S&P500 or Nasdaq fund. Missing periods resolve only to one nearby event.
function mixedIndexFlowKeys(articles:Article[]):Map<string,string>{
 const amount=(s:string)=>{
  const m=s.match(/(\d[\d,]*(?:\.\d+)?)\s*(조|억)(?:\s*(\d[\d,]*)\s*억)?/);
  if(!m)return undefined;
  const tail=s.slice((m.index||0)+m[0].length);
  if(/^\s*(?:달러|USD|유로|위안)/i.test(tail))return undefined;
  return Number(m[1].replace(/,/g,''))*(m[2]==='조'?1e12:1e8)+Number((m[3]||'0').replace(/,/g,''))*1e8;
 };
 const records=articles.flatMap(a=>{
  const title=compact(a.title).replace(/美/g,'미국');
  const names=issuers.filter(([r])=>r.test(a.title)).map(([,name])=>name);
  if(names.length!==1||!/ETF/.test(title)||!/미국/.test(title)||!/(?:채권|미국채)혼합(?:형)?/.test(title)||!/유입/.test(title))return [];
  if(/유출|순매수|개인|순자산|수익률|목표|예상|전망|비교|이모저모|증권톡톡|레버리지|인버스|커버드콜/.test(title))return [];
  const count=title.match(/ETF(?:에)?(\d+)종/)?.[1];
  if(count&&count!=='2')return [];
  if(!count&&!/미국(?:대표)?지수/.test(title))return [];
  if(/S&P|나스닥/.test(title)&&!(/S&P/.test(title)&&/나스닥/.test(title)))return [];
  const value=amount(title);if(value===undefined)return [];
  const horizon=period(title);if(horizon&&horizon!=='ytd')return [];
  const reference=(title.match(/\d{1,2}월\d{1,2}일(?:기준)?/)?.[0]||'');
  const body=a.summaryKind==='summary'?compact(a.summary||''):'';
  const exact=/2종/.test(body)&&/연초|올해/.test(body)&&/유입/.test(body)?amount(body):undefined;
  return [{a,issuer:names[0],value,horizon,reference,exact}];
 });
 const keys=new Map<string,string>();
 for(const r of records){
  const nearby=records.filter(x=>x.issuer===r.issuer&&x.a.date===r.a.date&&Math.abs(Date.parse(x.a.published)-Date.parse(r.a.published))<=18*3600000);
  const exactValues=[...new Set(nearby.filter(x=>x.exact!==undefined&&x.value===r.value).map(x=>x.exact!))];
  if(exactValues.length>1)continue;
  const canonical=exactValues[0]??r.value;
  const candidates=nearby.filter(x=>x.value===r.value||x.value===canonical||x.exact===canonical);
  const periods=new Set(candidates.map(x=>x.horizon).filter(Boolean));
  const references=new Set(candidates.map(x=>x.reference).filter(Boolean));
  if(!r.horizon&&periods.size!==1||!r.reference&&references.size>1)continue;
  keys.set(r.a.id,['mixed-index-flow',r.issuer,r.a.date,r.horizon||[...periods][0],canonical,r.reference||[...references][0]||''].join(':'));
 }
 return keys;
}
