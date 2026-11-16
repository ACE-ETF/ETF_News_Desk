/** Public static data on GitHub Pages; the existing Sites app keeps its API path. */
export function newsReadUrl(kind:'news'|'collection-status',date=''){
 const staticBase=document.querySelector<HTMLMetaElement>('meta[name="etf-static-data"]')?.content;
 if(staticBase){
  const base=staticBase.replace(/\/$/,'');
  return kind==='collection-status'?base+'/collection-status.json':date?base+'/days/'+encodeURIComponent(date)+'.json':base+'/latest.json';
 }
 const api=document.querySelector<HTMLMetaElement>('meta[name="etf-api-base"]')?.content||'';
 return api+'/api/'+kind+(date?'?date='+encodeURIComponent(date):'');
}
