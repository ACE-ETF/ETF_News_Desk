// Only the published GitHub Pages frontend may read the public news API cross-origin.
// No credentials or write methods are exposed by this policy.
export function publicNewsHeaders(origin:string|null):Record<string,string>{
 const headers:Record<string,string>={'Cache-Control':'no-store','Vary':'Origin'};
 if(origin==='https://ace-etf.github.io')headers['Access-Control-Allow-Origin']=origin;
 return headers;
}
