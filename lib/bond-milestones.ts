import type {Article} from './news';
// A quoted fund name is often abbreviated by dropping the issuer, active or hedge
// suffix. Resolve an omission only against one compatible, explicitly named fund
// in the same dated AUM milestone. Conflicting variants never share an anchor.
type Variant={hedge:string;management:string};
type Milestone={family:string;day:string;amount:number;reference:string;variant:Variant;named:boolean;published:number;threshold:boolean;currency:string;confirmedAmounts:number[]};
const issuers:[RegExp,string][]=[[/\bKODEX\b|삼성(?:자산)?운용/i,'KODEX'],[/\bACE\b|한국투자(?:신탁)?운용|한투운용/i,'ACE'],[/\bTIGER\b|미래에셋(?:자산)?운용/i,'TIGER'],[/\bRISE\b|KB자산운용|케이비자산운용/i,'RISE'],[/\bSOL\b|신한(?:자산)?운용/i,'SOL'],[/\bPLUS\b|한화(?:자산)?운용/i,'PLUS'],[/\bHANARO\b|NH아문디/i,'HANARO'],[/\bKIWOOM\b|키움(?:투자)?(?:자산)?운용/i,'KIWOOM']];
export function isBondAumStory(a:Pick<Article,'title'>){const t=a.title.normalize('NFKC');return /ETF|상장지수펀드/i.test(t)&&/순자산|운용자산|\bAUM\b/i.test(t)&&/(미국|美|한국|국내)\s*\d{1,2}\s*년(?:물)?\s*(?:국채|국고채)/.test(t)}
export function bondMilestone(a:Pick<Article,'title'|'date'|'published'> & Partial<Pick<Article,'summary'|'summaryKind'>>):Milestone|undefined{
 const t=a.title.normalize('NFKC');
 if(!/ETF|상장지수펀드/i.test(t)||!/순자산|운용자산|\bAUM\b/i.test(t))return;
 // Derivative, structured and multi-asset funds are not aliases of cash-bond funds.
 if(/목표|예상|전망|가능성|돌파할|달성할|비교|차이|\bvs\b|합산|전체|업계|[2-9]\s*종/i.test(t))return;
 if(/선물|레버리지|인버스|커버드콜|스트립|혼합|만기매칭|합성|TOP\s*\d|[23]\s*배/.test(t))return;
 const names=issuers.filter(([pattern])=>pattern.test(t)).map(([,name])=>name);if(names.length!==1)return;
 const focus=t.match(/(미국|美|한국|국내)\s*(\d{1,2})\s*년(?:물)?\s*(?:국채|국고채)/);if(!focus)return;
 const amount=t.match(/(\d[\d,]*(?:\.\d+)?)\s*(천|만)?\s*(조|억)/);if(!amount)return;
 const value=Number(amount[1].replace(/,/g,''))*(amount[2]==='천'?1000:amount[2]==='만'?10000:1)*(amount[3]==='조'?1e12:1e8);if(!Number.isFinite(value)||value<=0)return;
 const tail=t.slice((amount.index||0)+amount[0].length).trim();
 const currency=/^(?:달러|USD|弗)/i.test(tail)||/\$\s*$/.test(t.slice(0,amount.index))?'USD':/^유로|EUR/i.test(tail)?'EUR':/^위안|CNY/i.test(tail)?'CNY':'KRW';
 const country=/미국|美/.test(focus[1])?'US':'KR';
 const hedge=/\(\s*UH\s*\)|환\s*노출|비헤지|언헤지/i.test(t)?'UH':/\(\s*H\s*\)|환\s*헤지/i.test(t)?'H':'';
 const management=/패시브/i.test(t)?'passive':/액티브|active/i.test(t)?'active':'';
 const reference=(t.match(/(?:20\d{2}[-./년]\s*)?\d{1,2}\s*(?:월|[./-])\s*\d{1,2}\s*일?\s*(?:기준|종가|현재)|\d{1,2}\s*월\s*말|[1-4]\s*분기\s*말/)?.[0]||'').replace(/\s+/g,'');
 const confirmedAmounts:number[]=[];
 if(a.summaryKind==='summary'&&a.summary&&new RegExp('\\b'+names[0]+'\\b','i').test(a.summary)&&a.summary.includes(focus[0].replace(/\s+/g,''))){
  const precise=a.summary.match(/순자산(?:총액|규모)?[^.!?。]{0,16}?(\d[\d,]*(?:\.\d+)?)\s*(천|만)?\s*(조|억)/);
  if(precise){const amount=Number(precise[1].replace(/,/g,''))*(precise[2]==='천'?1000:precise[2]==='만'?10000:1)*(precise[3]==='조'?1e12:1e8);if(amount>=value&&amount<value*1.05)confirmedAmounts.push(Math.round(amount))}
 }
 return {confirmedAmounts,currency,family:[names[0],country,Number(focus[2]),'treasury','aum'].join(':'),day:a.date,amount:Math.round(value),reference,variant:{hedge,management},named:new RegExp('\\b'+names[0]+'\\b','i').test(t),published:Date.parse(a.published),threshold:/돌파|넘어|넘었|상회|초과/.test(t)};
}
const compatible=(a:Variant,b:Variant)=>(!a.hedge||!b.hedge||a.hedge===b.hedge)&&(!a.management||!b.management||a.management===b.management);
const extendsVariant=(a:Variant,b:Variant)=>(!b.hedge||a.hedge===b.hedge)&&(!b.management||a.management===b.management);
export function bondMilestoneKeys(articles:Article[]):Map<string,string>{
 const keys=new Map<string,string>();const candidates=articles.flatMap(a=>{const m=bondMilestone(a);return m?[{a,m}]:[]});
 for(const {a,m} of candidates){
  const nearby=candidates.filter(c=>c.m.family===m.family&&c.m.day===m.day&&(c.m.amount===m.amount||c.m.threshold&&c.m.confirmedAmounts.includes(m.amount)||m.threshold&&m.confirmedAmounts.includes(c.m.amount))&&c.m.currency===m.currency&&Math.abs(c.m.published-m.published)<=18*3600000);
  if(!nearby.some(c=>c.m.threshold&&compatible(c.m.variant,m.variant)))continue;
  const anchors=nearby.filter(c=>c.m.named&&compatible(m.variant,c.m.variant)&&(!m.reference||!c.m.reference||m.reference===c.m.reference));
  // Keep only the most specific compatible variants. A generic title cannot bridge
  // an H/UH or active/passive conflict just because its amount happens to match.
  const maximal=anchors.filter(c=>!anchors.some(d=>extendsVariant(d.m.variant,c.m.variant)&&!extendsVariant(c.m.variant,d.m.variant)));
  const identities=new Set(maximal.map(c=>[c.m.variant.hedge,c.m.variant.management].join(':')));if(identities.size!==1)continue;
  const references=new Set(nearby.filter(c=>compatible(c.m.variant,maximal[0].m.variant)&&c.m.reference).map(c=>c.m.reference));
  if(references.size>1&&!m.reference)continue;
  const reference=m.reference||(references.size===1?[...references][0]:'');
  const thresholds=new Set(nearby.filter(c=>c.m.threshold&&(c.m.amount===m.amount||c.m.confirmedAmounts.includes(m.amount))).map(c=>c.m.amount));if(thresholds.size!==1)continue;
  keys.set(a.id,[m.family,m.day,m.currency,[...thresholds][0],[...identities][0],reference].join(':'));
 }
 return keys;
}
