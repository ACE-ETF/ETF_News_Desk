import type {Article} from './news';
const issuers:[RegExp,string][]=[[/KB(?:자산)?운용|RISE/i,'RISE'],[/삼성(?:자산)?운용|KODEX/i,'KODEX'],[/미래에셋(?:자산)?운용|TIGER/i,'TIGER'],[/한국투자신탁운용|한투운용|ACE/i,'ACE'],[/신한(?:자산)?운용|SOL/i,'SOL'],[/한화(?:자산)?운용|PLUS/i,'PLUS'],[/키움(?:투자)?(?:자산)?운용|KIWOOM/i,'KIWOOM']];
const compact=(s:string)=>s.normalize('NFKC').replace(/美/g,'미국').replace(/[\s'"‘’“”]/g,'').toUpperCase();
function launch(a:Article){
 const t=a.title.normalize('NFKC'),text=t+' '+(a.summaryKind==='summary'?a.summary||'':'');
 const issuer=issuers.filter(([r])=>r.test(t)).map(([,v])=>v);
 const count=t.match(/ETF\s*(\d+)\s*종(?:목)?/i)?.[1];
 if(issuer.length!==1||!count||!/신규\s*상장|출시|출격|ETF.{0,12}상장/.test(t)||/상장폐지|청산|연기|취소/.test(t))return;
 const day=text.match(/(?:(\d{1,2})월\s*)?(\d{1,2})일\s*(?:신규\s*)?상장/)||text.match(/(?:(\d{1,2})월\s*)?(\d{1,2})일\s*신규\s*상장/);
 const target=day?a.date.slice(0,5)+(day[1]||a.date.slice(5,7)).padStart(2,'0')+'-'+day[2].padStart(2,'0'):'';
 const c=compact(t),full=compact(text);
 const named=[...t.matchAll(/['‘“"]((?:RISE|KODEX|TIGER|ACE|SOL|PLUS|KIWOOM)\s*[^'’”"]+)['’”"]/gi)].map(m=>compact(m[1]));
 const features:[RegExp,string][]=[[/회사채|우량채|채권/,'bond'],[/미국.*(?:주식|대형주)|시총상위10|미국시총상위10/,'us-equity'],[/반도체/,'semiconductor'],[/커버드콜/,'covered-call'],[/레버리지/,'leverage'],[/인버스/,'inverse'],[/금현물|금선물/,'gold']];
 return {a,issuer:issuer[0],count,target,c,full,named,features:features.filter(([r])=>r.test(c)).map(([,v])=>v)};
}
// A verified multi-fund announcement anchors title aliases and later weekend
// syndication. Unknown-date headlines attach only to one compatible event.
export function launchEventKeys(articles:Article[]):Map<string,string>{
 const rows=articles.map(launch).filter((x):x is NonNullable<typeof x>=>!!x);
 const anchors=rows.filter(x=>x.target&&x.a.summaryKind==='summary');
 const keys=new Map<string,string>();
 for(const x of rows){
  const candidates=anchors.filter(y=>x.issuer===y.issuer&&x.count===y.count&&(!x.target||x.target===y.target)&&Math.abs(Date.parse(x.a.published)-Date.parse(y.a.published))<=72*3600000&&x.named.every(n=>y.full.includes(n)||y.full.includes(n.replace(new RegExp('^'+x.issuer),'')))&&x.features.every(f=>f==='bond'?/채권|우량채/.test(y.full):f==='us-equity'?/미국.*(?:주식|대형주)|미국시총상위10/.test(y.full):y.features.includes(f))&&(x.target||x.features.length||x.named.length));
  const signatures=[...new Set(candidates.map(y=>[y.issuer,y.target,y.count].join(':')))];
  if(signatures.length===1)keys.set(x.a.id,'launch:'+signatures[0]);
 }
 return keys;
}
