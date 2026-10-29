import type {Article} from './news';

// A reviewed public search excerpt supplied by the user explicitly names ACE
// 테슬라밸류체인액티브. This is brand evidence only, not a verified full-body summary.
const reviewedBrands:Record<string,string[]>={
 '647507794034032f9b7a92d9d2d3eb942223855d0fb36fd1c9155c545533fa69':['ACE'],
};
export function articleBrands(a:Pick<Article,'id'|'title'|'brands'> & Partial<Pick<Article,'summary'|'summaryKind'>>){
 const evidence=a.title+' '+(a.summaryKind==='summary'?a.summary||'':'');
 const brands=['ACE','TIGER','KODEX','RISE','SOL','PLUS','HANARO','KIWOOM','TIMEFOLIO','KoAct','1Q'].filter(b=>new RegExp('\\b'+b+'\\b','i').test(evidence));
 if(/한국투자(?:신탁)?운용/.test(evidence)&&/ETF|상장지수펀드/i.test(evidence))brands.push('ACE');
 return [...new Set([...(a.brands||[]),...brands,...(reviewedBrands[a.id]||[])])];
}
