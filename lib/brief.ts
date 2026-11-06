import {isBondAumStory,bondMilestoneKeys} from './bond-milestones';
import {canJoinUnspecifiedFlow} from './overseas-events';
import {sourceDateNote} from './insights';
import {distributionEventKeys} from './distribution-events';
import {canGroupStories,canJoinRecordMilestone,isCryptoStory} from './story-events';
import {importance} from './ranking';
import type {Article} from './news';
export type Story={a:Article;others:Article[];relatedKind?:'coverage'};
function aceAllocationSeminarKey(article: Article): string {
 const title = article.title.normalize('NFKC');
 if (!/한투운용|한국투자신탁운용/.test(title) || !/채권\s*혼합/.test(title) || !/ETF/i.test(title)) return '';
 const named = /한투스테이션/.test(title);
 const seminar = /세미나|라이브/.test(title) && /자산배분|6종/.test(title);
 const verified = article.summaryKind === 'summary' && /세미나/.test(article.summary || '') && /ETF 6종/.test(article.summary || '');
 return named || seminar || verified ? 'ace:bond-mix-allocation-seminar:' + article.date : '';
}

function kiwoomComicKey(article: Article): string {
 const title = article.title.normalize('NFKC');
 if (!/키움(?:투자)?(?:자산)?운용/.test(title) || !/ETF/i.test(title)) return '';
 if (!/인스타툰|웹툰.*인스타그램/.test(title) || !/공개|소개|알린다|소통 강화/.test(title)) return '';
 if (/후속|새 시즌|시즌\s*\d|\d+화|이벤트|공모전/.test(title)) return '';
 return 'kiwoom:etf-instagram-comic:' + article.date;
}

function batteryMilestone(article: Article): string {
 const title = article.title.normalize('NFKC');
 if (!/삼성(?:자산)?운용|KODEX/i.test(title) || !/ETF/i.test(title) || !/순자산/.test(title)) return '';
 if (/레버리지|인버스|비교|전망|목표|\[증권톡톡\]/.test(title)) return '';
 const named = /전고체[\s·]*(?:배터리[\s·]*)?ESS/i.test(title);
 const alias = /배터리|ESS|삼성SDI.{0,8}LG엔솔/.test(title);
 const amount = title.match(/순자산\s*(3,?342|3,?000|3천)\s*억/);
 if (!amount || !(named || alias && /^3,?342$/.test(amount[1]))) return '';
 return 'kodex:battery-ess:3000:3342:' + article.date;
}

function isCoveredBatteryRoundup(story: Story, stories: Story[]): boolean {
 const {a} = story;
 if (!/^\[증권톡톡\].*삼성운용.*배터리TOP2 ETF.*순자산 3000억.*한투운용.*메모리반도체 ETF.*상장/.test(a.title)) return false;
 return stories.some(s => s.a.date === a.date && !!batteryMilestone(s.a))
  && stories.some(s => s.a.date === a.date && /ACE.*메모리반도체.*ETF.*상장/i.test(s.a.title));
}
export function briefStories(stories:Story[],limit=10){
 const eligible=stories.filter(s=>!sourceDateNote(s.a)&&importance(s.a).score>=20&&s.a.category!=='마케팅'&&!isCoveredBatteryRoundup(s,stories));
 const selected:Story[]=[];const counts=new Map<string,number>();
 const add=(story:Story)=>{if(selected.length>=limit||selected.includes(story))return false;if(isCryptoStory(story.a)&&selected.some(s=>isCryptoStory(s.a)))return false;const n=counts.get(story.a.category)||0;if(n>=Math.ceil(limit*0.4)&&importance(story.a).level!=='상')return false;selected.push(story);counts.set(story.a.category,n+1);return true};
 // Use the incoming importance/time order; no reserved slots for an editorial theme.
 for(const story of eligible)add(story);
 return selected;
}
function taxGuideKey(article: Article): string {
 const title = article.title.normalize('NFKC');
 if (!/미래에셋(?:자산)?운용/.test(title) || !/ETF/i.test(title)) return '';
 if (/개정|재발간|후속|이벤트|세미나|라이브|이모저모|앱 업데이트|\d+판/.test(title)) return '';
 const launch = /절세/.test(title) && /가이드(?:\s*북)?[’\x27”"]?\s*(?:발간|발행|출시|공개)/.test(title);
 const accountStrategy = /절세\s*전략\s*제시/.test(title) && /계좌.{0,12}세금\s*달라/.test(title);
 const verified = article.summaryKind === 'summary' && /TIGER ETF 절세 투자 가이드북을 발간/.test(article.summary || '');
 return launch || accountStrategy || verified ? 'mirae:tiger-etf-tax-guide:' + article.date : '';
}
// Match return/distribution excerpts to one named product announcement. A generic
// issuer headline inherits a product only from unambiguous same-day evidence.
export function performanceEventKeys(articles:Article[]):Map<string,string>{
 const issuers:[RegExp,string][]=[[/KB(?:자산)?운용|RISE/i,'RISE'],[/삼성(?:자산)?운용|KODEX/i,'KODEX'],[/미래에셋(?:자산)?운용|TIGER/i,'TIGER'],[/한국투자신탁운용|한투운용|ACE/i,'ACE'],[/신한(?:자산)?운용|SOL/i,'SOL'],[/한화(?:자산)?운용|PLUS/i,'PLUS'],[/키움(?:투자)?(?:자산)?운용|KIWOOM/i,'KIWOOM']];
 const compact=(s:string)=>s.normalize('NFKC').replace(/美/g,'미국').replace(/[\s'"‘’“”]/g,'').toUpperCase();
 const records=articles.map(a=>{
  const title=compact(a.title),text=title+(a.summaryKind==='summary'?compact(a.summary||''):'');
  const issuer=issuers.filter(([r])=>r.test(title)).map(([,v])=>v);
  if(issuer.length!==1||!/ETF/.test(title)||!/수익률|수익|성과|배당투자/.test(text)||/목표|예상|전망|비교|상위.*종|이모저모|증권톡톡/.test(title))return;
  const product=text.match(/(RISE|KODEX|TIGER|ACE|SOL|PLUS|KIWOOM)([가-힣A-Z0-9&+().·%-]+?)ETF/)?.[0]?.replace(/ETF$/,'')||'';
  const match=text.match(/(?:수익률|수익|성과)[^%]{0,18}?(-?\d+(?:\.\d+)?)%/)||title.match(/(-?\d+(?:\.\d+)?)%/);
  const raw=match?.[1]||'',value=match?Number(raw):undefined,precision=raw.includes('.')?raw.split('.')[1].length:0;
  const period=title.match(/(\d+)(개월|년)(?:간)?수익률/)?.[0]||(/연초|올해/.test(title)?'ytd':/상장후|상장이후|출시후/.test(text)?'inception':'');
  const payouts=[...text.matchAll(/(?:분배금|배당금)(?:은|이|이?좌당|1좌당|누적|총|약)*?(\d[\d,]*)원/g)].map(m=>Number(m[1].replace(/,/g,'')));
  return {a,title,issuer:issuer[0],product,value,precision,period,payouts};
 }).filter((x):x is NonNullable<typeof x>=>!!x);
 const keys=new Map<string,string>();
 const compatible=(x:typeof records[number],y:typeof records[number])=>{
  if(x.period&&y.period&&x.period!==y.period)return false;
  const tolerance=Math.pow(10,-Math.min(x.precision,y.precision))/2;
  return (x.value===undefined||y.value===undefined||Math.abs(x.value-y.value)<tolerance+1e-8)&&(!x.payouts.length||!y.payouts.length||x.payouts.some(n=>y.payouts.includes(n)));
 };
 for(const x of records){
  const anchors=records.filter(y=>y.product&&y.value!==undefined&&x.issuer===y.issuer&&x.a.date===y.a.date&&compatible(x,y)&&(!x.product||x.product===y.product));
  const candidates=anchors.filter(y=>{
   if(x.product)return true;
   if(x.value===undefined&&!x.title.includes(y.product.replace(new RegExp('^'+y.issuer),'')))return false;
   const features=['미국','한국','중국','일본','고배당','배당','반도체','채권','S&P500','나스닥100','코스피200','금현물','커버드콜','레버리지','인버스'];
   const present=features.filter(f=>x.title.includes(f));
   return present.length>0&&present.every(f=>y.product.includes(f));
  });
  // Keep the most precise measurement for each product/period, rather than
  // making an integer headline a bridge between conflicting exact returns.
  const strongest=candidates.filter(y=>!candidates.some(z=>z.product===y.product&&z.period===y.period&&z.precision>y.precision));
  const signatures=[...new Set(strongest.map(y=>[y.product,y.period||'unspecified',y.value,y.payouts.join(',')].join(':')))];
  if(signatures.length===1)keys.set(x.a.id,'performance:'+x.a.date+':'+signatures[0]);
 }
 return keys;
}

export function groupStories(articles:Article[],enabled=true):Story[]{
 const batteryAnchors = new Set(articles.filter(a => /전고체배터리ESS\s*TOP2플러스/i.test(a.title)).map(batteryMilestone).filter(Boolean));
 const performanceKeys=performanceEventKeys(articles);
 const distributionKeys=distributionEventKeys(articles);
 const bondKeys=bondMilestoneKeys(articles);
 const storyKey=(a:Article)=>{const t=a.title;
 if(/한화(?:자산)?운용|\bPLUS\b/i.test(t)&&/HBM/i.test(t)&&/순매수|개인.*(?:유입|자금)/.test(t))return 'hanwha:hbm:personal-flow:'+a.date;
 const issuer=/한화(?:자산)?운용/.test(t)?'한화':/키움(?:투자)?(?:자산)?운용|KIWOOM/i.test(t)?'키움':'';const theme=/HBM.*반도체|HBM/i.test(t)?'HBM':/코스닥\s*150.*커버드콜/.test(t)?'코스닥150커버드콜':'';const amount=t.match(/(\d[\d,]*(?:\.\d+)?)\s*(조|억)/);const flow=/순자산/.test(t)?'순자산':/유입|순매수|순유입/.test(t)?'유입':'';if(issuer&&theme&&amount&&flow)return [issuer,theme,flow,amount[1].replace(/,/g,''),amount[2]].join(':');if(!/특별\s*배당|특별\s*분배|분배금|분배/.test(a.title))return '';const fund=a.title.replace(/\s+/g,'').toUpperCase().match(/(ACE|TIGER|KODEX|RISE|SOL|PLUS|HANARO|KIWOOM)(코스피200|코스닥150|200)/)?.[0];return fund?'distribution:'+fund+':'+(a.title.match(/(\d{1,2})월/)?.[1]||a.date.slice(5,7)).padStart(2,'0'):''};
 const taxGuideAnchors = new Set(articles.filter(a => /절세.{0,12}가이드\s*북/.test(a.title) && /발간|출시|공개/.test(a.title)).map(taxGuideKey).filter(Boolean));
 const result:Story[]=[];
 for(const a of articles){
  const found=enabled?result.find(x=>{const pa=performanceKeys.get(a.id),pb=performanceKeys.get(x.a.id);if(pa&&pb)return pa===pb;const seminar=aceAllocationSeminarKey(a);if(seminar&&seminar===aceAllocationSeminarKey(x.a))return true;const comic=kiwoomComicKey(a);if(comic&&comic===kiwoomComicKey(x.a))return true;const battery=batteryMilestone(a);if(battery&&batteryAnchors.has(battery)&&battery===batteryMilestone(x.a))return true;const guide=taxGuideKey(a);if(guide&&taxGuideAnchors.has(guide)&&guide===taxGuideKey(x.a))return true;if(isBondAumStory(a)&&isBondAumStory(x.a)){const ka=bondKeys.get(a.id),kb=bondKeys.get(x.a.id);return !!ka&&ka===kb}const da=distributionKeys.get(a.id),db=distributionKeys.get(x.a.id);if(da&&db)return da===db;const flow=canJoinUnspecifiedFlow(a,x.a,articles);if(flow!==undefined)return flow;const milestone=canJoinRecordMilestone(a,x.a,articles);if(milestone!==undefined)return milestone;const key=storyKey(a);return (key&&key===storyKey(x.a)&&a.date===x.a.date)||canGroupStories(a,x.a)}):undefined;
  if(found){if(![found.a,...found.others].some(b=>b.id===a.id||b.url===a.url)){if(a.summary&&!found.a.summary){found.others.push(found.a);found.a=a}else found.others.push(a)}}else result.push({a,others:[]});
 }
 return result;
}
