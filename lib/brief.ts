import {importance} from './ranking';
import type {Article} from './news';
export type Story={a:Article;others:Article[]};
export function briefStories(stories:Story[],limit=10){
 const eligible=stories.filter(s=>importance(s.a).score>=35&&s.a.category!=='마케팅');
 const selected:Story[]=[];const counts=new Map<string,number>();
 for(const story of eligible){const n=counts.get(story.a.category)||0;if(n>=3&&importance(story.a).level!=='상')continue;selected.push(story);counts.set(story.a.category,n+1);if(selected.length===limit)break}
 return selected;
}
export function groupStories(articles:Article[],enabled=true):Story[]{
 const norm=(s:string)=>s.replace(/[\s\p{P}\p{S}]/gu,'').toLowerCase();
 const storyKey=(a:Article)=>{const t=a.title,issuer=/한화(?:자산)?운용/.test(t)?'한화':/키움(?:투자)?(?:자산)?운용|KIWOOM/i.test(t)?'키움':'';const theme=/HBM.*반도체|HBM/i.test(t)?'HBM':/코스닥\s*150.*커버드콜/.test(t)?'코스닥150커버드콜':'';const amount=t.match(/(\d[\d,]*(?:\.\d+)?)\s*(조|억)/);const flow=/순자산/.test(t)?'순자산':/유입|순매수|순유입/.test(t)?'유입':'';if(issuer&&theme&&amount&&flow)return [issuer,theme,flow,amount[1].replace(/,/g,''),amount[2]].join(':');if(!/특별\s*배당|특별\s*분배|분배금|분배/.test(a.title))return '';const fund=a.title.replace(/\s+/g,'').toUpperCase().match(/(ACE|TIGER|KODEX|RISE|SOL|PLUS|HANARO|KIWOOM)(코스피200|코스닥150|200)/)?.[0];return fund?'distribution:'+fund+':'+(a.title.match(/(\d{1,2})월/)?.[1]||a.date.slice(5,7)).padStart(2,'0'):''};
 const result:Story[]=[];
 for(const a of articles){const n=norm(a.title);const found=enabled?result.find(x=>{const b=norm(x.a.title),key=storyKey(a);if(key&&key===storyKey(x.a))return true;if(n===b)return true;if(n.length<14||b.length<14)return false;const grams=(s:string)=>new Set(Array.from({length:s.length-2},(_,i)=>s.slice(i,i+3)));const aa=grams(n),bb=grams(b);return [...aa].filter(g=>bb.has(g)).length/Math.min(aa.size,bb.size)>.83}):undefined;if(found)found.others.push(a);else result.push({a,others:[]})}
 return result;
}
