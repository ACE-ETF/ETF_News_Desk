'use client';
import CollectionStatus from './CollectionStatus';
import ThemePicker from './ThemePicker';
export default function RssCollectionPage(){return <main style={{margin:'0 auto',maxWidth:1000,padding:'24px 16px'}}><header style={{position:'static',padding:'0 0 16px',display:'flex',justifyContent:'space-between'}}><a href="./">← 뉴스데스크</a><ThemePicker/></header><h1 style={{fontSize:24,marginTop:24}}>RSS 수집 현황</h1><p style={{lineHeight:1.8}}>정리 전 수집 기록과 최근 원본 제목·링크를 확인하는 별도 화면입니다.<br/>뉴스데스크에는 수집 현황이 표시되지 않습니다.</p><CollectionStatus standalone/></main>}
