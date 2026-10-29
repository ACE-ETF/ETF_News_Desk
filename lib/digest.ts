export function headlineDigest(title:string){
 const clean=title.replace(/\[[^\]]{1,20}\]/g,'').replace(/[“”‘’"']/g,'').replace(/\s+/g,' ').trim();
 const parts=clean.split(/…|\.{3}|\s[—–]\s/).map(s=>s.trim()).filter(Boolean);
 return parts.length>1?parts.slice(0,2).join('. ')+( /[.!?]$/.test(parts[Math.min(1,parts.length-1)])?'':'.'):clean+(/[.!?]$/.test(clean)?'':'.');
}
