import {canGroupStories} from './story-events';
import {importance} from './ranking';
import type {Article} from './news';
export type Story={a:Article;others:Article[]};
export function briefStories(stories:Story[],limit=6){
 const eligible=stories.filter(s=>importance(s.a).score>=35&&s.a.category!=='마케팅');
 const selected:Story[]=[];const counts=new Map<string,number>();
 for(const story of eligible){const n=counts.get(story.a.category)||0;if(n>=3&&importance(story.a).level!=='상')continue;selected.push(story);counts.set(story.a.category,n+1);if(selected.length===limit)break}
 return selected;
}
export function groupStories(articles:Article[],enabled=true):Story[]{
 const storyKey=(a:Article)=>{const t=a.title,text=t+' '+(a.summary||'');
 if(/분배금|분배/.test(t)&&/KODEX|삼성(?:자산)?운용/.test(text)){
  const sp=/S&P\s*500/i.test(text),nas=/나스닥\s*100/i.test(text),pair=/미국\s*대표지수.*ETF\s*2종/.test(text);
  if(sp||nas||pair)return 'distribution:kodex:'+((sp&&nas||pair)?'sp500+nasdaq100':sp?'sp500':'nasdaq100')+':'+a.date.slice(0,7);
 }
 if(/한화(?:자산)?운용|\bPLUS\b/i.test(t)&&/HBM/i.test(t)&&/순매수|개인.*(?:유입|자금)/.test(t))return 'hanwha:hbm:personal-flow:'+a.date;
 const issuer=/한화(?:자산)?운용/.test(t)?'한화':/키움(?:투자)?(?:자산)?운용|KIWOOM/i.test(t)?'키움':'';const theme=/HBM.*반도체|HBM/i.test(t)?'HBM':/코스닥\s*150.*커버드콜/.test(t)?'코스닥150커버드콜':'';const amount=t.match(/(\d[\d,]*(?:\.\d+)?)\s*(조|억)/);const flow=/순자산/.test(t)?'순자산':/유입|순매수|순유입/.test(t)?'유입':'';if(issuer&&theme&&amount&&flow)return [issuer,theme,flow,amount[1].replace(/,/g,''),amount[2]].join(':');if(!/특별\s*배당|특별\s*분배|분배금|분배/.test(a.title))return '';const fund=a.title.replace(/\s+/g,'').toUpperCase().match(/(ACE|TIGER|KODEX|RISE|SOL|PLUS|HANARO|KIWOOM)(코스피200|코스닥150|200)/)?.[0];return fund?'distribution:'+fund+':'+(a.title.match(/(\d{1,2})월/)?.[1]||a.date.slice(5,7)).padStart(2,'0'):''};
 const result:Story[]=[];
 for(const a of articles){
  const found=enabled?result.find(x=>{const key=storyKey(a);return (key&&key===storyKey(x.a)&&a.date===x.a.date)||canGroupStories(a,x.a)}):undefined;
  if(found){if(![found.a,...found.others].some(b=>b.id===a.id||b.url===a.url))found.others.push(a)}else result.push({a,others:[]});
 }
 return result;
}
