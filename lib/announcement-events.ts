import type {Article} from './news';

const issuers:[RegExp,string][]=[[/미래에셋(?:자산)?운용|TIGER/i,'TIGER'],[/KB(?:자산)?운용|RISE/i,'RISE'],[/한국투자(?:신탁)?운용|한투운용|\bACE\b/i,'ACE'],[/삼성(?:자산)?운용|KODEX/i,'KODEX'],[/신한(?:자산)?운용|\bSOL\b/i,'SOL'],[/한화(?:자산)?운용|\bPLUS\s*[가-힣]/i,'PLUS'],[/키움(?:투자)?(?:자산)?운용|KIWOOM/i,'KIWOOM']];
const compact=(s:string)=>s.normalize('NFKC').replace(/美/g,'미국').replace(/[\s'"‘’“”]/g,'').toUpperCase();
const near=(a:Article,b:Article)=>a.date===b.date&&Math.abs(Date.parse(a.published)-Date.parse(b.published))<=18*3600000;
const issuer=(a:Article)=>{const names=issuers.filter(([r])=>r.test(a.title)).map(([,n])=>n);return names.length===1?names[0]:''};
const body=(a:Article)=>a.summaryKind==='summary'?compact(a.summary||''):'';
function productNames(text:string){
 return [...new Set([...text.matchAll(/(RISE|TIGER|KODEX|ACE|SOL|PLUS|KIWOOM)([가-힣A-Z0-9&+().-]+?)(?=ETF|[과와](?:RISE|TIGER|KODEX|ACE|SOL|PLUS|KIWOOM)|를|을|은|는|의|상장|출시|[,·:：]|$)/g)].map(m=>m[1]+m[2]))];
}
function amount(text:string){
 if(!/순자산/.test(text)&&/커버드콜/.test(text)&&!/(?:순매수|순유입|유입|유출)/.test(text.split(/\d+(?:\.\d+)?조/)[0])&&/\d+(?:\.\d+)?조(?:원)?(?:돌파|기록|넘)/.test(text))text=text.replace(/(\d+(?:\.\d+)?조)/,'순자산$1');
 const m=text.match(/순자산(?:총액|합계|합산|총|은|이|는|규모|약)*(\d[\d,]*(?:\.\d+)?)(조|억)(?:원)?(?:\s*(\d[\d,]*)억)?/);
 if(!m)return;
 const unit=m[2]==='조'?1e12:1e8;
 return {value:Number(m[1].replace(/,/g,''))*unit+Number((m[3]||'0').replace(/,/g,''))*1e8,unit:m[3]?1e8:unit};
}
const marketShare=(text:string)=>text.match(/시장(?:점유율)?(\d+(?:\.\d+)?)%/)?.[1];
const compatibleAmount=(x:ReturnType<typeof amount>,y:ReturnType<typeof amount>)=>!x||!y||x.value===y.value||x.unit===1e12&&Number.isInteger(x.value/x.unit)&&y.value>=x.value&&y.value<x.value*1.1;

// Resolve shortened headlines against a verified, same-day announcement. The
// complete article set supplies evidence, independent of sort order or source.
export function announcementEventKeys(articles:Article[]):Map<string,string>{
 const keys=new Map<string,string>();
 const rows=articles.map(a=>({a,issuer:issuer(a),title:compact(a.title),body:body(a)})).filter(r=>r.issuer);
 const assign=(id:string,candidates:string[])=>{const unique=[...new Set(candidates)];if(unique.length===1)keys.set(id,unique[0])};

 // Aggregate covered-call assets are distinct from the assets of one fund.
 const aggregate=rows.filter(r=>/ETF/.test(r.title)&&/커버드콜/.test(r.title)&&(/순자산/.test(r.title)||!!amount(r.title)||!!marketShare(r.title)&&/액티브커버드콜|커버드콜액티브/.test(r.title))&&!/비교|전망|목표|신규상장|출시|청산|순유출/.test(r.title));
 const anchors=aggregate.filter(r=>r.body&&/액티브커버드콜|커버드콜액티브/.test(r.title+r.body)&&/ETF\d+종/.test(r.body+r.title)&&amount(r.body));
 for(const r of aggregate){
  if(/(?:200|150|미국|배당|위클리|데일리|타겟|레버리지|인버스).*커버드콜/.test(r.title))continue;
  const count=r.title.match(/ETF(\d+)종/)?.[1];
  const signatures=anchors.filter(x=>r.issuer===x.issuer&&near(r.a,x.a)&&(!count||count===(x.body+x.title).match(/ETF(\d+)종/)?.[1])&&compatibleAmount(amount(r.title),amount(x.body))&&(!marketShare(r.title)||marketShare(r.title)===marketShare(x.body))).map(x=>['announcement-aum',x.issuer,x.a.date,(x.body+x.title).match(/ETF(\d+)종/)![1],amount(x.body)!.value].join(':'));
  // A non-active generic title needs a matching amount and a verified aggregate.
  if(/액티브/.test(r.title)||count||amount(r.title))assign(r.a.id,signatures);
 }

 // A single-fund headline can be one part of a verified multi-fund launch.
 const launches=rows.filter(r=>/ETF/.test(r.title)&&/출시|신규상장|ETF.{0,12}상장/.test(r.title)&&!/상장폐지|청산|취소|연기|비교|전망/.test(r.title));
 const launchAnchors=launches.filter(r=>r.body&&productNames(r.body).length>=2&&/ETF(?:등)?\d+종/.test(r.title));
 for(const r of launches){
  const names=productNames(r.title),count=r.title.match(/ETF(?:등)?(\d+)종/)?.[1];
  const dates=[...r.title.matchAll(/(?:(\d{1,2})월)?(\d{1,2})일/g)].map(m=>(m[1]||r.a.date.slice(5,7)).padStart(2,'0')+'-'+m[2].padStart(2,'0'));
  assign(r.a.id,launchAnchors.filter(x=>{
   if(r.issuer!==x.issuer||!near(r.a,x.a))return false;
   const anchorCount=x.title.match(/ETF(?:등)?(\d+)종/)![1];
   if(count&&count!==anchorCount)return false;
   if(dates.some(d=>!x.body.includes(d.slice(3).replace(/^0/, '')+'일')||d.slice(0,2)!==x.a.date.slice(5,7)))return false;
   const products=productNames(x.body);
   const features=[/초대형주|시가총액상위10|시총상위10/,/회사채/,/미국/].filter(f=>f.test(r.title));
   if([...r.title.matchAll(/TOP\d+/g)].some(m=>!x.body.includes(m[0])))return false;
   return names.length?names.every(n=>products.includes(n)):!!count&&r.a.id===x.a.id||features.length>0&&features.every(f=>f.test(x.body));
  }).map(x=>['announcement-launch',x.issuer,x.a.date,...productNames(x.body).sort()].join(':')));
 }

 // Rebalancing aliases need the same manager, industry and named portfolio.
 const rebalances=rows.filter(r=>/ETF/.test(r.title)&&/반도체/.test(r.title)&&(/리밸런싱|비중조정/.test(r.title)||/비중|대표주/.test(r.title)&&/확대|축소|교체|→/.test(r.title))&&!/전망|예상|계획|예정|취소|비교/.test(r.title));
 const rebalanceAnchors=rebalances.filter(r=>r.body&&productNames(r.body).length===1&&/삼성전자/.test(r.body)&&/SK하이닉스/.test(r.body));
 const direction=(s:string,name:string)=>{const m=s.match(new RegExp('(?:'+name+')[^,·…]{0,25}?(늘리|늘렸|늘리고|확대|높|줄이|줄였|줄이고|줄여|축소|낮)'));return m?/늘|확대|높/.test(m[1])?'up':'down':''};
 for(const r of rebalances){
  const names=productNames(r.title);
  assign(r.a.id,rebalanceAnchors.filter(x=>{
   if(r.issuer!==x.issuer||!near(r.a,x.a))return false;
   const product=productNames(x.body)[0];
   if(names.some(n=>n!==product&&!product.startsWith(n))||['국내','코리아','메모리','레버리지','인버스'].some(f=>r.title.includes(f)&&!product.includes(f)))return false;
   const top=r.title.match(/TOP(\d+)/)?.[1];if(top&&!product.includes('TOP'+top))return false;
   if(/글로벌/.test(r.title)&&!product.includes('글로벌'))return false;
   return ['삼성전자|삼전','SK하이닉스|SK하닉|하이닉스|하닉'].every(n=>!direction(r.title,n)||!direction(x.title+x.body,n)||direction(r.title,n)===direction(x.title+x.body,n));
  }).map(x=>['announcement-rebalance',x.issuer,x.a.date,productNames(x.body)[0],...x.body.matchAll(/\d+(?:\.\d+)?%/g)].join(':')));
 }
 return keys;
}
