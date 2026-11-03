import {insightKind} from './insights';
import type {Article} from './news';
export type MarketScope='domestic'|'overseas'|'mixed'|'unknown';
export const marketLabels:Record<MarketScope,string>={domestic:'국내 상장',overseas:'해외 상장',mixed:'국내·해외 공통',unknown:'상장 시장 미확인'};
// Listing venue, not underlying assets, article language or publisher nationality.
// Strong fund/venue evidence wins over issuer/service context; uncertain stories stay unknown.
export function marketScope(article:Pick<Article,'title'|'summary'|'summaryKind'|'marketHint'> & {brands?:string[]}):MarketScope{
 const text=article.title+' '+(article.summaryKind==='title_translation'?'':article.summary||'');
 const korean=/[가-힣]/.test(text);
 const domesticFund=(korean&&article.brands?.includes('ACE'))||/\b(?:ACE|TIGER|KODEX|RISE|HANARO|KIWOOM|TIMEFOLIO|KoAct|1Q)\b/.test(text)||/\b(?:SOL|PLUS)\s*[가-힣]/.test(text)||(korean&&/\b(?:SOL|PLUS)\s+(?:HBM|AI|S&P\s*500|200|100|TOP\s*\d|미국|글로벌)/.test(text))||/국내\s*상장|한국거래소|KRX|코스피\s*200|코스닥\s*150|코리아배당|고배당주Plus/.test(text);
 const overseasFund=/\b(?:IBIT|FBTC|GBTC|ETHA|ETHE|QQQ|QQQM|SPY|SPLG|VOO|VTI|SCHD|SCHG|JEPI|JEPQ|TSLL|TSLT|NVDL|NVDU|SPXL|SOXL|SOXS|TQQQ|SQQQ)\b/i.test(text)||/(?:미국|유럽|일본|홍콩|중국|런던|뉴욕|美)\s*(?:증시|거래소|시장)?(?:에|에서)\s*상장|(?:미국|유럽|일본|홍콩|중국|런던|뉴욕|美)\s*(?:증시|거래소|시장)\s*상장|해외\s*상장/.test(text);
 const koreanListing = /Korea Exchange|\blisted in (?:South )?Korea\b|\bKorea-listed\b/i.test(text);
 const overseasListing = /\b(?:NYSE Arca|Cboe BZX|Toronto Stock Exchange|Abu Dhabi Securities Exchange)\b|\blisted (?:in|on) (?:the )?(?:U\.S\.|US|Nasdaq|NYSE)\b|(?:아부다비|대만|캐나다|호주|싱가포르).{0,10}(?:교차\s*)?상장/i.test(text);
 const crossListing = /교차\s*상장|cross[- ]list/i.test(text);
 if (crossListing && (overseasListing || overseasFund)) return 'mixed';
 if (overseasListing && !domesticFund && !koreanListing) return 'overseas';
 if (koreanListing && !overseasFund) return 'domestic';
 // A Korean issuer or Korean retirement account can be named in English coverage.
 if (!overseasFund && !overseasListing && /Korea Investment (?:Management|Trust Management)|Hana Securities|Kiwoom (?:Asset Management|Securities)|Korea Financial Services Commission/i.test(text)) return 'domestic';
 if(domesticFund&&overseasFund)return 'mixed';
 if(domesticFund)return 'domestic';
 if(overseasFund)return 'overseas';
 const domesticIssuer=/(?:삼성|미래에셋|한국투자(?:신탁)?|한투|한화|키움|신한|KB|케이비|NH아문디|엔에이치아문디|하나|우리|브이아이|타임폴리오|유리|현대|대신|BNK|비엔케이|IBK|아이비케이|흥국|마이다스|트러스톤|신영|다올|에셋플러스)\s*(?:자산운용|운용)/.test(text);
 const domesticBroker=/(?:키움|삼성|미래에셋|한국투자|한투|신한(?:투자)?|KB|케이비|NH투자|엔에이치투자|하나|우리투자|대신|한화투자|유안타|유진투자|현대차|교보|DB|아이엠)\s*(?:증권|證)|영웅문S?/.test(text);
 const domesticPolicy=/금감원|금융감독원|금융위원회|금융위|금융투자협회|금투협|증권업계|교육세|은행\s*신탁|퇴직연금|국민연금|국정감사|국감|대통령실|청와대|(?:이재명|李)\s*대통령|삼전·닉스|공수처/.test(text)||/ETF.*(?:거래소.*(?:인력|보강)|상관계수\s*미달\s*공시)|증권사.*(?:현금|거래액)\s*이벤트|(?:현금|거래액)\s*이벤트.*(?:제동|금지|증권사)/.test(text);
 const domesticContext=domesticIssuer||domesticBroker||domesticPolicy||/국내\s*(?:ETF|액티브)|한국\s*(?:ETF|선)|미래에셋[,，]/.test(text);
 const foreignInstitution=/블랙록|뱅가드|피델리티|반에크|그레이스케일|아크인베스트|NYSE|SEC|미\s*증권거래위원회|뉴욕증시/.test(text);
 const foreignCrypto=/(?:비트코인|이더리움|솔라나|리플|BTC|ETH|XRP).{0,18}ETF|ETF.{0,18}(?:비트코인|이더리움|솔라나|리플|BTC|ETH|XRP)/i.test(text)&&/(?:미국|유럽|홍콩|美)|달러|\$|弗/.test(text);
 if(domesticContext&&foreignInstitution)return 'mixed';
 if(domesticContext)return 'domestic';
 if(foreignInstitution||foreignCrypto||/(?:미국|유럽|일본|홍콩|중국|美)\s*(?:현물\s*)?ETF/.test(text)||article.marketHint==='overseas')return 'overseas';
 return 'unknown';
}

export type MarketView='all'|'domestic'|'overseas';
export function isSharedInsight(article:Pick<Article,'title'|'summary'|'summaryKind'|'marketHint'> & {brands?:string[]}){
 const scope=marketScope(article);return !!insightKind(article)&&(scope==='mixed'||scope==='unknown');
}
export function inMarketView(article:Pick<Article,'title'|'summary'|'summaryKind'|'marketHint'> & {brands?:string[]},view:MarketView){return view==='all'||marketScope(article)===view||isSharedInsight(article)}

export function marketOrder(a:Pick<Article,'title'|'summary'|'summaryKind'|'marketHint'> & {brands?:string[]}){const scope=marketScope(a);return scope==='domestic'?0:isSharedInsight(a)?1:scope==='overseas'?2:3}

export function storyMarketScope(story:{a:Article;others:Article[]}):MarketScope {
 const representative = marketScope(story.a);
 if (representative !== 'unknown') return representative;
 const scopes = new Set(story.others.map(marketScope).filter(scope => scope !== 'unknown'));
 if (scopes.size > 1) return 'mixed';
 return Array.from(scopes)[0] || 'unknown';
}

export function marketGroupMatches(story:{a:Article;others:Article[]},view:MarketView) {
 if (view === 'all') return true;
 const scope = storyMarketScope(story);
 return scope === view || scope === 'mixed' ||
  (scope === 'unknown' && [story.a,...story.others].some(isSharedInsight));
}
