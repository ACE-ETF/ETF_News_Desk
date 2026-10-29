import type { Article } from './news';
import {isNewListing} from './classify';
export type Importance={score:number;level:'상'|'중'|'일반';reasons:string[]};
// Transparent editorial rules using headlines only; no inference about article bodies.
export function importance(a:Pick<Article,'title'|'category'>):Importance{
 const t=a.title;let score=15;const reasons:string[]=[];
 const add=(value:number,reason:string)=>{score+=value;reasons.push(reason)};
 if(/\b(?:SEC|regulat\w*|legislation|tax rules?)\b|제도|규제|금융위|금감원|금융당국|법안|과세|세제|세금|퇴직연금.*(?:허용|확대|편입|한도)|투자한도/i.test(t))add(45,'제도·투자 가능 범위');
 if(/\b(?:liquidat\w*|closures?|delist\w*|trading halt|tracking error)\b|상장폐지|거래정지|청산|괴리율|추적오차|유동성.*(?:위기|부족)/i.test(t))add(50,'운용·거래 위험');
 if(isNewListing(t))add(32,'신상품·신규 상장');
 // Distribution signals are mutually exclusive: routine notices must not stack with special payouts.
 if(/분배금.*(?:삭감|중단|축소|급감)|배당.*(?:삭감|중단)/.test(t))add(50,'배당·분배 지급 위험');
 else if(/분배.*정책.*(?:변경|전환)|배당.*정책.*(?:변경|전환)/.test(t))add(30,'배당·분배 정책 변경');
 else if(/특별\s*배당|특별\s*분배/.test(t))add(28,'특별배당·특별분배');
 else if(/분배금|분배율|분배락|배당락|배당\s*정책|중간\s*배당/.test(t))add(3,'정기 배당·분배 안내');
 if(/\b(?:fee cuts?|fee reductions?|expense ratio)\b|총보수|보수.*(?:인하|경쟁)|수수료.*(?:인하|경쟁)|지수.*변경/i.test(t))add(35,'상품 조건·비용 변화');
 if(/\b(?:inflows?|outflows?|net assets|AUM|assets under management)\b|자금.*(?:유입|유출)|순매수|순매도|순유입|순유출|순자산|자금.*쏠림/i.test(t))add(20,'수급·시장 규모');
 if(/(?:\d[\d,.]*\s*조\s*(?:원|돌파|육박|넘|유입)|[1-9]\d{3,}\s*억|[1-9](?:,\d{3})+\s*억)/.test(t)&&/순자산|순매수|순유입|자금|유입|유출/.test(t))add(15,'조 단위·천억원대 수급 신호');
 if(/최초|유일|독점|신규.*전략|새로운.*전략/.test(t)&&isNewListing(t))add(8,'신상품 차별화 표현');
 if(/수익률|성과|수익.*돌파/.test(t)&&reasons.length===0)add(8,'성과 동향');
 if(/이벤트|경품|증정|프로모션|표창|수상|캠페인|세미나/.test(t)){score-=22;reasons.push('행사·홍보성 제목 감점')}
 score=Math.max(0,Math.min(100,score));return {score,level:score>=60?'상':score>=35?'중':'일반',reasons:reasons.length?reasons:['일반 상품·전략 동향']};
}
export function compareImportance(a:Article,b:Article){return importance(b).score-importance(a).score||b.published.localeCompare(a.published)||a.id.localeCompare(b.id)}
