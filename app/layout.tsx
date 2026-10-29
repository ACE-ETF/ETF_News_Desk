import type { Metadata } from "next";
import "./globals.css";
const title="ETF 뉴스 데스크";
const description="매일 아침, 핵심 ETF 뉴스와 주요 이슈를 한눈에 확인하세요.";
export const metadata: Metadata = {
 metadataBase:new URL("https://etf-news-desk-insik.openfawn16384.chatgpt.site"),title,description,
 openGraph:{title,description,siteName:title,type:"website",locale:"ko_KR",images:[{url:"/social/etf-news-card-v1.png",width:1734,height:907,alt:"ETF 뉴스 데스크 — 핵심 이슈를 한눈에"}]},
 twitter:{card:"summary_large_image",title,description,images:["/social/etf-news-card-v1.png"]}
};
export default function RootLayout({children}:Readonly<{children:React.ReactNode}>){return <html lang="ko"><body>{children}</body></html>}
