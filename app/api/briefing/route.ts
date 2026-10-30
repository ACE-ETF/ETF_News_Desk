import {env} from 'cloudflare:workers';
import {getNews} from '../../../lib/news';
import {validBriefing} from '../../../lib/daily-briefing';
export async function POST(r:Request){
 const runtime=env as unknown as {BUCKET:R2Bucket;COLLECTOR_KEY?:string};
 if(!runtime.COLLECTOR_KEY||r.headers.get('X-Collector-Key')!==runtime.COLLECTOR_KEY)return Response.json({error:'인증 필요'},{status:403});
 let input:unknown;try{input=await r.json()}catch{return Response.json({error:'JSON 형식 오류'},{status:400})}
 const data=await getNews();
 if(!validBriefing(input,data.window,new Set(data.articles.map(a=>a.id))))return Response.json({error:'수집 구간·내용·기사 연결을 확인해 주세요.'},{status:400});
 await runtime.BUCKET.put('briefings/'+data.window.end+'.json',JSON.stringify(input),{httpMetadata:{contentType:'application/json'}});
 return Response.json({saved:true,window:data.window});
}
