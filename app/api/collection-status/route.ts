import {collectionHealth} from '../../../lib/pipeline';
import {publicNewsHeaders} from '../../../lib/public-news-cors';
export async function GET(r:Request){try{return Response.json(await collectionHealth(),{headers:publicNewsHeaders(r.headers.get('Origin'))})}catch{return Response.json({error:'수집 현황을 불러오지 못했습니다.'},{status:500})}}
