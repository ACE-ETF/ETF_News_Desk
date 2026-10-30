export type ThemePreference='auto'|'light'|'dark';
export const THEME_STORAGE_KEY='etf-news-theme';
// Runs before content is painted on both the hosted and GitHub Pages frontends.
export const THEME_BOOTSTRAP=`(()=>{let p='auto';try{const s=localStorage.getItem('etf-news-theme');if(s==='light'||s==='dark')p=s}catch{}const d=document.documentElement;d.dataset.themePreference=p;d.dataset.theme=p==='auto'?(window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'):p})()`;
