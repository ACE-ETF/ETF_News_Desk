'use client';
import {useEffect,useState} from 'react';
import {Monitor,Moon,Sun} from 'lucide-react';
import {THEME_STORAGE_KEY,type ThemePreference} from '../lib/theme';
export default function ThemePicker(){
 const [preference,setPreference]=useState<ThemePreference>('auto');
 const [ready,setReady]=useState(false);
 useEffect(()=>{let saved:ThemePreference='auto';try{const s=localStorage.getItem(THEME_STORAGE_KEY);if(s==='light'||s==='dark')saved=s}catch{}setPreference(saved);setReady(true)},[]);
 useEffect(()=>{
  if(!ready)return;
  const media=window.matchMedia('(prefers-color-scheme: dark)');
  const apply=()=>{document.documentElement.dataset.themePreference=preference;document.documentElement.dataset.theme=preference==='auto'?(media.matches?'dark':'light'):preference};
  apply();media.addEventListener('change',apply);return()=>media.removeEventListener('change',apply);
 },[preference,ready]);
 function change(value:ThemePreference){setPreference(value);try{localStorage.setItem(THEME_STORAGE_KEY,value)}catch{}}
 const Icon=preference==='auto'?Monitor:preference==='dark'?Moon:Sun;
 return <label className="themePicker"><Icon size={15} aria-hidden="true"/><select aria-label="화면 테마" value={preference} onChange={e=>change(e.target.value as ThemePreference)}><option value="auto">자동</option><option value="light">밝게</option><option value="dark">어둡게</option></select></label>;
}
