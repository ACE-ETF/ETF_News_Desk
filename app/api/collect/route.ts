import {collect} from "../../../lib/news";
import {env} from 'cloudflare:workers';
export async function POST(request:Request){
 const expected=(env as unknown as {COLLECTOR_KEY?:string}).COLLECTOR_KEY;
 const supplied=request.headers.get('X-Collector-Key')||'';
 if(!expected||!supplied)return Response.json({error:'자동 수집 전용 경로입니다.'},{status:403});
 const bytes=(s:string)=>crypto.subtle.digest('SHA-256',new TextEncoder().encode(s));
 const [a,b]=await Promise.all([bytes(expected),bytes(supplied)]);
 const aa=new Uint8Array(a),bb=new Uint8Array(b);let diff=0;for(let i=0;i<aa.length;i++)diff|=aa[i]^bb[i];
 if(diff)return Response.json({error:'자동 수집 전용 경로입니다.'},{status:403});
 try{return Response.json(await collect())}catch(e){console.error("ETF collection failed",e);return Response.json({error:"뉴스 피드에 연결하지 못했습니다. 잠시 후 다시 시도해 주세요. 기존 기사는 유지됩니다."},{status:502})}
}
