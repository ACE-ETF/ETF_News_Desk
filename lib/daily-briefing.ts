export type DailyBriefing={windowStart:string;windowEnd:string;overview:string[];items:{title:string;text:string;articleIds:string[]}[]};
export function validBriefing(value:unknown,window:{start:string;end:string},articleIds:Set<string>):value is DailyBriefing{
 const v=value as DailyBriefing;
 const text=(s:unknown,max:number)=>typeof s==='string'&&s.trim().length>0&&s.length<=max;
 return !!v&&v.windowStart===window.start&&v.windowEnd===window.end&&Array.isArray(v.overview)&&v.overview.length>=2&&v.overview.length<=3&&v.overview.every(s=>text(s,160))&&Array.isArray(v.items)&&v.items.length>=1&&v.items.length<=5&&v.items.every(i=>i&&text(i.title,90)&&text(i.text,400)&&Array.isArray(i.articleIds)&&i.articleIds.length>=1&&i.articleIds.length<=3&&i.articleIds.every(id=>typeof id==='string'&&articleIds.has(id)));
}
