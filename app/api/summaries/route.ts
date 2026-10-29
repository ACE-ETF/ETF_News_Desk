import {env} from 'cloudflare:workers';
import {readDay} from '../../../lib/news';
export async function POST(r:Request){
 const runtime=env as unknown as {BUCKET:R2Bucket;COLLECTOR_KEY?:string};
 const key=r.headers.get('X-Collector-Key');if(!key||!runtime.COLLECTOR_KEY||key!==runtime.COLLECTOR_KEY)return Response.json({error:'인증 필요'},{status:403});
 const body=await r.json() as {items?:{id:string;date:string;text:string;sourceUrl:string}[]};
 if(!Array.isArray(body.items)||body.items.length>10)return Response.json({error:'최대 10개 요약만 저장할 수 있습니다.'},{status:400});
 const valid:Record<string,{text:string;sourceUrl:string}>={};const byDate=new Map<string,Set<string>>();
 for(const item of body.items){if(!/^\d{4}-\d{2}-\d{2}$/.test(item.date)||typeof item.text!=='string'||item.text.length<15||item.text.length>280||!/^https:\/\//.test(item.sourceUrl))return Response.json({error:'요약 형식 오류'},{status:400});if(!byDate.has(item.date))byDate.set(item.date,new Set((await readDay(item.date)).map(a=>a.id)));if(!byDate.get(item.date)!.has(item.id))return Response.json({error:'기사 ID 오류'},{status:400});valid[item.id]={text:item.text.trim(),sourceUrl:item.sourceUrl}}
 const b=runtime.BUCKET;for(let i=0;i<4;i++){const old=await b.get('brief-summaries.json');const previous=old?await old.json() as typeof valid:{};const merged=Object.fromEntries(Object.entries({...previous,...valid}).slice(-2000));const saved=await b.put('brief-summaries.json',JSON.stringify(merged),{onlyIf:old?{etagMatches:old.etag}:{etagDoesNotMatch:'*'},httpMetadata:{contentType:'application/json'}});if(saved)return Response.json({saved:Object.keys(valid).length})}return Response.json({error:'동시 저장 충돌'},{status:409})
}
