import type {Article} from './news';
// Explicit editorial review only. OG metadata or a related summary source is
// never evidence that an image depicts the article's subject.
const reviewed:Record<string,{title:string;imageUrl:string;sourceUrl:string;caption:string;reviewedOn:string}>={
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
export function verifiedArticleImage(article:Pick<Article,'id'|'title'>){const item=reviewed[article.id];return item?.title===article.title?item.imageUrl:undefined}
