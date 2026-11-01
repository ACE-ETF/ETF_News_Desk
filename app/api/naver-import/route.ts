import {env} from 'cloudflare:workers';
import {collectionWindow,importNaverArticles} from '../../../lib/news';
import {validNaverItems} from '../../../lib/naver-import';
export async function POST(r:Request){
 const runtime=env as unknown as {COLLECTOR_KEY?:string};
 if(!runtime.COLLECTOR_KEY||r.headers.get('X-Collector-Key')!==runtime.COLLECTOR_KEY)return Response.json({error:'인증 필요'},{status:403});
 const body=await r.json().catch(()=>null) as {items?:unknown}|null;
 const window=collectionWindow();
 if(!validNaverItems(body?.items,window))return Response.json({error:'네이버 기사 URL·발행 시각·현재 수집 구간을 확인해 주세요.'},{status:400});
 try{return Response.json(await importNaverArticles(body!.items,window))}catch{return Response.json({error:'보완 기사 저장 실패. 기존 기사는 유지됩니다.'},{status:500})}
}
