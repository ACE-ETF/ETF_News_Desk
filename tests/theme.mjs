import ts from 'typescript';import fs from 'node:fs';import vm from 'node:vm';import assert from 'node:assert/strict';
const js=ts.transpileModule(fs.readFileSync('lib/theme.ts','utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText;
const {THEME_BOOTSTRAP}=await import('data:text/javascript;base64,'+Buffer.from(js).toString('base64'));
function boot(saved,systemDark,blocked=false){const doc={documentElement:{dataset:{}}};vm.runInNewContext(THEME_BOOTSTRAP,{document:doc,window:{matchMedia:()=>({matches:systemDark})},localStorage:{getItem:()=>{if(blocked)throw new Error('storage unavailable');return saved}}});return doc.documentElement.dataset}
assert.equal(boot(null,true).theme,'dark');assert.equal(boot(null,false).theme,'light');
assert.equal(boot('light',true).theme,'light');assert.equal(boot('dark',false).theme,'dark');
assert.equal(boot('invalid',true).themePreference,'auto');assert.equal(boot(null,true,true).theme,'dark');
assert(fs.readFileSync('pages/index.html','utf8').includes('<script>'+THEME_BOOTSTRAP+'</script>'));
const luminance=hex=>{const c=hex.match(/\w\w/g).map(x=>parseInt(x,16)/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4);return .2126*c[0]+.7152*c[1]+.0722*c[2]};
for(const [fg,bg]of [['edf3fa','0d1522'],['edf3fa','152233'],['cedae6','18334c'],['b4c4d5','152233'],['79caff','152233'],['a7ddff','18334c']])assert((luminance(fg)+.05)/(luminance(bg)+.05)>=4.5,`${fg} on ${bg}`);
console.log('PASS: persisted theme overrides system, auto follows system, blocked storage fallback, matching early bootstrap and dark text/link contrast');
