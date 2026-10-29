import type {Article} from './news';
// Headline-only topic labels; keep labels neutral rather than inventing conclusions.
export function issueKeywords(a:Pick<Article,'title'|'category'> & {brands?:string[]}){
 const t=a.title;
 const subjects:[RegExp,string][]=[[/교육세/,'교육세'],[/레버리지/i,'레버리지 ETF'],[/HBM/i,'HBM 반도체 ETF'],[/반도체/,'반도체 ETF'],[/S&P\s*500|나스닥\s*100/i,'미국 대표지수 ETF'],[/TIGER\s*200/i,'TIGER 200'],[/코스닥\s*150/,'코스닥150 ETF'],[/금감원|금융위|금융당국/,'금융당국'],[/삼성전자/,'삼성전자'],[/퇴직연금|IRP|연금/,'연금 ETF'],[/비트코인|이더리움|XRP|솔라나/,'가상자산 ETF']];
 const events:[RegExp,string][]=[[/교육세/,'투자자 부담 논의'],[/상장폐지|거래정지|청산/,'청산·거래 이슈'],[/특별\s*배당|특별\s*분배/,'특별배당'],[/분배금.*(?:삭감|중단|축소)/,'분배금 변화'],[/이벤트.*(?:금지|규제)|금지령/,'마케팅 규제'],[/보수|수수료/,'보수 경쟁'],[/순매수|순유입|자금.*유입|자금유입/,'자금 유입'],[/순매도|순유출|자금.*유출/,'자금 유출'],[/순자산/,'순자산 변화'],[/신규\s*상장|출시/,'신상품'],[/분배금|분배율|분배락|배당락/,'분배금 안내'],[/제도|규제|과세|세제|법안/,'제도 변화'],[/수익률|성과/,'성과 동향']];
 const subject=subjects.find(([p])=>p.test(t))?.[1]||(/운용사|자산운용/.test(t)?'자산운용업계':a.brands?.[0]?a.brands[0]+' ETF':'ETF 시장');
 const event=events.find(([p])=>p.test(t))?.[1]||a.category;
 return {subject,event,label:subject+' · '+event};
}
