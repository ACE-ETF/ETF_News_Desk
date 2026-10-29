import type {Article} from './news';
// Editorial signals describe why to read a story, independently of its listing venue.
export function insightKind(a:Pick<Article,'title'>):string{
 const t=a.title;
 if(!/ETF|상장지수펀드|exchange.traded fund/i.test(t))return '';
 if(/산업(?:재|분류).*이동|업종.*(?:재분류|분류.*변경)|지수.*(?:개편|재편|편입|편출|변경)|(?:편입|편출).*지수|ETF.*(?:리밸런싱|편입.*변화)|index.*(?:reclassif|rebalanc|reconstitut)/i.test(t))return '지수·편입 변화';
 if(/비상장|프런티어|(?:앤트로픽|앤스로픽|Anthropic).*(?:담은|편입)|private.market|pre.IPO|private.equity/i.test(t))return '투자 아이디어';
 if(/순환매|업종.*차별화|반도체.*주춤.*(?:뷰티|화장품)|섹터.*(?:교체|전환)|sector rotation/i.test(t))return '산업·업종 변화';
 if(/글로벌|세계|global/i.test(t)&&/운용자산|운용사|시장.*\d+위|경쟁.*구도|asset manager/i.test(t))return '운용업계 분석';
 if(/오피니언|칼럼|기고|기자수첩|기자의\s*눈|역설|투자\s*아이디어|투자\s*전략|포트폴리오|자산배분|opinion|portfolio|asset allocation/i.test(t))return '오피니언·전략';
 return '';
}

// Confirmed source date differs from the RSS timestamp; preserve the feed record but label it.
export function sourceDateNote(a:Pick<Article,'id'|'title'>){return a.id==='359c0513c1ac9dab98344aa3bedb9bfe1913daab67c576d46bf9cf32568b9dfe'&&/화장품 ETF/.test(a.title)?'2026-08-26':''}
