export function headlineDigest(title:string){
 const clean=title.replace(/\[[^\]]{1,20}\]/g,'').replace(/[“”‘’"']/g,'').replace(/\s+/g,' ').trim();
 const parts=clean.split(/…|\.{3}|\s[—–]\s/).map(s=>s.trim()).filter(Boolean);
 return parts.length>1?parts.slice(0,2).join('. ')+( /[.!?]$/.test(parts[Math.min(1,parts.length-1)])?'':'.'):clean+(/[.!?]$/.test(clean)?'':'.');
}

// Display summaries as short fact bullets. Keep title translations and quoted
// excerpts verbatim; authored summaries use a noun/metric ending, never '~함'.
export function summaryPoints(text:string):string[]{
 const endings:[RegExp,string][]=[
  [/으로 집계됐다$/,'으로 집계'],[/로 집계됐다$/,'로 집계'],[/에 달했다$/,' 기록'],
  [/(차지|기록|발표|상장|출시|확대|축소|조정|유지|투자|돌파|편입|제외)(?:했다|한다|하였다|됐으며|됐다)$/,'$1'],
  [/(\d(?:[\d,.]*%|[\d,.]*억?원|[\d,.]*조원|[\d,.]*종)?)(?:이다|다)$/,'$1'],
  [/함$/,''],
 ];
 return text.split(/\n+|[.!?]\s+/).map(s=>s.trim().replace(/^[•·\-]\s*/, '').replace(/[.!]$/,'')).filter(Boolean).map(s=>{
  if(/^본문 발췌:/.test(s))return s;
  for(const [pattern,replacement] of endings)s=s.replace(pattern,replacement);
  return s;
 });
}

