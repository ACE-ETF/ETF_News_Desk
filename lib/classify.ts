import {KR_HOLIDAYS} from "./holidays";
export function isNewListing(t:string){
 if(/이벤트|경품|증정|캠페인|프로모션|세미나|플랫폼|홈페이지|웹사이트|서비스|앱\s|애플리케이션|보고서|리포트|계좌|혜택|콘텐츠|기능|가이드|브랜드\s*출시/.test(t))return false;
 if(/(?:담은|보유|편입|투자한|투자하는).*(?:기업공개|IPO|신규\s*상장)/i.test(t)&&!/(?:ETF|상장지수펀드).{0,8}출시/.test(t))return false;
 if(/상장.{0,8}(?:주년|기념|이후|만에|개월)|신규\s*상장.*ETF.*(?:수익률|순자산|순매수|성과)/.test(t))return false;
 const fund='(?:ETF|상장지수펀드)';
 const action='(?:신규\\s*상장|신규\\s*출시|첫\\s*상장|출시|상장\\s*(?:예정|한다|합니다|추진|계획|발표|승인))';
 return new RegExp(fund+'[^.!?…]{0,24}'+action,'i').test(t)||new RegExp(action+'[^.!?…]{0,35}'+fund,'i').test(t)||(/\b(?:ACE|TIGER|KODEX|RISE|SOL|PLUS|HANARO|KIWOOM|TIMEFOLIO|KoAct)\b/i.test(t)&&/(?:ETF|펀드|[‘'“"][^’'”"]+[’'”"])/.test(t)&&/(?:신규\s*상장|신규\s*출시)/.test(t));
}
export function category(t:string){
 if(/상장폐지|거래정지|청산|금융당국|금감원|금융위|제도|규제|과세|세제|법안|규정/.test(t))return '제도·시장';
 if(/특별\s*배당|특별\s*분배|분배금|분배율|분배락|배당락|분배\s*정책|배당\s*정책|중간\s*배당/.test(t))return '배당·분배';
 if(/이벤트|경품|증정|프로모션|캠페인|세미나|마케팅|수상|표창/.test(t))return '마케팅';
 if(isNewListing(t))return '신규 상장';
 if(/유입|유출|순매수|순매도|순자산|수익률|성과/.test(t))return '수급·성과';
 return '상품·전략';
}
const DAY=86400000;
export function isBusinessDay(t:number){const d=new Date(t+9*3600000);const key=d.toISOString().slice(0,10);const year=d.getUTCFullYear();if(year<2025||year>2036)throw new Error('공휴일 달력 갱신이 필요합니다.');return ![0,6].includes(d.getUTCDay())&&!KR_HOLIDAYS.has(key)}
export function collectionWindow(now=Date.now()){
 let end=Math.floor((now+3600000)/DAY)*DAY-3600000;
 while(!isBusinessDay(end))end-=DAY;
 let start=end-DAY;while(!isBusinessDay(start))start-=DAY;
 return {start,end};
}
export function calendarDates(start:number,end:number){const dates:string[]=[];const first=Math.floor((start+9*3600000)/DAY)*DAY-9*3600000;for(let t=first;t<end;t+=DAY)dates.push(new Date(t+9*3600000).toISOString().slice(0,10));return dates}
