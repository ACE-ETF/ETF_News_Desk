import fs from 'node:fs';import ts from 'typescript';import assert from 'node:assert/strict';
const url=s=>'data:text/javascript;base64,'+Buffer.from(ts.transpileModule(s,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText).toString('base64');
const bondMilestonesURL=url(fs.readFileSync('lib/bond-milestones.ts','utf8'));
const insightURL=url(fs.readFileSync('lib/insights.ts','utf8'));const holidayURL=url(fs.readFileSync('lib/holidays.ts','utf8'));const classifyURL=url(fs.readFileSync('lib/classify.ts','utf8').replaceAll('./holidays',holidayURL));const rankURL=url(fs.readFileSync('lib/ranking.ts','utf8').replaceAll('./classify',classifyURL).replaceAll('./insights',insightURL));const {compareImportance}=await import(rankURL);const distributionURL=url(fs.readFileSync('lib/distribution-events.ts','utf8'));const overseasURL=url(fs.readFileSync('lib/overseas-events.ts','utf8'));const statementURL=url(fs.readFileSync('lib/statement-events.ts','utf8'));const eventsURL=url(fs.readFileSync('lib/story-events.ts','utf8').replaceAll('./statement-events',statementURL).replaceAll('./overseas-events',overseasURL));const flowAnnouncementURL=url(fs.readFileSync('lib/fund-flow-announcements.ts','utf8'));
const launchURL=url(fs.readFileSync('lib/launch-events.ts','utf8'));
const announcementURL=url(fs.readFileSync('lib/announcement-events.ts','utf8'));
const briefURL=url(fs.readFileSync('lib/brief.ts','utf8').replaceAll('./announcement-events',announcementURL).replaceAll('./launch-events',launchURL).replaceAll('./fund-flow-announcements',flowAnnouncementURL).replaceAll('./bond-milestones',bondMilestonesURL).replaceAll('./insights',insightURL).replaceAll('./ranking',rankURL).replaceAll('./overseas-events',overseasURL).replaceAll('./story-events',eventsURL).replaceAll('./distribution-events',distributionURL));const {briefStories,groupStories}=await import(briefURL);
const make=(i,title,category)=>({a:{id:String(i),title,category,published:'2026-10-29T00:00:00Z',source:'검증',url:'https://example.com/'+i,brands:[],date:'2026-10-29'},others:[]});
const stories=[...Array.from({length:12},(_,i)=>make(i,'ETF 순자산 '+(i+1)+'조원 돌파','수급·성과')),...Array.from({length:5},(_,i)=>make(20+i,'운용사 '+i+' ETF 총보수 인하','상품·전략')),make(30,'ETF 특별배당 지급','배당·분배'),make(31,'ETF 신규 상장','신규 상장'),make(32,'ETF 거래정지 안내','제도·시장'),make(33,'ETF 분배금 지급 안내','배당·분배'),make(34,'ETF 경품 이벤트','마케팅')].sort((a,b)=>compareImportance(a.a,b.a));
const selected=briefStories(stories);assert.equal(selected.length,10);assert(selected.some(s=>s.a.category==='제도·시장'));assert(selected.filter(s=>s.a.category==='수급·성과').length<=4);assert(!selected.some(s=>['33','34'].includes(s.a.id)));assert.equal(stories.length,22);
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
for(const title of ideas){assert(insightKind({title}));assert(importanceForTest(title)>=20&&importanceForTest(title)<35)}
function importanceForTest(title){return rankingModule.importance({title,category:'상품·전략'}).score}

const insightBrief=briefStories([...stories,...ideas.map((t,i)=>make(400+i,t,'상품·전략'))].sort((a,b)=>compareImportance(a.a,b.a)));
assert(insightBrief.some(s=>s.a.id==='32'));assert.equal(insightBrief.length,10);
const smallLimit=briefStories([make(500,'ETF 총보수 인하','상품·전략'),make(501,ideas[0],'상품·전략')],1);assert.equal(smallLimit[0].a.id,'500','analysis has no reserved slot');
assert.equal(rankingModule.importance({title:'SEC approves new ETF portfolio rules',category:'제도·시장'}).score,60,'opinion signal must not stack on regulation');
assert(!insightKind({title:'새로운 액티브 ETF 상품 안내'}));console.log('PASS: modest analysis signals, ten initial stories, no reserved slots or stacked opinion boosts');

const speech=(id,title,published='2026-10-29T14:00:00Z')=>({...make(id,title,'제도·시장').a,published,date:new Date(Date.parse(published)+9*3600000).toISOString().slice(0,10)});
const speechTitles=[
 '하준경 “레버리지 ETF 논란 송구… 최종 결정은 금융위”',
 '하준경, 레버리지 ETF 논란에 "손실 본 분들 있어 송구... 최종 결정은 금융위"',
 '하준경, 레버리지 ETF 손실에 "송구"…정책 실패엔 선 긋고 "금융위 결정"',
 '하준경 정책실장 "송구스럽다"...레버리지ETF 논란에 사과',
 '“국민께 송구”…하준경 정책실장, 레버리지 ETF 논란 사과',
 '야당 레버리지 ETF 도입 추궁‥하준경 "국민께 심려 끼쳐 송구"',
 '하준경 청와대 정책실장 "ETF로 국민 큰 변동성 노출…대책 마련"',
 '하준경, 레버리지 ETF에 도입 시기, 주식시장 재평가 맞물려 큰 변동성',
 '하준경 "레버리지 ETF 손실 국민께 송구"…정책 실패엔 선 그어'
];
const statements=speechTitles.map((t,i)=>speech(600+i,t,i===1?'2026-10-29T22:00:00Z':'2026-10-29T14:00:00Z'));
assert.equal(groupStories(statements).length,1,'same statement, title aliases, evening and next morning');
assert.equal(groupStories([...statements].reverse()).length,1);
assert.equal(groupStories([statements[0],speech(620,'권대영 "레버리지 ETF 논란 송구"')]).length,2,'different speaker');
assert.equal(groupStories([statements[0],speech(621,'하준경 "레버리지 ETF 정책 실패 인정"')]).length,2,'opposite stance');
assert.equal(groupStories([statements[0],speech(622,'하준경 "레버리지 ETF 도입 철회 결정"')]).length,2,'new action');
assert.equal(groupStories([statements[0],speech(623,speechTitles[0],'2026-10-30T14:00:00Z')]).length,2,'next separate day');
const day29={...statements[0],summary:'하준경 정책실장은 29일 국감에서 레버리지 ETF 논란에 사과했다.',summaryKind:'summary'};
const day30={...speech(624,speechTitles[0],'2026-10-29T22:00:00Z'),summary:'하준경 정책실장은 30일 국감에서 레버리지 ETF 논란에 사과했다.',summaryKind:'summary'};
assert.equal(groupStories([day29,day30]).length,2,'different explicit event dates');
const summarized={...statements[1],summary:'확인된 발언의 요약입니다.',summaryKind:'summary'};assert.equal(groupStories([statements[0],summarized])[0].a.id,summarized.id);
console.log('PASS: statement event grouping by speaker/topic/stance, midnight syndication, dates and new policy guard, verified-summary representative');

assert.equal(pair('Gold ETF AUM rises to Rs 1.86 lakh crore, top 5 schemes account for 80 pc of assets','Gold ETFs manage ₹1.9 trillion despite Sept correction; top 5 control 80%').length,1);
assert.equal(pair('Gold ETF AUM Rs 1.86 lakh crore','Gold ETF AUM Rs 1.87 lakh crore').length,2);
assert.equal(pair('Gold ETF AUM Rs 1.86 lakh crore','Silver ETF AUM Rs 1.86 lakh crore').length,2);
assert.equal(pair('Gold ETF AUM Rs 1.86 lakh crore in September','Gold ETF AUM Rs 1.86 lakh crore in October').length,2);
assert.equal(pair('Bitcoin Spot ETFs Extend Inflow Streak to Three Days With $137.33 Million','US Bitcoin ETFs Draw $137 Million, Extend Inflow Streak to Three Sessions').length,1);
assert.equal(pair('Ethereum spot ETFs lose $21.41 million as outflows extend to three sessions','U.S. spot Ether ETFs see $21.4M outflow, led by BlackRock on Oct. 28').length,1);
assert.equal(pair('Bitcoin ETFs see $137M inflows over two days','Bitcoin ETFs see $137M daily inflows').length,2);
assert.equal(pair('IBIT ETF inflows hit $137M','Bitcoin spot ETFs draw $137M inflows').length,2);
assert(isRoutineStory({title:'Form FWP VanEck Merk Gold ETF Filed by: VanEck Merk Gold ETF'}));assert(isRoutineStory({title:'U.S. spot XRP ETF inflows exceed $1.8 billion, XRP holders can earn up to $10,000 daily'}));
console.log('PASS: gold AUM currency/rounding, aggregate crypto flow title aliases, date/period/fund boundaries, promotional and filing exclusions');

const productNight={...make(700,'미래에셋 TIGER 미국S&P500 ETF, 개인 순매수 5조원 돌파','수급·성과').a,date:'2026-10-30',published:'2026-10-29T22:00:00Z'};
const productEvening={...make(701,'미래에셋 TIGER 미국S&P500 ETF, 연초 이후 개인 순매수 5조원 돌파','수급·성과').a,date:'2026-10-29',published:'2026-10-29T09:00:00Z'};
assert.equal(groupStories([productNight,productEvening]).length,1,'same cumulative product milestone across midnight');
assert.equal(groupStories([productNight,{...productEvening,title:productEvening.title.replace('5조원','6조원')}]).length,2);

assert.equal(groupStories([productNight,{...productEvening,title:'미래에셋 TIGER 미국S&P500 ETF, 개인 순매수 5조원 돌파…국내 최초'}]).length,1,'same explicitly first cumulative milestone despite omitted horizon');

assert.equal(groupStories([productNight,{...productEvening,title:'미래에셋자산운용 "TIGER 미국S&P500 ETF, 개인 순매수 5조원 처음 넘어"'}]).length,1,'first/record threshold aliases across midnight');

assert.equal(groupStories([productNight,{...productEvening,title:'TIGER 미국S&P500, 개인 순매수 5조원 돌파…국내 ETF 첫 기록'}]).length,1,'omitted ETF suffix and first-record alias');

assert.equal(groupStories([productNight,{...productEvening,title:'미래에셋자산운용, TIGER 미국S&P500 ETF…개인 순매수 첫 5조원 돌파'}]).length,1);
assert.equal(groupStories([{...productNight,title:'TIGER 미국S&P500 ETF, 하루 개인 순매수 5조원 돌파'},{...productEvening,title:'TIGER 미국S&P500 ETF, 하루 개인 순매수 첫 5조원 돌파'}]).length,2,'do not join different daily flow dates');

assert.equal(groupStories([productNight,{...productEvening,title:"TIGER 미국S&P500 ETF, 올 들어 개인 순매수 '5조원' 돌파"}]).length,1,'YTD and quoted amount aliases');

const noAmount={...productEvening,id:'record-no-amount',url:'https://example.com/no-amount',title:'미래에셋자산운용 TIGER 미국S&P500 ETF 개인 순매수 역대 최대'};
assert.equal(groupStories([productNight,noAmount]).length,1,'omitted amount with a unique nearby milestone');
const differentAmount={...productNight,id:'other-record',url:'https://example.com/other',title:productNight.title.replace('5조원','6조원')};
assert.equal(groupStories([productNight,differentAmount,noAmount]).length,3,'ambiguous amount must not absorb the generic record');

assert.equal(pair('U.S. Spot Bitcoin ETFs See $292 Million in 30-Day Net Outflows, First Since Late July','美 비트코인(BTC) 현물 ETF, 30일간 2억9200만달러 순유출…7월 말 이후 처음').length,1,'English/Korean same amount and 30-day horizon');
assert.equal(pair('Bitcoin ETFs lose $255m over 30 days despite BlackRock inflows','美 비트코인(BTC) 현물 ETF, 30일간 2억9200만달러 순유출').length,2,'255M and 292M remain distinct events');
assert.equal(pair('U.S. Spot Bitcoin ETFs Took In $137.3 Million on October 28, Extending Their Inflow Streak to Three Days','美 비트코인 ETF, 전날 1.4억弗 순유입…3거래일 연속').length,1,'explicit date vs previous day, Korean rounded dollar amount');
assert.equal(pair('Bitcoin ETFs reversed outflows with $286M inflo...','Bitcoin ETFs saw $286M inflows over two days, r...').length,1,'reversal direction and unambiguous missing horizon');
assert.equal(pair('Bitcoin ETF inflows on October 28 hit $137.3M','비트코인 현물 ETF, 10월 29일 1억3730만달러 순유입').length,2,'explicit reference dates differ');
const ambiguousFlow=[make(801,'Bitcoin ETFs attract $286M','수급·성과').a,make(802,'Bitcoin ETFs see $286M daily inflows','수급·성과').a,make(803,'Bitcoin ETFs see $286M inflows over two days','수급·성과').a];
assert.equal(groupStories(ambiguousFlow).length,3,'unknown horizon cannot bridge daily and two-day totals');
const topicMarketURL=url(fs.readFileSync('lib/market.ts','utf8').replaceAll('./insights',insightURL));
const topicsURL=url(fs.readFileSync('lib/flow-topics.ts','utf8').replaceAll('./brief',briefURL).replaceAll('./bond-milestones',bondMilestonesURL).replaceAll('./overseas-events',overseasURL).replaceAll('./market',topicMarketURL).replaceAll('./ranking',rankURL).replaceAll('./insights',insightURL));
const {compressFlowTopics}=await import(topicsURL);
const topicEvents=groupStories([make(810,'Bitcoin ETFs lose $255m over 30 days despite BlackRock inflows','수급·성과').a,make(811,'U.S. Spot Bitcoin ETFs See $292 Million in 30-Day Net Outflows','수급·성과').a,make(812,'美 비트코인(BTC) 현물 ETF, 30일간 2억9200만달러 순유출','수급·성과').a,make(813,'Bitcoin ETF Inflows Return as IBIT Trading Volume Shrinks','수급·성과').a,make(814,'SEC approves Bitcoin ETF rules','제도·시장').a].map(a=>({...a,marketHint:'overseas'})));
const topicDisplay=compressFlowTopics(topicEvents);assert.equal(topicDisplay.length,2);assert.equal(topicDisplay[0].others.length,3);assert.equal(topicDisplay[0].relatedKind,'coverage');assert.equal(topicDisplay[1].a.id,'814');
const retained=topicDisplay.flatMap(s=>[s.a,...s.others]).map(a=>a.id);assert.equal(retained.length,5);assert.equal(new Set(retained).size,5);
console.log('PASS: bilingual flow grouping, Korean dollar units, rolling periods, reversal, exact dates, missing-horizon ambiguity, topic display preserves distinct values and regulatory news');

const compressedPair=(x,y,category)=>compressFlowTopics([make(901,x,category),make(902,y,category)]);
assert.equal(compressedPair('블랙록 미국채 ETF 신규 상장','블랙록 미국채 ETF 출시 안내','신규 상장').length,1);
assert.equal(compressedPair('VanEck cuts management fee for bond ETF (EMBX)','VanEck Reduces Management Fee for Emerging Markets Bond ETF (EMBX)','상품·전략').length,1);
assert.equal(compressedPair('KODEX 미국S&P500 ETF 분배금 117원 지급','KODEX 미국S&P500 ETF 분배금 118원 지급','배당·분배').length,1);
assert.equal(compressedPair('SOL 미국배당다우존스 ETF 수익률 1위','SOL 미국배당다우존스 ETF 수익률 26.36%','수급·성과').length,1);
assert.equal(compressedPair('ACE 테슬라밸류체인 ETF 편입 구조 소개','ACE 테슬라밸류체인 ETF 운용 구조 해설','상품·전략').length,1);
assert.equal(compressedPair('신한은행 퇴직연금 ETF 이벤트','신한은행 퇴직연금 ETF 매수하면 치킨 추첨','마케팅').length,1);
assert.equal(compressedPair('ACE 테슬라 ETF 출시','ACE 엔비디아 ETF 출시','신규 상장').length,2,'different named products stay separate');
assert.equal(compressedPair('금융위 레버리지 ETF 규제 변경','금감원 레버리지 ETF 규제 강화','제도·시장').length,2,'high-priority policy reports remain visible');
assert.equal(compressedPair('ACE 테슬라 ETF 청산','ACE 테슬라 ETF 거래정지','제도·시장').length,2);
const selectedCoverage=compressedPair('SOL 미국배당다우존스 ETF 수익률 1위','SOL 미국배당다우존스 ETF 1년 수익률 26.36%','수급·성과');
assert.equal(selectedCoverage[0].a.id,'902','prefer a specific amount and period');assert.equal(selectedCoverage[0].others.length,1);assert(!('topicEvents' in selectedCoverage[0]),'no nested collection of event cards');
console.log('PASS: representative selection across launch, fees, payouts, performance, strategy and campaigns; product and risk guards; source links retained without folder cards');
assert.equal(pair('Bitcoin ETFs add $137M, pushing October back into the green','U.S. Bitcoin spot ETFs recorded $137.3M in net inflows on October 28').length,1,'flow action aliases join the same numeric event');

const bondArticles=[
 make(1001,"삼성운용 'KODEX 미국10년국채액티브(H)'ETF 순자산 2000억 돌파",'수급·성과').a,
 make(1002,'삼성자산운용, 미국 10년 국채 ETF 순자산 2000억원 돌파','수급·성과').a,
 make(1003,"삼성자산운용 'KODEX 미국10년국채 ETF', 순자산 2000억 돌파",'수급·성과').a,
 make(1004,'삼성자산운용, 美 10년 국채 ETF 순자산 2천억원 돌파','수급·성과').a,
 make(1005,'KODEX 미국 10년 국채 액티브(H) ETF 순자산 0.2조원 돌파','수급·성과').a
];
bondArticles[0]={...bondArticles[0],summary:'본문으로 검증한 상품과 순자산 수치입니다.',summaryKind:'summary'};
const bonds=compressFlowTopics(groupStories(bondArticles));assert.equal(bonds.length,1);assert.equal(bonds[0].a.id,'1001');assert.equal(bonds[0].others.length,4);assert.equal(new Set(bonds.flatMap(s=>[s.a,...s.others]).map(a=>a.id)).size,5);
for(const title of ["KODEX 미국10년국채액티브(UH) ETF 순자산 2000억 돌파","ACE 미국10년국채액티브(H) ETF 순자산 2000억 돌파","KODEX 미국30년국채액티브(H) ETF 순자산 2000억 돌파","KODEX 미국10년국채액티브(H) ETF 순자산 3000억 돌파","KODEX 미국10년국채액티브(H) ETF 개인 순매수 2000억 돌파","KODEX 미국10년국채선물 ETF 순자산 2000억 돌파"]){assert.equal(compressFlowTopics(groupStories([bondArticles[0],make(1010,title,'수급·성과').a])).length,2,title)}
const unhedged=make(1020,'KODEX 미국10년국채액티브(UH) ETF 순자산 2000억 돌파','수급·성과').a;
assert.equal(compressFlowTopics(groupStories([bondArticles[0],unhedged,bondArticles[1]])).length,3,'an unspecified hedge cannot bridge two named variants');
assert.equal(compressFlowTopics(groupStories([bondArticles[0],{...bondArticles[1],date:'2026-10-30',published:'2026-10-30T00:00:00Z'}])).length,2,'separate dated milestones');
console.log('PASS: generic Korean Treasury AUM aliases resolve from unique nearby fund evidence; verified representative retained; H/UH ambiguity, issuer/tenor/amount/metric/instrument/date boundaries preserved');

assert.equal(compressFlowTopics(groupStories([bondArticles[0],make(1030,'삼성운용 KODEX 미국10년국채 ETF 순자산 2천억원','수급·성과').a])).length,1,'snapshot title can join an unambiguous adjacent milestone even if the action word is omitted');

for(const title of ['KODEX 미국10년국채액티브(H) ETF 순자산 2000억 달러 돌파','KODEX 미국10년국채액티브(H) ETF 순자산 2000억원 돌파 목표','KODEX 미국10년국채액티브(H) ETF 순자산 2000억원 돌파…다른 상품과 비교'])assert.equal(groupStories([bondArticles[0],make(1040,title,'수급·성과').a]).length,2,'currency, forward targets and distinct analysis must not be inferred as the same event');

const verifiedBond={...bondArticles[0],summary:'삼성운용은 KODEX 미국10년국채액티브(H) 순자산이 2041억원이라고 밝혔다.',summaryKind:'summary'};
const preciseBond=make(1050,'삼성운용 美 10년물 국채 ETF, 순자산 2041억원','수급·성과').a;
assert.equal(compressFlowTopics(groupStories([verifiedBond,preciseBond])).length,1,'verified body explicitly connects milestone threshold and precise AUM');
assert.equal(compressFlowTopics(groupStories([bondArticles[0],preciseBond])).length,2,'no numeric approximation without verified evidence');
assert.equal(compressFlowTopics(groupStories([{...verifiedBond,summaryKind:'title_translation'},preciseBond])).length,2,'a title translation is not body evidence for a new amount');

const performanceAnchor={...make(901,'KB운용, 美 고배당 ETF 상장 이후 수익률 17%대','수급·성과').a,summary:'RISE 미국고배당다우존스TOP10 ETF가 상장 이후 17.10% 수익률을 기록했다. 누적 분배금은 370원이다.',summaryKind:'summary'};
const performanceReports=[
 'KB운용, 미국 고배당 ETF 수익률 17% 기록',
 'KB운용, AI 기술주 쏠림 부담에 고배당 ETF 주목…상장 후 수익률 17%',
 'KB자산운용 고배당 ETF, 상장 후 17.1% 수익…누적 분배금 370원',
 'KB자산운용, 美고배당 ETF 수익률 17%…11개월간 분배금 370원 지급',
 "KB자산운용, '미국고배당다우존스TOP10' ETF 배당투자 주목"
].map((t,i)=>make(902+i,t,i<2?'수급·성과':'배당·분배').a);
const groupedPerformance=groupStories([...performanceReports,performanceAnchor]);
assert.equal(groupedPerformance.length,1);assert.equal(groupedPerformance[0].a.id,performanceAnchor.id);assert.equal(groupedPerformance[0].others.length,5);
for(const t of [
 'KB운용 RISE 미국고배당다우존스TOP10 ETF 1개월 수익률 17.1%',
 'KB운용 RISE 미국고배당다우존스TOP10 ETF 상장 후 수익률 18.1%',
 'KB운용 RISE 미국고배당다우존스TOP10 ETF 상장 후 수익률 17.1% 누적 분배금 400원',
 'KB운용 RISE 미국배당100 ETF 상장 후 수익률 17.1%'
])assert.equal(groupStories([performanceAnchor,make(920,t,'수급·성과').a]).length,2,t);
console.log('PASS: product performance announcement aliases across categories, rounded returns, verified representative, separate products/periods/returns/payouts');

const flowAnchor={...make(1100,"[금융 HOT 뉴스] 삼성운용 '커버드콜 ETF', 개인 순매수 3조2047억 기록",'수급·성과').a,summary:'삼성운용은 KODEX 200타겟위클리커버드콜의 연초 이후 개인 누적 순매수가 3조2047억원이라고 밝혔다. 최근 한 달 유입은 4811억원, 순자산은 4조7757억원이다.',summaryKind:'summary'};
const flowAliases=[
 '삼성자산운용, KODEX 커버드콜 ETF 순자산 4조7000억 돌파...올해 개인 순매수 1위',
 '삼성 KODEX 200타겟위클리커버드콜, 커버드콜 ETF 중 연초이후 개인순매수 1위…3조 돌파',
 '삼성 KODEX 200타겟위클리커버드콜, 커버드콜 ETF 중 연초이후 개인순매수 1위',
 '삼성 KODEX 커버드콜 ETF, 개인 순매수 3조원 돌파…국내 1위',
 '삼성운용 커버드콜 ETF, 올해 개인 자금 3조원 유입',
 '삼성운용 "KODEX 200타겟위클리, 커버드콜ETF 중 개인 매수 1위"',
].map((t,i)=>make(1101+i,t,'수급·성과').a);
for(const items of [[flowAnchor,...flowAliases],[...flowAliases,flowAnchor],[...flowAliases].reverse().concat(flowAnchor)]){
 const groups=compressFlowTopics(groupStories(items));assert.equal(groups.length,1);assert.equal(groups[0].a.id,flowAnchor.id);assert.equal(groups[0].others.length,6);
 assert.equal(new Set(groups.flatMap(s=>[s.a,...s.others]).map(a=>a.id)).size,7);
}
const {fundFlowAnnouncementKeys}=await import(flowAnnouncementURL);
for(const title of [
 '삼성운용 KODEX 200커버드콜액티브 ETF 올해 개인 순매수 3조원 돌파',
 '미래에셋 TIGER 200타겟위클리커버드콜 ETF 개인 순매수 3조원 돌파',
 '삼성운용 KODEX 미국나스닥100커버드콜 ETF 개인 순매수 3조원 돌파',
 '삼성운용 KODEX 200타겟위클리커버드콜 ETF 하루 개인 순매수 3조원 돌파',
 '삼성운용 KODEX 200타겟위클리커버드콜 ETF 최근 한 달 개인 순매수 3조원 돌파',
 '삼성운용 KODEX 200타겟위클리커버드콜 ETF 올해 개인 순매수 4조원 돌파',
 '삼성운용 KODEX 200타겟위클리커버드콜 ETF 올해 개인 순매수 3조1000억원 기록',
 '삼성운용 KODEX 200타겟위클리커버드콜 ETF 올해 개인 순매수 3조달러 돌파',
 '삼성운용 KODEX 커버드콜 ETF 순매도 3조원',
]){const other=make(1120,title,'수급·성과').a;assert(!fundFlowAnnouncementKeys([flowAnchor,other]).has(other.id),title)}
const nextDay={...flowAliases[0],date:'2026-10-30',published:'2026-10-30T00:00:00Z'};
assert(!fundFlowAnnouncementKeys([flowAnchor,nextDay]).has(nextDay.id));
const translated={...flowAnchor,summaryKind:'title_translation'};
assert.equal(fundFlowAnnouncementKeys([translated,...flowAliases]).size,0,'a translated title is not body evidence');
const competing={...flowAnchor,id:'competing',summary:flowAnchor.summary.replaceAll('200타겟위클리커버드콜','200커버드콜액티브')};
assert(!fundFlowAnnouncementKeys([flowAnchor,competing,flowAliases[0]]).has(flowAliases[0].id),'a generic issuer headline cannot bridge competing products');
console.log('PASS: verified fund announcement unifies flow/AUM/rank and shortened names; representative/source retention; product, period, amount, currency and ambiguity guards');

const launchAnchor={...make('launch-anchor','한국거래소, KB자산운용 채권·미국주식 ETF 2종 17일 신규상장','신규 상장').a,date:'2026-11-15',published:'2026-11-15T03:51:18Z',summary:'11월 13일 거래소 발표에 따르면 RISE 27-11 회사채(AA-이상)액티브와 미국초대형주TOP10이 17일 상장 예정이다. 각각 2027년 만기 우량채권과 미국 시총 상위 10종목에 투자한다.',summaryKind:'summary'};
const launchAliases=["'RISE 미국초대형주TOP10' 등 ETF 2종 오는 17일 신규 상장",'KB운용, 회사채·美 대형주 투자 ETF 2종 출시','거래소, KB자산운용 ETF 2종 17일 신규 상장','KB운용, 만기형 회사채·미국 초대형주 ETF 2종 상장','美 대형주부터 우량채권까지…RISE ETF 2종목 출격'].map((title,i)=>({...make('launch-'+i,title,i===3?'상품·전략':'신규 상장').a,date:'2026-11-13',published:'2026-11-13T07:00:00Z'}));
for(const rows of [[launchAnchor,...launchAliases],[...launchAliases,launchAnchor],[...launchAliases].reverse().concat(launchAnchor)]){
 const grouped=groupStories(rows);assert.equal(grouped.length,1);assert.equal(grouped[0].a.id,launchAnchor.id);assert.equal(grouped[0].others.length,5);
}
for(const title of ['KB운용, 회사채·미국주식 ETF 2종 18일 신규 상장','삼성운용, 회사채·미국주식 ETF 2종 17일 신규 상장','KB운용, 회사채·미국주식 ETF 3종 17일 신규 상장',"'RISE 미국반도체TOP10' 등 ETF 2종 오는 17일 신규 상장",'KB운용, 커버드콜 ETF 2종 17일 신규 상장','KB운용, 회사채·미국주식 ETF 2종 출시 연기'])assert.equal(groupStories([launchAnchor,{...launchAliases[0],title}]).length,2,title);
const otherLaunch={...launchAnchor,id:'other-launch',url:'https://example.com/other-launch',title:launchAnchor.title.replace('17일','18일'),summary:launchAnchor.summary.replace('17일','18일')};
assert.equal(groupStories([launchAnchor,otherLaunch,launchAliases[1]]).length,3,'unknown-date coverage must not bridge two launch dates');
console.log('PASS: verified multi-fund launch, issuer/product aliases, weekend syndication, summary representative, date/product/count conflicts and ambiguity');

const mixedAnchor={...make('mixed-anchor','한투운용 ACE 미국지수 채권혼합 ETF, 연초 이후 자금 1조 원 유입','수급·성과').a,summary:'11월 13일 기준 ACE 미국 대표지수 채권혼합 ETF 2종의 연초 이후 유입액은 1조39억 원이다. S&P500형에 5,492억 원, 나스닥100형에 4,547억 원이 유입됐다.',summaryKind:'summary'};
const mixedTitles=[
 '한투운용, 미국 대표지수 채권혼합형 ETF 2종 올해 자금유입액 1조원 돌파',
 "'ACE 美 대표지수 채권혼합형 ETF 2종' 올해 자금 유입액 1조원 돌파",
 '한투운용, ACE 미국 대표지수 채권혼합 ETF 2종에 1조원 유입',
 '한투운용, 美대표지수 채권혼합형 ETF에 연초 이후 1조원 유입',
 '한투운용 미국채혼합형 ETF 2종, 연초 이후 순유입 1조 돌파',
 '한투운용, 미국지수·채권혼합 ETF 2종에 1조원 유입',
 '한투운용 ACE 미국 대표지수 채권혼합 ETF 2종 올해 1조39억원 유입'
].map((title,i)=>make('mixed-'+i,title,'수급·성과').a);
for(const rows of [[mixedAnchor,...mixedTitles],[...mixedTitles,mixedAnchor],[...mixedTitles].reverse().concat(mixedAnchor)]){
 const groups=groupStories(rows);assert.equal(groups.length,1);assert.equal(groups[0].a.id,mixedAnchor.id);assert.equal(groups[0].others.length,mixedTitles.length);
}
for(const title of [
 '한투운용 ACE 미국 대표지수 채권혼합 ETF 2종 하루 자금 1조원 유입',
 '한투운용 ACE 미국 대표지수 채권혼합 ETF 2종 올해 2조원 유입',
 '한투운용 ACE 미국 대표지수 채권혼합 ETF 3종 올해 1조원 유입',
 '한투운용 ACE 미국 S&P500 채권혼합 ETF 올해 1조원 유입',
 '삼성운용 미국 대표지수 채권혼합 ETF 2종 올해 1조원 유입',
 '한투운용 ACE 미국 대표지수 채권혼합 ETF 2종 올해 1조달러 유입',
 '한투운용 ACE 미국 대표지수 채권혼합 ETF 2종 올해 순자산 1조원',
]){const keys=fundFlowAnnouncementKeys([mixedAnchor,make('mixed-conflict',title,'수급·성과').a]);assert.notEqual(keys.get('mixed-conflict'),keys.get(mixedAnchor.id),title);}
console.log('PASS: aggregate index/bond flows, issuer and title aliases, exact verified amount, summary representative, source retention, metric/product/currency/period guards');
const {category:classifyCategory}=await import(classifyURL);
for(const title of ['"나스닥100에 우주·반도체까지"…우리운용, 혁신 ETF 펀드 출시',"우리운용, '나스닥100 ETF+혁신 트렌드 ETF' 담는 펀드 출시"]){assert.equal(classifyCategory(title),'상품·전략')}
assert.equal(classifyCategory('우리운용, 반도체 ETF 신규 상장'),'신규 상장');
console.log('PASS: ETF-investing fund launches use product/strategy; actual ETF listings remain listings');


// One announcement, several headline aliases: preserve every source and prefer
// the verified summary, regardless of incoming importance/time order.
const announcementArticle=(id,title,summary='',category='상품·전략')=>({...make(id,title,category).a,date:'2026-11-17',published:'2026-11-17T02:00:00Z',...(summary?{summary,summaryKind:'summary'}:{})});
const announcementFixture=[
 announcementArticle('ann1','미래에셋운용, TIGER 액티브 커버드콜 ETF 순자산 4조 돌파','순자산 4조917억원 돌파·국내 액티브 커버드콜 시장 점유율 52%. TIGER ETF 4종 합산, 연초 이후 개인 누적 순매수 3조467억원.','수급·성과'),
 announcementArticle('ann2','미래에셋자산운용, 액티브 커버드콜 ETF 합산 순자산 4조원 기록','','수급·성과'),
 announcementArticle('ann3','KB운용, 美 초대형 10개 기업 투자 ETF 등 2종 출시','미국 초대형주·만기 회사채 ETF 2종, 11/17 상장. RISE 미국초대형주TOP10: 미국 시총 상위 10개 기업 투자. RISE 27-11 회사채(AA-이상)액티브: 2027년 10~12월 만기 우량 회사채 투자.','신규 상장'),
 announcementArticle('ann4',"'RISE 미국초대형주TOP10 ETF' 출시…美 시총 상위 10개 기업 투자",'','신규 상장'),
 announcementArticle('ann5','한투운용, ACE 글로벌반도체TOP4 Plus ETF 리밸런싱 진행'),
 announcementArticle('ann6','한투운용 ACE 글로벌반도체 ETF 리밸런싱…삼전 늘리고 SK하닉 줄이고'),
 announcementArticle('ann7','한투운용 반도체 ETF 리밸런싱…삼전 늘리고 하닉 줄여','삼성전자 비중 확대(3.43%→19.75%)·SK하이닉스 축소(17.58%→3.29%). ACE 글로벌반도체TOP4 Plus의 11/5 정기 리밸런싱, 편입·제외 없이 비중 조정.'),
];
for(const input of [announcementFixture,[...announcementFixture].reverse()]){
 const groups=groupStories(input);assert.equal(groups.length,3);assert.deepEqual(groups.map(g=>g.others.length+1).sort(),[2,2,3]);
 assert(groups.every(g=>g.a.summaryKind==='summary'));assert.equal(new Set(groups.flatMap(g=>[g.a,...g.others]).map(a=>a.id)).size,7);
}
const separateAnnouncements=[
 announcementArticle('ann8','미래에셋운용, 액티브 커버드콜 ETF 3종 순자산 4조 돌파'),
 announcementArticle('ann9','미래에셋운용, TIGER 배당커버드콜 ETF 순자산 4조 돌파'),
 announcementArticle('ann10','미래에셋운용, 액티브 커버드콜 ETF 순자산 5조 돌파'),
 announcementArticle('ann11',"'RISE 미국초대형주TOP20 ETF' 신규 상장"),
 announcementArticle('ann12','한투운용, ACE 코리아반도체TOP4 ETF 리밸런싱 진행'),
 announcementArticle('ann13','한투운용 반도체 ETF 리밸런싱…삼전 줄이고 하닉 늘리고'),
 {...announcementFixture[5],id:'ann14',date:'2026-11-18',published:'2026-11-18T02:00:00Z'},
];
const checked=groupStories([...announcementFixture,...separateAnnouncements]);
for(const a of separateAnnouncements)assert(!checked.some(g=>[g.a,...g.others].some(x=>x.id===a.id)&&[g.a,...g.others].some(x=>['ann1','ann3','ann7'].includes(x.id))));
const digestURL=url(fs.readFileSync('lib/digest.ts','utf8'));const {summaryPoints}=await import(digestURL);
assert.deepEqual(summaryPoints('순자산 4조917억원 돌파. 연초 순매수 3조467억원 기록.'),['순자산 4조917억원 돌파','연초 순매수 3조467억원 기록']);
assert.deepEqual(summaryPoints('시장 점유율은 52%이다. ETF 2종을 상장했다.'),['시장 점유율은 52%','ETF 2종을 상장']);
assert.deepEqual(summaryPoints('본문 발췌: ETF 2종을 상장했다.'),['본문 발췌: ETF 2종을 상장했다']);
console.log('PASS: seven headline aliases compress to three verified announcements; count/product/value/direction/date guards; concise fact bullets preserve figures');

const shareAlias=announcementArticle('ann15','미래에셋운용, 액티브 커버드콜 ETF 시장 52% 점유…자금 유입 절반 흡수');
assert.equal(groupStories([...announcementFixture,shareAlias]).length,3);
const otherShare=announcementArticle('ann16','미래에셋운용, 액티브 커버드콜 ETF 시장 53% 점유');
assert(!groupStories([...announcementFixture,otherShare]).some(g=>[g.a,...g.others].some(a=>a.id==='ann1')&&[g.a,...g.others].some(a=>a.id==='ann16')));
console.log('PASS: verified aggregate market-share alias; different percentage remains separate');

// Morning editions contain syndicated headlines on both sides of midnight.
const morning=(i,title,extra={})=>({...make(i,title,'수급·성과').a,date:'2026-11-18',published:'2026-11-18T01:30:00Z',...extra});
const parking=[
 morning(1901,"증시 변동성에 '달러 파킹' 인기…삼성 '미국머니마켓 ETF' 1조 돌파",{summaryKind:'summary',summary:'KODEX 미국머니마켓액티브 순자산 1조474억원으로 1조원 돌파.'}),
 morning(1902,'삼성자산운용, KODEX 미국머니마켓액티브 ETF 순자산 1조 돌파'),
 morning(1903,'삼성자산운용, 증시 변동성에 달러 파킹형 ETF 부각… 순자산 1조원 돌파'),
 morning(1904,"삼성운용 '미국머니마켓 ETF', 상장 1년 6개월 만에 순자산 1조원 돌파",{date:'2026-11-19',published:'2026-11-18T20:24:00Z'}),
 morning(1905,'삼성운용 미국머니마켓 ETF, 출시 1년 반 만에 1조원')];
assert.equal(groupStories(parking).length,1);
assert.equal(groupStories([...parking].reverse()).length,1);
assert.equal(groupStories(parking)[0].a.id,'1901');
for(const different of [
 morning(1910,'삼성운용 미국머니마켓 ETF 순자산 2조원 돌파'),
 morning(1911,'삼성운용 미국머니마켓 ETF 순자산 1조원 돌파',{date:'2026-11-20',published:'2026-11-20T01:30:00Z'}),
 morning(1912,'삼성운용 미국머니마켓 ETF 순유입 1조원 돌파')
])assert.equal(groupStories([parking[0],different]).length,2);
const payouts=[
 morning(1920,'한투운용, ACE 고배당주 ETF 26일까지 매수 시 특별배당 반영',{summaryKind:'summary',summary:'ACE 고배당주Plus커버드콜액티브 11월 분배금에 삼성전자 특별배당 반영.'}),
 morning(1921,'한투운용, ACE 고배당주Plus커버드콜액티브 ETF 11월 분배에 삼전 특별배당 반영'),
 morning(1922,"한투운용, 고배당주 커버드콜 ETF 분배금에 삼성전자 특별배당 반영")];
assert.equal(groupStories(payouts).length,1);
assert.equal(groupStories([...payouts].reverse()).length,1);
assert.equal(groupStories([payouts[0],morning(1923,'한투운용 ACE 고배당주 ETF 11월 분배금 지급')]).length,2);
assert.equal(groupStories([payouts[0],morning(1924,'한투운용 ACE 고배당주Plus커버드콜액티브 ETF 분배금 중단')]).length,2);
const classify=await import(classifyURL);
assert(!classify.isNewListing(parking[4].title));
assert.equal(classify.category('[2026 ETF 어워즈] 넥스트 리더는 하나운용…3년 만에 순자산 4조 돌파'),'마케팅');
console.log('PASS: money-market milestone and verified special-payout aliases; midnight copies, amount, metric, date and distinct-product guards; retrospective launch and awards classification');

for(const title of ["앤트로픽 상장 D-1…국내 ETF 누가 먼저 담나 경쟁 본격화","[미국 ETF 히든 챔피언] 엔비디아 낮추고 AI 병목만 집중 베팅","[ETF 시황] 휴머노이드 ETF 10%↑ vs SK하이닉스 인버스 8%↓"]){
 assert(importanceForTest(title)>=20&&importanceForTest(title)<35);
}
assert.equal(insightKind({title:'매일 ETF 소식 모음'}),'');
console.log('PASS: IPO exposure and ETF strategy comparisons receive modest, non-stacked reading signals without changing the ten-story cap');

assert.equal(briefStories(groupStories(parking)).length,1,'A checked representative with a shorter title must retain its grouped AUM signal');
console.log('PASS: verified representative retains the strongest importance signal from its same-event coverage');

// November 24: syndicated releases must resolve independently of title wording.
const nov24=(id,title,extra={})=>({...make(id,title,'상품·전략').a,date:'2026-11-23',published:'2026-11-23T10:00:00Z',...extra});
const llmAnchor=nov24('llm-anchor',"미래에셋, 앤트로픽 등 순수 LLM 기업 투자 '글로벌LLM액티브 ETF' 상장",{summaryKind:'summary',summary:'TIGER 글로벌LLM액티브 11/24 상장 예정.'});
const nov24Titles=[
 '미래에셋운용, 앤트로픽·오픈AI 등 LLM 겨냥한 ETF 24일 출시',
 '앤트로픽에 25% 투자…미래운용, LLM 집중 ETF 출시 : 금융',
 '우리자산운용, 한국부동산TOP3플러스 ETF 특별분배',
 "우리자산운용, 'WON 한국부동산TOP3플러스 ETF' 11월 특별분배",
 "우리자산운용, 'WON 한국부동산TOP3플러스 ETF' 특별분배",
 '우리자산운용, WON 한국부동산TOP3플러스 ETF 이달 특별분배 실시'
];
const nov24Rows=nov24Titles.map((t,i)=>nov24('nov24-'+i,t));
for(const input of [[...nov24Rows,llmAnchor],[llmAnchor,...nov24Rows].reverse()]){
 const groups=groupStories(input);assert.equal(groups.length,2);
 assert.deepEqual(groups.map(s=>1+s.others.length).sort(),[3,4]);
}
for(const title of ['우리운용, WON 한국부동산TOP3플러스 ETF 12월 특별분배','우리운용, WON 한국부동산TOP3플러스 ETF 분배금 삭감','우리운용, WON 한국부동산TOP2플러스 ETF 특별분배']){
 assert.equal(groupStories([nov24Rows[2],nov24('different',title)]).length,2);
}
for(const title of ['미래운용, LLM ETF 25일 출시','미래운용, LLM 레버리지 ETF 출시','미래운용, LLM ETF 출시 연기']){
 assert.equal(groupStories([llmAnchor,nov24('different',title)]).length,2);
}
const actualEdition=process.env.NEWS_EDITION_FIXTURE;
if(actualEdition){
 const articles=JSON.parse(fs.readFileSync(actualEdition,'utf8')).articles;
 const grouped=groupStories(articles);
 const matching=(re)=>grouped.filter(s=>[s.a,...s.others].some(a=>re.test(a.title)));
 assert.equal(matching(/한국부동산TOP3플러스/).length,1);
 const llmGroups=matching(/미래(?:에셋(?:자산)?운용|운용).*LLM.*ETF.*(?:출시|상장)|앤트로픽에 25% 투자…미래운용/).filter(s=>![s.a,...s.others].some(a=>/이모저모|한화.*미래에셋/.test(a.title)));
 assert.equal(llmGroups.length,1);
 console.log('LIVE EDITION: '+articles.length+' articles, '+grouped.length+' issues; payout '+(matching(/한국부동산TOP3플러스/)[0].others.length+1)+' reports, LLM '+(llmGroups[0].others.length+1)+' reports');
}
console.log('PASS: November 24 release aliases, reversed input, all sources retained; different products, payout months and launch dates stay separate');

const syndication=(...args)=>{const row=make(...args);return {...row,a:{...row.a,date:'2026-11-24',published:'2026-11-24T02:00:00Z'}}};
const infraAnchor={...syndication('infra-anchor',"한화자산운용, 'PLUS 글로벌AI병목인프라액티브' ETF 신규 상장",'신규 상장').a,
 summary:'PLUS 글로벌AI병목인프라액티브 11/24 상장. 버티브 13.5%·루멘텀 12.5%·블룸에너지 11.5% 편입, 발전·냉각·광통신 등 5개 인프라 분야 투자.',summaryKind:'summary'};
const infraAliases=[
 '한화운용, PLUS 글로벌AI병목인프라액티브 ETF 신규 상장...AI 데이터센터 투자',
 '한화운용, 인공지능(AI) 데이터센터 병목 투자 ETF 신규 상장',
 "한화자산운용, '글로벌AI병목인프라액티브' ETF 상장...전력·냉각·광통신 투자",
 '반도체 대신 전력·냉각·광통신…한화운용, AI 인프라 ETF 상장',
 '한화운용, 전력·냉각·광통신 담은 ‘AI병목인프라 ETF’ 상장',
 '한화운용, AI 데이터센터 인프라 ETF 24일 상장 : 금융',
 "AI 데이터센터 '병목'에 투자…한화운용, 글로벌 인프라 ETF 상장",
].map((t,i)=>syndication('infra-'+i,t,i<2?'신규 상장':'상품·전략').a);
const additionTitles=[
 "삼성운용, 'KODEX 미국AI에이전트액티브' ETF에 앤트로픽 편입",
 "삼성자산운용, '미국AI에이전트액티브' ETF에 앤트로픽 편입",
 "삼성자산운용, '미국AI에이전트액티브 ETF'에 앤트로픽 담았다",
 '삼성자산운용, 美 상장 앤트로픽 ETF에 19.4% 편입',
 '삼성자산운용, 미국 AI에이전트 ETF에 앤트로픽 상장 이틀 만에 19.4% 편입',
 '삼성운용 ETF, 엔트로픽 상장 직후 담았다...편입 비중 19.4%',
].map((t,i)=>syndication('addition-'+i,t,'상품·전략').a);
const comparison=syndication('comparison','[마켓H] 앤트로픽 상장에 엇갈린 ETF 전략…삼성 늘리고 KB는 줄여','상품·전략').a;
for(const input of [[...infraAliases,infraAnchor,...additionTitles,comparison],[comparison,...additionTitles,infraAnchor,...infraAliases].reverse()]){
 const groups=compressStoryCoverageForTest(input);
 assert.equal(groups.length,3);
 const infra=groups.find(s=>s.a.id===infraAnchor.id);assert(infra);assert.equal(infra.others.length,infraAliases.length);
 assert.equal(groups.filter(s=>[s.a,...s.others].some(a=>a.id==='addition-0')).length,1);
 assert.equal(groups.find(s=>[s.a,...s.others].some(a=>a.id==='addition-0')).others.length,additionTitles.length-1);
 assert(groups.some(s=>s.a.id===comparison.id&&s.others.length===0));
 assert.equal(new Set(groups.flatMap(s=>[s.a,...s.others]).map(a=>a.id)).size,input.length);
}
function compressStoryCoverageForTest(input){return compressFlowTopics(groupStories(input));}
for(const title of [
 "한화운용, 'PLUS 미국AI전력인프라액티브' ETF 신규 상장",
 '한화운용, AI 데이터센터 인프라 ETF 25일 상장',
 '한화운용, AI 데이터센터 인프라 ETF 신규 상장 연기',
 '한화운용, AI 데이터센터 인프라 ETF 레버리지 출시',
])assert.equal(groupStories([infraAnchor,syndication('infra-other',title,'신규 상장').a]).length,2,title);
const competingInfra={...infraAnchor,id:'infra-competitor',url:'https://example.com/infra-competitor',title:infraAnchor.title.replace('글로벌','미국'),summary:infraAnchor.summary.replace('글로벌','미국')};
assert.equal(groupStories([infraAnchor,competingInfra,infraAliases[1]]).length,3,'a generic launch cannot bridge two compatible named products');
for(const title of [
 '삼성운용, KODEX 미국AI반도체액티브 ETF에 앤트로픽 편입',
 '삼성운용, 미국AI에이전트액티브 ETF 앤트로픽 비중 축소',
 '삼성운용, 美 AI ETF에 앤트로픽 20.4% 편입',
])assert.equal(groupStories([...additionTitles,syndication('addition-other',title,'상품·전략').a]).length>=2,true,title);
const competingAddition={...additionTitles[0],id:'addition-competitor',url:'https://example.com/addition-competitor',title:additionTitles[0].title.replace('미국AI에이전트','글로벌AI에이전트')};
const ambiguousAddition=groupStories([additionTitles[0],competingAddition,additionTitles[3]]);
assert.equal(ambiguousAddition.length,3,'generic constituent addition cannot select an arbitrary fund');
const recentFixture=process.env.NEWS_SYNDICATION_FIXTURE;
if(recentFixture){
 const articles=JSON.parse(fs.readFileSync(recentFixture,'utf8')).articles;
 for(const input of [articles,[...articles].reverse(),[...articles].sort(compareImportance)]){
  const groups=compressStoryCoverageForTest(input);
  const infra=groups.filter(s=>[s.a,...s.others].some(a=>a.id==='35c870b6317bbdd730129498a4b5949def631b915b3e253931a0791d6fa6d1eb'));
  assert.equal(infra.length,1);assert.equal(infra[0].a.summaryKind,'summary');assert.equal(infra[0].others.length,16);
  const samsung=groups.filter(s=>[s.a,...s.others].some(a=>a.id==='af0df20416474bfb37aac52d8aef7d417f4f5087b57fe5054bef3e35e6eccb31'));
  assert.equal(samsung.length,1);assert.equal(samsung[0].others.length,11);
  assert(!samsung[0].others.some(a=>a.id==='bd93fe535cfea1945e77979dd6917384cf7c0f9648468244df8ff9e951f05f5f'));
  const before=new Set(articles.map(a=>a.url)),after=new Set(groups.flatMap(s=>[s.a,...s.others]).map(a=>a.url));assert.deepEqual(after,before);
 }
 console.log('LIVE EDITION: 17 infrastructure launch reports and 12 constituent-addition reports each appear once; all source URLs and strategy comparisons retained across three sort orders');
}
console.log('PASS: single-fund launch and constituent-addition syndication, quoted/brandless/descriptive titles, verified representative, ambiguous products, dates, weights and comparisons');
