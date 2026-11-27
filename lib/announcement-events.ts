import type {Article} from './news';

const issuers:[RegExp,string][]=[[/미래에셋(?:자산)?운용|미래운용|미래에셋(?=[\s'‘“′,，])|TIGER/i,'TIGER'],[/우리(?:자산)?운용|\bWON\b/i,'WON'],[/KB(?:자산)?운용|RISE/i,'RISE'],[/한국투자(?:신탁)?운용|한투운용|\bACE\b/i,'ACE'],[/삼성(?:자산)?운용|KODEX/i,'KODEX'],[/신한(?:자산)?운용|\bSOL\b/i,'SOL'],[/한화(?:자산)?운용|\bPLUS\s*[가-힣]/i,'PLUS'],[/키움(?:투자)?(?:자산)?운용|KIWOOM/i,'KIWOOM']];
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
 // Match an exact product and payout month even when the issuer/brand is
 // omitted. Conflicting amounts or payment days must never be bridged by a
 // headline that omits those details.
 const payouts=articles.map(a=>{
  const t=compact(a.title);
  if(!/ETF/.test(t)||!/분배|배당/.test(t)||/중단|삭감|축소|정정|연기|취소|비교|전망/.test(t))return;
  const product=t.match(/(?:WON)?(한국부동산TOP3플러스)(?=ETF)/)?.[1];
  if(!product||/레버리지|인버스|커버드콜/.test(t))return;
  const month=(t.match(/(\d{1,2})월/)?.[1]||a.date.slice(5,7)).padStart(2,'0');
  const value=t.match(/(?:분배금|배당금)(?:은|이|좌당|1좌당|약)*(\d[\d,]*)원/)?.[1]?.replace(/,/g,'');
  const payday=t.match(/(\d{1,2})일(?:분배금)?지급/)?.[1];
  return {a,base:['product-payout',product,a.date.slice(0,4),month].join(':'),value,payday};
 }).filter((x):x is NonNullable<typeof x>=>!!x);
 for(const r of payouts){
  const peers=payouts.filter(x=>x.base===r.base&&near(r.a,x.a));
  const values=[...new Set(peers.map(x=>x.value).filter(Boolean))];
  const days=[...new Set(peers.map(x=>x.payday).filter(Boolean))];
  if(values.length<=1&&days.length<=1)keys.set(r.a.id,r.base);
  else keys.set(r.a.id,[r.base,r.value||'?',r.payday||'?'].join(':'));
 }
 // A named LLM launch supplies the identity for shortened same-day release
 // headlines. Commentary, roundups, other funds and cancelled launches stay out.
 const llm=rows.filter(r=>r.issuer==='TIGER'&&/ETF/.test(r.title)
  &&/LLM/.test(r.title+r.body)&&/출시|상장|첫선|신규ETF/.test(r.title)
  &&!/상장폐지|청산|취소|연기|비교|전망|급락|조정|이모저모|인프라|ETF2종/.test(r.title));
 const llmAnchors=llm.filter(r=>/TIGER글로벌LLM액티브/.test(r.title+r.body));
 for(const r of llm){
  assign(r.a.id,llmAnchors.filter(x=>near(r.a,x.a)
   && !/레버리지|인버스|커버드콜|채권/.test(r.title)
   && productNames(r.title).every(n=>n==='TIGER글로벌LLM액티브')
   && [...r.title.matchAll(/(?:(\d{1,2})월)?(\d{1,2})일/g)].every(m=>
     (m[1]||r.a.date.slice(5,7)).padStart(2,'0')===x.a.date.slice(5,7)
     && new RegExp('(?:'+Number(m[2])+'일|/'+Number(m[2])+')').test(x.title+x.body)))
   .map(x=>['product-launch','TIGER글로벌LLM액티브',x.a.date].join(':')));
 }
 // Resolve single-fund launch aliases from a verified named announcement,
 // including quoted names without a brand and descriptive infrastructure titles.
 const editorial=/비교|엇갈|경쟁|이모저모|쏟아|전망|예상|계획|예정|취소|연기|상장폐지|청산|레버리지|인버스|커버드콜|\bVS\b/i;
 const multipleManagers=(s:string)=>[/미래에셋|미래운용|TIGER/i,/삼성|KODEX/i,/KB|RISE/i,/한화|PLUS/i,/한국투자|한투운용|ACE/i,/신한|SOL/i,/키움|KIWOOM/i].filter(f=>f.test(s)).length>1;
 const singleLaunches=rows.filter(r=>/ETF/.test(r.title)&&/신규상장|출시|ETF(?:\d{1,2}일)?상장/.test(r.title)&&!editorial.test(r.title)&&!multipleManagers(r.title)&&!/ETF(?:등)?[2-9]종/.test(r.title));
 const singleAnchors=singleLaunches.flatMap(r=>{
  const names=productNames(r.title);
  return r.body&&names.length===1?[{...r,product:names[0]}]:[];
 });
 const launchDay=(s:string,date:string)=>{const m=s.match(/(?:(\d{1,2})월)?(\d{1,2})일(?:신규)?상장/)||s.match(/(\d{1,2})\/(\d{1,2})상장/);return m?Number(m[1]||date.slice(5,7))+'-'+Number(m[2]):''};
 for(const r of singleLaunches){
  assign(r.a.id,singleAnchors.filter(x=>{
   if(r.issuer!==x.issuer||!near(r.a,x.a))return false;
   const rd=launchDay(r.title,r.a.date),xd=launchDay(x.title+x.body,x.a.date);if(rd&&xd&&rd!==xd)return false;
   const names=productNames(r.title);if(names.length)return names.every(n=>n===x.product);
   const alias=x.product.replace(new RegExp('^'+x.issuer),'');
   // Quoted fund names often omit the brand. An explicitly different name
   // cannot inherit a product from the manager or the broad AI theme alone.
   const quoted=[...r.a.title.matchAll(/['‘“"]([^'’”"]+)['’”"]/g)].map(m=>compact(m[1]).replace(/ETF$/,'').replace(new RegExp('^'+x.issuer),''));
   if(quoted.some(n=>n.length>5&&/액티브|인프라|반도체|채권|TOP\d/.test(n)&&!alias.includes(n)))return false;
   if(r.title.includes(alias))return true;
   const description=r.title.replace(/반도체대신/g,'');
   const features=[/병목/,/에이전트/,/반도체/,/전력/,/냉각/,/광통신/,/데이터센터/,/LLM/,/회사채/,/초대형주/].filter(f=>f.test(description));
   const evidence=x.title+x.body;
   const matches=features.every(f=>f.test(evidence)||f.source==='데이터센터'&&/AI.*인프라/.test(evidence)||f.source==='전력'&&/발전/.test(evidence));
   return features.length>0&&matches
    && (/병목|에이전트|LLM|초대형주|데이터센터.*인프라/.test(r.title)||features.length>=3);
  }).map(x=>['single-launch',x.issuer,x.a.date,x.product,launchDay(x.title+x.body,x.a.date)].join(':')));
 }
 // Constituent additions are their own event. A shortened manager/stock
 // headline joins only one named portfolio and one compatible holding weight.
 const additions=rows.filter(r=>/ETF/.test(r.title)&&/앤트로픽|앤스로픽|엔트로픽|ANTHROPIC/.test(r.title)
  &&/편입|담았다|담았|담은|담는다/.test(r.title)&&!singleLaunches.includes(r)&&!editorial.test(r.title)&&!multipleManagers(r.title)&&!/축소|줄여|매도|편출/.test(r.title));
 const additionAnchors=additions.flatMap(r=>{
  const names=productNames(r.title);return names.length===1?[{...r,product:names[0]}]:[];
 });
 const weights=(s:string)=>[...s.matchAll(/(\d+(?:\.\d+)?)%/g)].map(m=>Number(m[1]));
 for(const r of additions){
  const names=productNames(r.title),ownWeights=weights(r.title);
  const candidates=additionAnchors.filter(x=>{
   if(r.issuer!==x.issuer||!near(r.a,x.a)||names.some(n=>n!==x.product))return false;
   const alias=x.product.replace(new RegExp('^'+x.issuer),'');
   const quoted=[...r.a.title.matchAll(/['‘“"]([^'’”"]+)['’”"]/g)].map(m=>compact(m[1]).replace(/ETF$/,'').replace(new RegExp('^'+x.issuer),''));
   if(quoted.some(n=>/액티브|에이전트|TOP\d/.test(n)&&!alias.includes(n)))return false;
   if(['에이전트','반도체','인프라','채권','배당'].some(f=>r.title.includes(f)&&!alias.includes(f)))return false;
   return true;
  });
  const products=[...new Set(candidates.map(x=>x.product))];if(products.length!==1)continue;
  const product=products[0];
  const values=[...new Set(additions.filter(x=>x.issuer===r.issuer&&near(r.a,x.a)
   &&productNames(x.title).every(n=>n===product)).flatMap(x=>weights(x.title)))];
  // Conflicting percentages remain separate; a missing percentage cannot
  // become a bridge. Exact product aliases still resolve without a weight.
  if(ownWeights.length>1||!ownWeights.length&&values.length>1)continue;
  assign(r.a.id,[['constituent-addition',r.issuer,r.a.date,product,'ANTHROPIC',ownWeights[0]??values[0]??'unspecified'].join(':')]);
 }
 return keys;
}

export function isRoundupTitle(title:string){return /이모저모|금융권|(?:外|외)\s*$|\.{3}시각장애인|소비자\s*포럼/.test(title)}

// Reconcile product aliases and the measurements of a release before headline
// similarity. Product names are learned from this edition, not a ticker list.
export function releaseEventKeys(articles:Article[],claimed:Map<string,string>=new Map()):Map<string,string>{
 const keys=new Map<string,string>();
 const named=(s:string)=>[...new Set([...s.matchAll(/(RISE|TIGER|KODEX|ACE|SOL|PLUS|KIWOOM)(?!ETF)([가-힣A-Z0-9&+().%-]{2,75}?)(?=ETF|[,;:])/g)].map(m=>m[1]+m[2]).filter(n=>!/순매수|개인|특별배당|자금|분배|ETF/.test(n)))];
 const relatedName=(short:string,long:string)=>short===long||long.startsWith(short)&&/^(?:로봇)?(?:산업)?(?:액티브)?$/.test(long.slice(short.length));
 const rows=articles.map(a=>({a,issuer:issuer(a),title:compact(a.title),body:body(a)})).filter(r=>r.issuer);
 const catalog=[...new Set(rows.flatMap(r=>[...named(r.title),...named(r.body)]))]
  .filter(n=>/휴머노이드|커버드콜/.test(n)&&!/^(?:RISE|TIGER|KODEX|ACE|SOL|PLUS|KIWOOM)커버드콜$/.test(n)).sort((a,b)=>b.length-a.length||a.localeCompare(b));
 const products=catalog.filter(n=>!catalog.some(other=>other!==n&&relatedName(n,other)));
 const features=[/코스닥150/,/코스피200|(?:^|KODEX|TIGER|RISE|KIWOOM)200/,/휴머노이드/,/반도체/,/머니마켓/,/커버드콜/,/레버리지/,/인버스/,/미국/,/글로벌/,/중국/,/일본/];
 const identity=(r:typeof rows[number])=>{
  const names=named(r.title);
  const candidates=products.filter(p=>{
   if(!p.startsWith(r.issuer))return false;
   if(names.some(n=>!new RegExp('^'+r.issuer+'커버드콜$').test(n)))return names.every(n=>relatedName(n,p));
   const quoted=[...r.a.title.matchAll(/['‘“"]([^'’”"]+)['’”"]/g)].map(m=>compact(m[1]).replace(/ETF$/,''));
   if(quoted.some(q=>/휴머노이드|커버드콜/.test(q)&&!relatedName(r.issuer+q,p)&&!p.includes(q)))return false;
   const description=r.title.replace(/반도체(?:에서|서)로봇|반도체대신/g,'로봇');
   const present=features.filter(f=>f.test(description));
   // A special semiconductor dividend describes the dividend source, not
   // another fund. It cannot change the named covered-call identity.
   const compatible=present.filter(f=>!(f.source==='반도체'&&/특별배당/.test(r.title)));
   return compatible.length>0&&compatible.every(f=>f.test(p))&&/휴머노이드|커버드콜|코스닥150/.test(r.title);
  });
  return candidates.length===1?candidates[0]:'';
 };
 const period=(s:string,date:string)=>/하루|일간|일일|당일|전일|어제/.test(s)?'daily':/최근한달|최근1개월|1개월|월간/.test(s)?'rolling-month':/연초|올해|올들어|올개인/.test(s)?'ytd':s.match(/(\d{1,2})월/)?.[1]?'month:'+s.match(/(\d{1,2})월/)![1]:/이달|이번달/.test(s)?'month:'+Number(date.slice(5,7)):'';
 const amounts=(s:string)=>[...s.matchAll(/(\d[\d,]*(?:\.\d+)?)(천)?(조|억)(?:(\d[\d,]*)억)?/g)].map(m=>{
  const raw=(m[4]||m[1]).replace(/,/g,''),unit=(m[2]?1000:1)*(m[3]==='조'?1e12:1e8),decimals=raw.split('.')[1]?.length||0;
  return {value:Number(m[1].replace(/,/g,''))*unit+Number((m[4]||'0').replace(/,/g,''))*1e8,
   step:Math.pow(10,(raw.replace('.','').match(/0*$/)?.[0].length||0)-decimals)*(m[4]?1e8:unit),
   currency:/^(?:원)?(?:달러|USD|유로|EUR|弗)/.test(s.slice((m.index||0)+m[0].length))?'foreign':'KRW'};
 });
 const scoped=rows.map(r=>({...r,product:identity(r)})).filter(r=>r.product);
 const claimedProducts=new Set(scoped.filter(r=>claimed.has(r.a.id)).map(r=>r.product));
 const flows=scoped.filter(r=>!claimedProducts.has(r.product)&&/개인|순매수|순매도|순유입|순유출/.test(r.title)&&!/거래대금|기관|외국인|목표|전망|예상|비교/.test(r.title)).map(r=>{
  const text=r.body||r.title;
  const values=amounts(text),value=values[0];
  return {...r,value,horizon:period(r.title,r.a.date)||period(r.body,r.a.date),direction:/순매도|순유출|유출/.test(r.title)?'sell':'buy'};
 }).filter((r):r is typeof r&{value:NonNullable<typeof r.value>}=>!!r.value);
 for(const r of flows){
  const peers=flows.filter(p=>p.product===r.product&&p.a.date===r.a.date&&Math.abs(Date.parse(p.a.published)-Date.parse(r.a.published))<=18*3600000&&p.direction===r.direction&&p.value.currency===r.value.currency&&(!r.horizon||!p.horizon||r.horizon===p.horizon));
  const periods=[...new Set(peers.map(p=>p.horizon).filter(Boolean))];if(!r.horizon&&periods.length>1)continue;
  const verified=peers.filter(p=>p.body);
  const pool=verified.length?verified:peers;
  const step=Math.min(...pool.map(p=>p.value.step));
  const anchors=pool.filter(p=>p.value.step===step&&r.value.value<=p.value.value&&p.value.value<r.value.value+r.value.step);
  const values=[...new Set(anchors.map(p=>p.value.value))];
  if(values.length===1)keys.set(r.a.id,['release-flow',r.product,r.a.date,r.direction,r.value.currency,r.horizon||periods[0]||'unspecified',values[0]].join(':'));
 }
 const payoutDetails=(s:string)=>({
  amount:s.match(/(?:분배금|배당금|좌당|주당)(?:은|이|는|을|를|약)*(\d[\d,]*)원/)?.[1]?.replace(/,/g,'')||s.match(/(?:이달|월)(\d[\d,]*)원분배/)?.[1]?.replace(/,/g,'')||'',
  yield:s.match(/분배율(?:은|이|는|약)*(\d+(?:\.\d+)?)%/)?.[1]||'',
  payday:s.match(/\d{1,2}\/(\d{1,2})지급/)?.[1]||s.match(/(\d{1,2})일(?:분배금)?지급/)?.[1]||'',
  paymonth:s.match(/(\d{1,2})\/\d{1,2}지급/)?.[1]||s.match(/(\d{1,2})월\d{1,2}일(?:분배금)?지급/)?.[1]||'',
  tax:s.match(/(\d+)개월연속(?:분배금)?비과세|(?:상장후)?(\d+)차례/)?.slice(1).find(Boolean)||'',
 });
 const payouts=scoped.filter(r=>/분배|특별배당|배당금|배당.*지급/.test(r.title)&&!/손실|주의보|위험|비교|전망|칼럼|오피니언|제도|법안|개정|금융위|금감원/.test(r.title)).map(r=>{
  const months=[...r.title.matchAll(/(\d{1,2})(?:[·ㆍ‧∙・,~∼-](\d{1,2}))?월(?!\d{1,2}일)/g)].flatMap(m=>[m[1],m[2]].filter(Boolean).map(Number)).sort((a,b)=>a-b);
  const special=/특별배당|특별분배/.test(r.title);
  const action=/중단|미지급/.test(r.title)?'suspend':/삭감|축소/.test(r.title)?'cut':/정정|연기|정책변경/.test(r.title)?'change':'pay';
  const titleDetails=payoutDetails(r.title),bodyDetails=payoutDetails(r.body);
  const details=Object.fromEntries(Object.entries(titleDetails).map(([k,v])=>[k,v||bodyDetails[k as keyof typeof bodyDetails]]));
  return {...r,months,special,action,details};
 });
 for(const r of payouts){
  const peers=payouts.filter(p=>p.product===r.product&&p.a.date===r.a.date&&Math.abs(Date.parse(p.a.published)-Date.parse(r.a.published))<=18*3600000&&p.action===r.action);
  const schedules=[...new Set(peers.filter(p=>p.special&&p.months.length>1).map(p=>p.months.join(',')))];
  const month=r.months.length?r.months.join(','):String(Number(r.a.date.slice(5,7)));
  const schedule=r.special&&schedules.length===1&&(!r.months.length||r.months.every(m=>schedules[0].split(',').includes(String(m))))?schedules[0]:month;
  const eligible=peers.filter(p=>{
   const pm=p.months.length?p.months.join(','):String(Number(p.a.date.slice(5,7)));
   return pm===schedule||r.special&&p.special&&schedules.length===1&&(!p.months.length||p.months.every(m=>schedule.split(',').includes(String(m))));
  });
  const detailKeys=['amount','yield','payday','paymonth','tax'];
  const canonical=detailKeys.map(k=>{const values=[...new Set(eligible.map(p=>p.details[k]).filter(Boolean))];return r.details[k]||(values.length===1?values[0]:'?')});
  keys.set(r.a.id,['release-payout',r.product,r.a.date,r.action,schedule,...canonical].join(':'));
 }
 return keys;
}
