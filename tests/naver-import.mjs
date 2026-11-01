import fs from 'node:fs';import ts from 'typescript';import assert from 'node:assert/strict';
const js=ts.transpileModule(fs.readFileSync('lib/naver-import.ts','utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText;
const {validNaverItems}=await import('data:text/javascript;base64,'+Buffer.from(js).toString('base64'));
const w={start:Date.parse('2026-10-30T07:40:00+09:00'),end:Date.parse('2026-11-02T07:40:00+09:00')};
const item={title:'ETF 신규 상장 및 투자 전략 보도',url:'https://n.news.naver.com/mnews/article/003/0014293578',source:'뉴시스',published:'2026-11-01T08:00:00+09:00'};
assert(validNaverItems([item],w));assert(!validNaverItems([{...item,published:'2026-11-02T07:57:00+09:00'}],w));assert(!validNaverItems([{...item,published:'2026-11-01'}],w));
assert(!validNaverItems([{...item,url:'https://example.com/article'}],w));assert(!validNaverItems([{...item,url:'https://n.news.naver.com.evil.example/mnews/article/003/0014293578'}],w));assert(!validNaverItems(Array(11).fill(item),w));assert(!validNaverItems([],w));
console.log('PASS: bounded verified Naver import; exact timestamp cutoff; no date-only guesses or unrelated hosts');

assert(validNaverItems([{...item,url:'https://www.idaegu.co.kr/news/articleView.html?idxno=564078'}],w));assert(!validNaverItems([{...item,url:'https://www.idaegu.co.kr.evil.example/news/123'}],w));
