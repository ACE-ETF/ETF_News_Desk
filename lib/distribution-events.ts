import type {Article} from './news';
type Payout={article:Article;base:string;funds:'pair'|'sp500'|'nasdaq100'|'generic';values:number[];sp?:number;nas?:number;payday?:string};
function payout(a:Article):Payout|undefined{
 const t=a.title,text=t+' '+(a.summaryKind==='title_translation'?'':a.summary||'');
 if(!/분배금|분배락|분배/.test(t)||!/KODEX|삼성(?:자산)?운용/.test(text))return;
 // Different share classes and strategies cannot inherit this broad-index announcement.
 if(/커버드콜|환헤지|\(H\)|레버리지|인버스|선물|\bTR\b/i.test(t))return;
 const sp=/S&P\s*500/i.test(text),nas=/나스닥\s*100/i.test(text),generic=/미국\s*(?:대표\s*)?지수|미국\s*대표지수/.test(text);
 if(!sp&&!nas&&!generic)return;
 const month=t.match(/(\d{1,2})월/)?.[1]?.padStart(2,'0')||a.date.slice(5,7);
 const event=/중단|미지급/.test(t)?'suspend':/삭감|축소/.test(t)?'cut':/정책.*변경|정정|연기/.test(t)?'change':'payout';
 const values=[...text.matchAll(/(\d[\d,]*)\s*원/g)].map(m=>Number(m[1].replace(/,/g,'')));
 const funds=sp&&nas?'pair':sp?'sp500':nas?'nasdaq100':'generic';
 const spFirst=text.search(/S&P\s*500/i)<text.search(/나스닥\s*100/i);
 return {article:a,base:[a.date,a.date.slice(0,4)+'-'+month,event].join(':'),funds,values,
  ...(funds==='pair'&&values.length>=2?{sp:values[spFirst?0:1],nas:values[spFirst?1:0]}:{}),
  payday:t.match(/(\d{1,2})일\s*(?:지급|분배금\s*지급)/)?.[1]};
}
// A combined announcement anchors generic headlines and individual-fund excerpts.
// Without that evidence the S&P500 and Nasdaq100 products remain separate.
export function distributionEventKeys(articles:Article[]):Map<string,string>{
 const items=articles.map(payout).filter((x):x is Payout=>!!x),keys=new Map<string,string>();
 for(const item of items){
  const anchors=items.filter(x=>x.base===item.base&&x.funds==='pair');
  const paydays=[...new Set(anchors.map(x=>x.payday).filter(Boolean))];
  const candidates=anchors.filter(x=>!item.payday||!x.payday||item.payday===x.payday);
  const amounts=[...new Map(candidates.filter(x=>x.sp!==undefined&&x.nas!==undefined).map(x=>[x.sp+','+x.nas,{sp:x.sp!,nas:x.nas!}])).values()];
  const compatible=amounts.filter(x=>item.funds==='pair'?(item.sp===undefined||item.sp===x.sp&&item.nas===x.nas):item.funds==='sp500'?(!item.values.length||item.values[0]===x.sp):item.funds==='nasdaq100'?(!item.values.length||item.values[0]===x.nas):item.values.every(n=>n===x.sp||n===x.nas));
  const dateUnambiguous=!!item.payday||paydays.length<=1;
  if(candidates.length&&dateUnambiguous&&(compatible.length===1||!amounts.length)){
   const known=compatible[0];keys.set(item.article.id,'kodex-us-index-announcement:'+item.base+':'+(item.payday||paydays[0]||'?')+':'+(known?known.sp+','+known.nas:'?'));
  }else keys.set(item.article.id,'kodex-distribution:'+item.base+':'+item.funds+':'+(item.payday||'?')+':'+item.values.join(','));
 }
 return keys;
}
