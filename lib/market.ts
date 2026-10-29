import type {Article} from './news';
export type MarketScope='domestic'|'overseas'|'mixed'|'unknown';
export const marketLabels:Record<MarketScope,string>={domestic:'국내 상장',overseas:'해외 상장',mixed:'국내·해외 공통',unknown:'상장 시장 미확인'};
// Listing venue, not underlying assets or publisher nationality.
// Use specific evidence; ambiguous ETF stories stay unclassified.
export function marketScope(article:Pick<Article,'title'|'summary'|'summaryKind'|'marketHint'>):MarketScope{
 const text=article.title+' '+(article.summaryKind==='title_translation'?'':article.summary||'');
 const domesticFund=/\b(?:ACE|TIGER|KODEX|RISE|HANARO|KIWOOM|TIMEFOLIO|KoAct|1Q)\b/.test(text)||/\b(?:SOL|PLUS)\s*[가-힣]/.test(text)||/국내\s*상장|한국거래소|KRX|코스피\s*200|코스닥\s*150|코리아배당|고배당주Plus/.test(text);
 const overseasFund=/\b(?:IBIT|FBTC|GBTC|ETHA|ETHE|QQQ|QQQM|SPY|SPLG|VOO|VTI|SCHD|SCHG|JEPI|JEPQ|TSLL|TSLT|NVDL|NVDU|SPXL|SOXL|SOXS|TQQQ|SQQQ)\b/i.test(text)||/(?:미국|유럽|일본|홍콩|중국|런던|뉴욕).{0,12}(?:증시.{0,6})?상장|해외\s*상장|미국\s*(?:증시에|시장에)\s*상장/.test(text);
 if(domesticFund&&overseasFund)return 'mixed';
 if(domesticFund)return 'domestic';
 if(overseasFund)return 'overseas';
 const domesticContext=/국내\s*(?:ETF|액티브)|금감원|금융감독원|금융위원회|금융투자협회|증권업계|교육세|한국\s*ETF|(?:삼성|미래에셋|한국투자|한화|키움|신한|KB|케이비|NH아문디)\s*(?:자산운용|운용)|은행신탁|퇴직연금|국민연금|국정감사|국감|대통령실|청와대/.test(text);
 const overseasContext=/(?:미국|유럽|일본|홍콩|중국)\s*(?:현물\s*)?ETF|블랙록|뱅가드|피델리티|반에크|그레이스케일|아크인베스트|NYSE|SEC|미\s*증권거래위원회|뉴욕증시/.test(text);
 if(domesticContext&&overseasContext)return 'mixed';
 if(domesticContext)return 'domestic';
 if(overseasContext||article.marketHint==='overseas')return 'overseas';
 return 'unknown';
}
