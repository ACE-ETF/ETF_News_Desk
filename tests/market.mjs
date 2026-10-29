import ts from 'typescript';import fs from 'node:fs';import assert from 'node:assert/strict';
const insightJS=ts.transpileModule(fs.readFileSync('lib/insights.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext}}).outputText;const insightURL='data:text/javascript;base64,'+Buffer.from(insightJS).toString('base64');
const js=ts.transpileModule(fs.readFileSync('lib/market.ts','utf8').replaceAll('./insights',insightURL),{compilerOptions:{module:ts.ModuleKind.ESNext}}).outputText;
const {marketScope,inMarketView,isSharedInsight,marketOrder,marketGroupMatches}=await import('data:text/javascript;base64,'+Buffer.from(js).toString('base64'));
const check=(title,expected,summary)=>assert.equal(marketScope({title,summary}),expected,title);
check('ACE 미국S&P500 ETF 신규 상장','domestic');
check('KODEX 미국나스닥100 ETF 분배금 지급','domestic');
check('TIGER 일본반도체 ETF 순자산 증가','domestic');
check('SCHD만 상승…나스닥 ETF 약세','overseas');
check('블랙록 비트코인 ETF 순유입 확대','overseas');
check('SK하이닉스 레버리지 ETF 청산','overseas','미국에 상장된 SK하이닉스 레버리지 ETF가 청산한다.');
check('미국에 상장된 한국 반도체 ETF','overseas');
check('ACE 미국S&P500과 SPY ETF 비교','mixed');
check('금감원 ETF 이벤트 규제','domestic');
check('증권업계 교육세, ETF 투자자 부담','domestic');
check('새로운 액티브 ETF 전략 등장','unknown');
check('XRP ETF 자산 감소','unknown');
console.log('PASS: listing venue vs underlying assets, foreign ticker, Korean issuer, mixed and unknown evidence');

assert.equal(marketScope({title:'Vanguard launches a new bond ETF',marketHint:'overseas'}),'overseas');
assert.equal(marketScope({title:'New ETF attracts assets',marketHint:'overseas'}),'overseas');
assert.equal(marketScope({title:'KODEX 미국S&P500 ETF',marketHint:'overseas'}),'domestic');

const keywordJS=ts.transpileModule(fs.readFileSync('lib/keywords.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext}}).outputText;
const {isAceStory}=await import('data:text/javascript;base64,'+Buffer.from(keywordJS).toString('base64'));
assert(isAceStory({title:'ACE 미국S&P500 ETF 출시',brands:[]}));
assert(isAceStory({title:'한국투자신탁운용, ETF 신규 상장',brands:[]}));
assert(!isAceStory({title:'한국투자증권 ETF 서비스 출시',brands:[]}));
assert(!isAceStory({title:'KODEX 미국 ETF 분배금 지급',brands:['KODEX']}));

assert.equal(marketScope({title:'SOL Gains Ground Despite Solana ETF Outflows',marketHint:'overseas',summaryKind:'title_translation',summary:'SOL 가격, 솔라나 ETF 자금 유출에도 상승'}),'overseas');

// Domestic institutions and services do not identify the underlying investment country.
for(const title of [
 '하나자산운용, 월분배 전환 2세대 채권혼합형 ETF 분배금 지급',
 '한국투자신탁운용, 미국 대표지수 ETF 출시',
 '한투운용, ETF 수익률 1위',
 '브이아이운용, 스페이스X ETF 출시',
 '우리자산운용, 반도체 ETF 순자산 증가',
 '키움증권, 영웅문S# ETF 스마트 검색 도입',
 '키움證, ETF 스마트 검색 도입',
 '증권사, ETF 등 판매 때 현금 이벤트 앞으로 못한다',
 '상금 노린 ETF 거래 폭증…증권사 현금 이벤트 제동',
 '은행 신탁부터 레버리지까지…ETF 관리 범위 넓히는 당국',
 '경찰, 단일 레버리지 ETF 책임 李대통령 고발건 수사 착수',
 'ETF 상관계수 미달 공시 전년비 11배',
 'ETF 상장 수요는 넘치는데...거래소 4년 7개월 만에 1명 보강',
 '메모리 반도체 강세 타고…개미들 PLUS HBM ETF에 5900억',
 'SOL AI반도체 ETF 상장',
 'ACE미국S&P500 ETF',
])check(title,'domestic');
check('美 비트코인 ETF 전날 1.7억弗 순유입','overseas');
check('리플 XRP ETF 자산 2억 달러 감소','overseas');
check('솔라나 ETF, SOL $100 유지','overseas');
check('키움증권, 미국에 상장된 QQQ ETF 매매 서비스','overseas');
check('하나자산운용, 미국에 상장된 ETF 투자 확대','overseas');
check('한국 ETF와 블랙록 ETF 비교','mixed');
check('삼성운용, 미국 ETF 투자 전략','domestic');
check('새로운 액티브 ETF 전략 등장','unknown');
check('반도체 ETF 반등, 해외 투자 관심','unknown');
check('SOL Gains Ground Despite Solana ETF Outflows','unknown');
check('PLUS ETF research expands globally','unknown');
console.log('PASS: Korean issuer aliases, brokerage services, domestic policy, PLUS HBM, crypto currency evidence, uncertain evidence retained');

const common={title:'프런티어AI, 앤트로픽 담은 ETF'};assert(isSharedInsight(common));for(const view of ['domestic','overseas','all'])assert(inMarketView(common,view));
const unclear={title:'새로운 액티브 ETF 상품 안내'};assert(!isSharedInsight(unclear));assert(inMarketView(unclear,'all'));assert(!inMarketView(unclear,'domestic'));assert(!inMarketView(unclear,'overseas'));
assert(!inMarketView({title:'VOO ETF 신규 상장'},'domestic'));assert(!inMarketView({title:'ACE 미국S&P500 ETF'},'overseas'));
console.log('PASS: shared insight in both views without relabeling listing venue; unknown products retained in all');

assert(marketOrder({title:'ACE 미국S&P500 ETF'})<marketOrder({title:'VOO ETF'}));assert(marketOrder(common)<marketOrder({title:'VOO ETF'}));assert(marketOrder(unclear)>marketOrder({title:'VOO ETF'}));
console.log('PASS: all-market order domestic listing, shared insights, overseas, unresolved');

assert(marketGroupMatches({a:{title:'하준경, 레버리지 ETF에 송구'},others:[{title:'하준경 정책실장, 청와대 국감에서 레버리지 ETF 사과'}]},'domestic'));
console.log('PASS: determine market from the whole event group, retaining unclassified related reports');

assert(isAceStory({title:'일반 ETF의 운용 구조 논란',summary:'ACE 테슬라밸류체인액티브의 편입 구조를 다룬 보도.',summaryKind:'summary'}));
assert(!isAceStory({title:'General ETF news',summary:'ACE ETF 관련 기사',summaryKind:'title_translation'}));
const brandsJS=ts.transpileModule(fs.readFileSync('lib/verified-brands.ts','utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText;
const {articleBrands}=await import('data:text/javascript;base64,'+Buffer.from(brandsJS).toString('base64'));
assert.deepEqual(articleBrands({id:'test',title:'일반 ETF의 운용 구조 논란',brands:[],summary:'ACE 상품 편입에 관한 확인된 요약',summaryKind:'summary'}),['ACE']);
assert.deepEqual(articleBrands({id:'test',title:'General ETF news',brands:[],summary:'ACE ETF 관련 기사',summaryKind:'title_translation'}),[]);
assert.deepEqual(articleBrands({id:'647507794034032f9b7a92d9d2d3eb942223855d0fb36fd1c9155c545533fa69',title:'일반 ETF 속에 3배 레버리지…꼼수 운용 논란',brands:[]}),['ACE']);
console.log('PASS: verified excerpt and summary brand evidence; translations cannot invent brand membership');

assert.equal(marketScope({title:'일반 ETF 속에 3배 레버리지…꼼수 운용 논란',brands:['ACE']}),'domestic');
