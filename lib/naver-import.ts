export type NaverImportItem={title:string;url:string;source:string;published:string};
export function validNaverItems(value:unknown,window:{start:number;end:number}):value is NaverImportItem[]{
 if(!Array.isArray(value)||value.length<1||value.length>10)return false;
 return value.every(a=>{
  if(!a||typeof a.title!=='string'||a.title.trim().length<10||a.title.length>400||typeof a.source!=='string'||!a.source.trim()||a.source.length>80||typeof a.published!=='string'||!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(a.published))return false;
  const t=Date.parse(a.published);if(!Number.isFinite(t)||t<window.start||t>=window.end)return false;
  try{const u=new URL(a.url);return u.protocol==='https:'&&u.hostname==='n.news.naver.com'&&/^\/mnews\/article\/\d{3}\/\d+$/.test(u.pathname)&&!u.username&&!u.password&&!u.port}catch{return false}
 });
}
