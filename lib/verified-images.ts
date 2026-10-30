import type {Article} from './news';
// Explicit editorial review only. OG metadata or a related summary source is
// never evidence that an image depicts the article's subject.
const reviewed:Record<string,{title:string;imageUrl:string;sourceUrl:string;caption:string;reviewedOn:string;label?:string}>={
 'cdbf336a1a8baabc52ebf30fd040891959c2638f48fdc7e127d50637711c807f':{
  title:'하준경 "레버리지 ETF 심려 끼쳐 송구"…최종 결정 주체는 "금융위"',
  imageUrl:'https://img.newspim.com/news/2026/10/29/261029162437456_w.jpg',
  sourceUrl:'https://www.newspim.com/news/view/20261029001434',
  caption:'하준경 정책실장의 2026년 10월 29일 국회 운영위원회 국감 현장. 뉴스핌.',label:'국감 현장 · 뉴스핌',reviewedOn:'2026-10-30'
 },
 '69fdcce97b9c233ec51bc31677289dfc0945c1d11db4c2908dcf53a2f2b6f371':{
  title:'신한 SOL 미국배당다우존스(H), 1년 수익률 26.36%…배당주 ETF 1위',
  imageUrl:'https://img.newspim.com/news/2026/07/10/2607101541451950.jpg',
  sourceUrl:'https://www.newspim.com/news/view/20261029000327',
  caption:'해당 기사에 실린 신한자산운용 로고. 뉴스핌.',label:'운용사 로고 · 뉴스핌',reviewedOn:'2026-10-30'
 },
 '4b9f36bdef340034587dcb6a98bc52e8ed98af57b49f06d591c7aedd3e4ea990':{
  title:"'TIGER 미국S&P500', 연초 이후 개인순매수 5조…국내 ETF 중 최초",
  imageUrl:'https://cphoto.asiae.co.kr/listimglink/1/2026102909233078690_1793233411.jpg',
  sourceUrl:'https://www.asiae.co.kr/article/2026102909245074772',
  caption:'TIGER 미국S&P500 개인 순매수 5조원 돌파 보도에 실린 이미지. 아시아경제.',label:'원문 이미지 · 아시아경제',reviewedOn:'2026-10-30'
 },

 'ee7cd44b63fb071b267dc5d8b481eabbdb1a8c91f819f00a81027c16a10993b9':{
  title:'SK하이닉스는 잘나가는데… 레버리지 ETF는 초고속 청산?',
  imageUrl:'https://img.etnews.com/news/article/2026/10/27/news-p.v1.20261027.e9857953702d4d47ad5124c43cc44d83_P1.png',
  sourceUrl:'https://www.etnews.com/20261027000236',
  caption:'해당 기사의 영상 썸네일. SK하이닉스 레버리지 ETF 청산을 다룸.',reviewedOn:'2026-10-29'
 },
 'a16c5a4d056364b5bd6db91b3ffb9b8c12764f78185159e581da4c52d4947763':{
  title:'미래에셋 ‘TIGER 200 ETF’, 삼성전자 특별배당 반영 10월 주당 725원 분배',
  imageUrl:'https://img0.yna.co.kr/etc/inner/KR/2026/10/28/AKR20261028066000008_01_i_P4.jpg',
  sourceUrl:'https://www.yna.co.kr/view/AKR20261028066000008',
  caption:'미래에셋자산운용 TIGER200 10월 분배금. 기사 상품 및 725원 일치.',reviewedOn:'2026-10-29'
 }
};
export function verifiedArticleMedia(article:Pick<Article,'id'|'title'>){const item=reviewed[article.id];return item?.title===article.title?item:undefined}
export function verifiedArticleImage(article:Pick<Article,'id'|'title'>){return verifiedArticleMedia(article)?.imageUrl}
