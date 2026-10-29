import type {Article} from './news';
// Match a reported statement by speaker, narrow topic and stance, rather than headline wording.
// Unknown statements fall back to the existing conservative story matcher.
function statement(a:Article){
 const t=a.title,text=t+' '+(a.summaryKind==='summary'?a.summary||'':'');
 const role='(?:정책실장|금융위원장|금감원장|금융감독원장|경제부총리|재경부장관|기재부장관|한국은행총재)';
 const namedRole=t.match(new RegExp('([가-힣]{2,4})\\s*(?:(?:청와대|대통령실)\\s*)?'+role))?.[1];
 const leading=t.match(/^([가-힣]{2,4})(?=[,，\s“"'])/)?.[1];
 const speaker=namedRole||(leading&&!['야당','여당','국회','정부','국민께','금융위'].includes(leading)?leading:t.match(/([가-힣]{2,4})\s*[“"]/u)?.[1]);
 if(!speaker||!/ETF|상장지수펀드/i.test(t))return;
 const topic=/레버리지\s*ETF|(?:단일\s*종목|단일종목).{0,10}ETF/i.test(text)?'single-stock-leverage':/교육세/.test(text)?'etf-education-tax':/퇴직연금/.test(text)?'pension-etf':'';
 const effectiveTopic=topic||(/ETF.{0,25}(?:국민|투자자).{0,15}(?:변동성|손실)/.test(t)?'investor-impact':'');if(!effectiveTopic)return;
 let stance='';
 if(/정책\s*실패(?:를|는|도|에)?\s*(?:인정|시인)/.test(t))stance='policy-failure-admitted';
 else if(/(?:도입|상장|판매).{0,4}(?:철회|중단|금지|폐지).{0,5}(?:발표|결정|추진|지시|요구)/.test(t))stance='new-policy-action';
 else if(/송구|사과|심려|정책\s*실패.{0,8}(?:선\s*그|부인)|최종.{0,8}결정.{0,10}금융위|변동성.{0,10}(?:완화|줄이|노출)|도입\s*시기.{0,15}재평가/.test(t))stance='apology-explanation';
 if(!stance)return;
 const explicitDay=text.match(/(\d{1,2})일\s*(?:국감|국회|열린|운영위|정무위)/)?.[1];
 const venue=text.match(/운영위원회|운영위|정무위원회|정무위|기획재정위원회|기재위/)?.[0]?.replace('운영위원회','운영위').replace('정무위원회','정무위').replace('기획재정위원회','기재위');
 return {speaker,topic:effectiveTopic,stance,explicitDay,venue};
}
export function sameStatementEvent(a:Article,b:Article):boolean|undefined{
 const x=statement(a),y=statement(b);if(!x||!y)return undefined;
 const sameTopic=x.topic===y.topic||[x.topic,y.topic].includes('investor-impact')&&[x.topic,y.topic].includes('single-stock-leverage');
 if(x.speaker!==y.speaker||!sameTopic||x.stance!==y.stance)return false;
 if(x.stance==='new-policy-action'||x.stance==='policy-failure-admitted')return undefined;
 if(x.explicitDay&&y.explicitDay&&x.explicitDay!==y.explicitDay||x.venue&&y.venue&&x.venue!==y.venue)return false;
 // Evening statements are often republished after midnight; use elapsed time instead of a calendar-day barrier.
 return Math.abs(Date.parse(a.published)-Date.parse(b.published))<=12*3600000;
}
