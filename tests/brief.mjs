import fs from 'node:fs';import ts from 'typescript';import assert from 'node:assert/strict';
const url=s=>'data:text/javascript;base64,'+Buffer.from(ts.transpileModule(s,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText).toString('base64');
const insightURL=url(fs.readFileSync('lib/insights.ts','utf8'));const holidayURL=url(fs.readFileSync('lib/holidays.ts','utf8'));const classifyURL=url(fs.readFileSync('lib/classify.ts','utf8').replaceAll('./holidays',holidayURL));const rankURL=url(fs.readFileSync('lib/ranking.ts','utf8').replaceAll('./classify',classifyURL).replaceAll('./insights',insightURL));const {compareImportance}=await import(rankURL);const distributionURL=url(fs.readFileSync('lib/distribution-events.ts','utf8'));const eventsURL=url(fs.readFileSync('lib/story-events.ts','utf8'));const {briefStories,groupStories}=await import(url(fs.readFileSync('lib/brief.ts','utf8').replaceAll('./insights',insightURL).replaceAll('./ranking',rankURL).replaceAll('./story-events',eventsURL).replaceAll('./distribution-events',distributionURL)));
const make=(i,title,category)=>({a:{id:String(i),title,category,published:'2026-10-29T00:00:00Z',source:'검증',url:'https://example.com/'+i,brands:[],date:'2026-10-29'},others:[]});
const stories=[...Array.from({length:12},(_,i)=>make(i,'ETF 순자산 '+(i+1)+'조원 돌파','수급·성과')),...Array.from({length:5},(_,i)=>make(20+i,'운용사 '+i+' ETF 총보수 인하','상품·전략')),make(30,'ETF 특별배당 지급','배당·분배'),make(31,'ETF 신규 상장','신규 상장'),make(32,'ETF 거래정지 안내','제도·시장'),make(33,'ETF 분배금 지급 안내','배당·분배'),make(34,'ETF 경품 이벤트','마케팅')].sort((a,b)=>compareImportance(a.a,b.a));
const selected=briefStories(stories);assert(selected.length<=6);assert(selected.some(s=>s.a.category==='제도·시장'));assert(selected.filter(s=>s.a.category==='수급·성과').length<=3);assert(!selected.some(s=>['33','34'].includes(s.a.id)));assert.equal(stories.length,22);
const grouped=groupStories([make(50,'TIGER 200 ETF, 삼성전자 특별배당 반영','배당·분배').a,make(51,'삼성전자 특별배당 효과…TIGER 200 분배금 확대','배당·분배').a]);assert.equal(grouped.length,1);assert.equal(grouped[0].others.length,1);assert.equal(groupStories(grouped.flatMap(g=>[g.a,...g.others]),false).length,2);
console.log('PASS: brief count limit, category diversity, risk retention, routine/marketing exclusions, original data retained, grouped related articles');

const {isRoutineStory}=await import(eventsURL);
const pair=(a,b)=>groupStories([make(100,a,'수급·성과').a,make(101,b,'수급·성과').a]);
assert.equal(pair('Bitcoin ETF inflows climb to $176M as BTC rebounds','Bitcoin spot ETFs attract $175.99 million as all 12 funds avoid outflows').length,1);
assert.equal(pair('BlackRock launches two active European credit ETFs','BlackRock to expand active ETF range with two euro credit strategies').length,1);
assert.equal(pair('Bitcoin ETF inflows hit $176M','Bitcoin ETF outflows hit $176M').length,2);
assert.equal(pair('Bitcoin ETF inflows hit $176M','Bitcoin ETF inflows hit $286M').length,2);
assert.equal(pair('Bitcoin ETF inflows hit $176M','Ethereum ETF inflows hit $176M').length,2);
assert.equal(pair('IBIT ETF inflows hit $176M','FBTC ETF inflows hit $176M').length,2);
assert.equal(pair('Bitcoin ETF October outflows shrink to $26M','Bitcoin ETF daily outflows shrink to $26M').length,2);
assert.equal(pair('Bitcoin ETF inflows on Oct 27 hit $176M','Bitcoin ETF inflows on Oct 28 hit $176M').length,2);
const d1=make(102,'Daily ETF Flows: Junk Bond ETF Inflows','수급·성과').a,d2={...d1,id:'103',url:'https://example.com/103',date:'2026-10-28',published:'2026-10-28T00:00:00Z'};assert.equal(groupStories([d1,d2]).length,2);
assert(isRoutineStory({title:'Vanguard S&P 500 ETF (VOO) Stock Price, News, Quote & History'}));
assert(isRoutineStory({title:'iShares MSCI Japan ETF Options Chain'}));
assert(!isRoutineStory({title:'Vanguard launches a bond ETF with lower fees'}));
console.log('PASS: same-event compression, rounded flow amount, issuer/fund/asset/date/direction/period separation, routine exclusion');

assert.equal(pair('삼성운용, KODEX 미국S&P500·나스닥100 ETF 분배금 지급','삼성자산운용, 미국 대표지수 ETF 2종 분배금 지급').length,1);
assert.equal(pair('KODEX 미국S&P500 ETF 분배금 지급','KODEX 미국나스닥100 ETF 분배금 지급').length,2);
assert.equal(pair('한화운용, 글로벌HBM반도체 ETF 개인 자금 6000억원 유입','PLUS 글로벌HBM반도체, 개인 순매수 1위').length,1);
assert(isRoutineStory({title:"Bitcoin ETF Outflows - Could Top 1000x"}));

assert.equal(pair("미래에셋 '배당커버드콜 ETF' 개인 순매수 2조원 돌파",'미래에셋운용 TIGER 배당커버드콜액티브 ETF, 개인 자금 2.4조원 유입').length,1);
assert.equal(pair("한국투자신탁운용, 'ACE 일라이릴리밸류체인 ETF' 6개월 수익률 1위","한투운용, 'ACE 일라이릴리밸류체인' ETF 헬스케어 패시브 중 수익률 1위").length,1);
assert.equal(pair('ACE 일라이릴리밸류체인 ETF 6개월 수익률 1위','ACE 일라이릴리밸류체인 ETF 3개월 수익률 1위').length,2);
assert.equal(pair('ACE 일라이릴리밸류체인 ETF 6개월 수익률 1위','ACE 일라이릴리밸류체인 ETF 6개월 수익률 2위').length,2);
assert.equal(pair('TIGER 배당커버드콜 ETF 개인 순매수 2조원','TIGER 배당커버드콜 ETF 개인 순매수 3조원').length,2);
assert.equal(pair('금감원, 퇴직연금 ETF 투자한도·위험등급 동시 표기해야','퇴직연금 ETF 투자한도 100%, 원리금 보장 의미 아닙니다').length,1);
console.log('PASS: historical Korean product coverage; period, rank and amount guards');

const announcement=make(201,'삼성운용, KODEX 미국S&P500·나스닥100 ETF 분배금 117원·71원 지급…28일 지급','배당·분배').a;
const repeats=[make(202,'삼성자산운용, KODEX 미국 대표지수 ETF 분배금 지급','배당·분배').a,make(203,'삼성자산운용, KODEX 미국지수 ETF 분배금 지급','배당·분배').a,make(204,'삼성자산운용, KODEX 미국S&P500 ETF 분배금 117원 지급','배당·분배').a];
assert.equal(groupStories([announcement,...repeats]).length,1);
assert.equal(groupStories([...repeats,announcement]).length,1);
assert.equal(groupStories([announcement,make(205,'KODEX 미국S&P500 ETF 분배금 118원 지급','배당·분배').a]).length,2);
assert.equal(groupStories([announcement,make(206,'KODEX 미국S&P500 ETF 11월 분배금 117원 지급','배당·분배').a]).length,2);
assert.equal(groupStories([announcement,make(207,'KODEX 미국S&P500 ETF 분배금 117원 29일 지급','배당·분배').a]).length,2);
assert.equal(groupStories([announcement,make(208,'KODEX 미국S&P500 ETF 분배금 삭감','배당·분배').a]).length,2);
console.log('PASS: combined-announcement anchor, generic index aliases, single-fund excerpt, amount/month/payment-date/risk guards');

const cryptoBrief=briefStories([make(301,'SEC approves new Bitcoin ETF rules','제도·시장'),make(302,'SEC reviews Ethereum ETF rules','제도·시장'),make(303,'Vanguard launches a bond ETF','신규 상장'),make(304,'iShares ETF expense ratio cuts','상품·전략'),make(305,'SPDR launches a gold ETF','신규 상장')]);
assert.equal(cryptoBrief.filter(s=>/Bitcoin|Ethereum/.test(s.a.title)).length,1);
assert(cryptoBrief.some(s=>/bond/.test(s.a.title)));assert(cryptoBrief.some(s=>/gold/.test(s.a.title)));
console.log('PASS: one crypto issue in the core briefing, other asset stories retained');

const {isCryptoStory}=await import(eventsURL);
for(const title of ['Hyperliquid ETF Debuts on Nasdaq','Zcash ETF inflows','Dogecoin ETF launch','IBIT inflows','하이퍼리퀴드 ETF 상장'])assert(isCryptoStory({title}),title);
assert(!isCryptoStory({title:'SOL AI반도체 ETF'}));

const {insightKind}=await import(insightURL);
const ideas=['프런티어AI, 앤트로픽(Anthropic) 담은 ETF','글로벌 운용자산 380조 원… 세계 ETF 시장서 11위 올라','반도체 주춤하자 K뷰티 날았다…화장품 ETF 한달 새 40%↑','IT株 54곳 산업재로 이동…삼성SDI·LG전자 ETF 3200억 매물 쏟아질듯'];
const rankingModule=await import(rankURL);
for(const title of ideas){assert(insightKind({title}));assert(importanceForTest(title)>=35)}
function importanceForTest(title){return rankingModule.importance({title,category:'상품·전략'}).score}

const insightBrief=briefStories([...stories,...ideas.map((t,i)=>make(400+i,t,'상품·전략'))].sort((a,b)=>compareImportance(a.a,b.a)));
assert(insightBrief.some(s=>s.a.id==='32'));assert(insightBrief.some(s=>s.a.title===ideas[3]));assert(insightBrief.filter(s=>insightKind(s.a)).length>=2);assert(insightBrief.length<=6);
assert(!insightKind({title:'새로운 액티브 ETF 상품 안내'}));console.log('PASS: idea/industry/index opinion eligibility and briefing slots, high-risk priority');
