import type {Story} from './brief';
import type {Article} from './news';
import {cryptoFlowTopic} from './overseas-events';
import {marketScope} from './market';
import {importance} from './ranking';
import {insightKind} from './insights';
export type DisplayStory=Story;
function coverageKey(s:Story){
 const a=s.a,t=a.title;
 // Keep high-impact changes and distinct editorial perspectives visible.
 if(importance(a).level==='상'||insightKind(a)||/상장폐지|거래정지|청산|괴리율|추적오차|liquidat|delist|trading halt|tracking error/i.test(t))return;
 const crypto=cryptoFlowTopic(a);if(crypto)return [marketScope(a),'flow',crypto].join(':');
 const themes:[RegExp,string][]=[
  [/퇴직연금|IRP|pension|retirement/i,'pension'],[/교육세/,'education-tax'],
  [/테슬라|Tesla/i,'tesla'],[/엔비디아|NVIDIA/i,'nvidia'],
  [/S&P\s*500|\b(?:VOO|SPY|SPLG)\b/i,'sp500'],[/나스닥\s*100|Nasdaq\s*100|\bQQQ[M]?\b/i,'nasdaq100'],
  [/코스피\s*200|KOSPI\s*200|(?:TIGER|KODEX|RISE)\s*200\b/i,'kospi200'],[/코스닥\s*150|KOSDAQ\s*150/i,'kosdaq150'],
  [/미국배당다우존스|Dow Jones.*Dividend/i,'us-dividend-dow'],[/반도체|semiconductor|HBM/i,'semiconductor'],
  [/비트코인|bitcoin|\bBTC\b/i,'bitcoin'],[/이더리움|ethereum|\bether\b/i,'ethereum'],[/솔라나|solana/i,'solana'],[/\bXRP\b|리플/i,'xrp'],
  [/gold|금\s*(?:현물|선물|ETF)|KRX금현물/i,'gold'],[/silver|은\s*(?:현물|선물|ETF)/i,'silver'],
  [/미국채|Treasur|미국.*국채/i,'treasury'],[/회사채|credit|corporate bond/i,'credit'],[/채권|bonds?|fixed.income/i,'bond'],
  [/커버드콜|covered.call/i,'covered-call'],[/레버리지|leveraged|인버스/i,'leverage'],
  [/인공지능|\bAI\b/i,'ai'],[/우주|aerospace|space/i,'space'],[/화장품|K뷰티/i,'beauty'],[/머니마켓|money.market|SOFR|KOFR/i,'cash']
 ];
 const theme=themes.find(([p])=>p.test(t))?.[1];
 const issuers:[RegExp,string][]=[[/BlackRock|iShares|블랙록/i,'blackrock'],[/Vanguard|뱅가드/i,'vanguard'],[/VanEck|반에크/i,'vaneck'],[/Franklin|프랭클린/i,'franklin'],[/Schwab|슈왑/i,'schwab'],[/신한은행/,'shinhan-bank'],[/기업은행|IBK/i,'ibk-bank'],[/\bACE\b|한국투자(?:신탁)?운용/i,'ace'],[/\bTIGER\b|미래에셋(?:자산)?운용/i,'tiger'],[/\bKODEX\b|삼성(?:자산)?운용/i,'kodex'],[/신한(?:자산)?운용|\bSOL\s*[가-힣]/i,'sol'],[/한화(?:자산)?운용|\bPLUS\s*[가-힣]/i,'plus'],[/스위스|Swiss|Switzerland|FINMA/i,'swiss']];
 const issuer=issuers.find(([p])=>p.test(t))?.[1];
 // Require a shared subject or issuer; a category by itself never collapses stories.
 if(!theme&&!issuer)return;
 const kind=/이벤트|경품|추첨|프로모션|promotion|campaign/i.test(t)?'marketing':/보수|수수료|fee|expense ratio/i.test(t)?'fees':/분배|배당금|dividend.*(?:pay|distribut)|distribution/i.test(t)?'distribution':/신규\s*상장|출시|launch|debut|first.*ETF/i.test(t)?'launch':/순매수|순매도|순유입|순유출|순자산|시총|유입|유출|inflows?|outflows?|AUM|assets under management/i.test(t)?'flows':/수익률|성과|returns?|performance/i.test(t)?'performance':a.category;
 const fund=t.match(/\b(ACE|TIGER|KODEX|RISE|SOL|PLUS|HANARO|KIWOOM)\s*([^'"“”‘’,;:]+?)\s*ETF\b/i);
 const ticker=t.match(/\(([A-Z]{2,5})\)/)?.[1]||'';
 const identity=kind==='marketing'?'':fund?(fund[1]+fund[2]).replace(/\s+/g,'').toUpperCase():ticker;
 const modifier=/커버드콜|covered.call/i.test(t)?'covered-call':/레버리지|leveraged|인버스/i.test(t)?'leverage':'';
 return [marketScope(a),kind,theme||'issuer',issuer||'',identity,modifier].join(':');
}
function informationScore(a:Article){
 const t=a.title;
 return importance(a).score*100+(a.summaryKind==='summary'?1000:0)+(!/(?:\.\.\.|…|\b(?:inflo|fo|jitte))\s*$/i.test(t)?100:0)+(t.match(/\d[\d,.]*\s*(?:조|억|만|%|million|billion|[MB]\b)/gi)?.length||0)*15+(/연초|올해|일간|주간|월간|\d+일간|\d+개월|daily|weekly|monthly|\d+.day|on\s+Oct/i.test(t)?20:0)+Math.min(t.length,150)/10;
}
// Select one informative representative per comparable coverage area. Remaining
// articles become source links, never another stack of topic/event cards.
export function compressStoryCoverage(stories:Story[]):Story[]{
 const buckets=new Map<string,Story[]>();
 for(const s of stories){const key=coverageKey(s);if(key)buckets.set(key,[...(buckets.get(key)||[]),s])}
 const seen=new Set<string>(),out:Story[]=[];
 for(const s of stories){
  const key=coverageKey(s),items=key?buckets.get(key):undefined;
  if(!key||!items||items.length<2){out.push(s);continue}if(seen.has(key))continue;seen.add(key);
  const all=items.flatMap(e=>[e.a,...e.others]);
  const sorted=[...all].sort((a,b)=>informationScore(b)-informationScore(a)||b.published.localeCompare(a.published)||a.id.localeCompare(b.id));
  const a=sorted[0],unique=new Map(all.map(x=>[x.id,x]));unique.delete(a.id);
  out.push({a,others:[...unique.values()],relatedKind:'coverage'});
 }
 return out;
}
export const compressFlowTopics=compressStoryCoverage;
