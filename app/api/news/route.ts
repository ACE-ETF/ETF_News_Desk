import {briefStories,groupStories} from '../../../lib/brief';
import {compareImportance} from '../../../lib/ranking';
import {getNews} from "../../../lib/news";
export async function GET(r:Request){const day=new URL(r.url).searchParams.get('date')||undefined;if(day&&!/^\d{4}-\d{2}-\d{2}$/.test(day))return Response.json({error:'날짜 형식 오류'},{status:400});try{const data=await getNews(day);const output=new URL(r.url).searchParams.has("brief")?{...data,brief:briefStories(groupStories([...data.articles].sort(compareImportance))).map(s=>s.a)}:data;return Response.json(output,{headers:{'Cache-Control':'no-store'}})}catch(e){console.error("ETF archive read failed",e);return Response.json({error:"기사 목록을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요."},{status:500})}}
