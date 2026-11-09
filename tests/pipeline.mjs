import fs from 'node:fs';import path from 'node:path';import ts from 'typescript';import assert from 'node:assert/strict';
const objects=new Map();let revision=0;const realNow=Date.now;Date.now=()=>Date.parse('2026-11-02T08:10:00+09:00');
const bucket={get:async key=>{const o=objects.get(key);return o?{etag:o.etag,json:async()=>JSON.parse(o.body)}:null},put:async(key,body,options)=>{const old=objects.get(key);if(options?.onlyIf?.etagMatches&&old?.etag!==options.onlyIf.etagMatches)return null;if(options?.onlyIf?.etagDoesNotMatch==='*'&&old)return null;objects.set(key,{body,etag:String(++revision),uploaded:new Date()});return {}},delete:async key=>objects.delete(key),list:async({prefix=''})=>({objects:[...objects.entries()].filter(([key])=>key.startsWith(prefix)).map(([key,o])=>({key,uploaded:o.uploaded})),truncated:false})};globalThis.__pipelineEnv={BUCKET:bucket};
const cache=new Map();function moduleURL(file){file=path.resolve(file);if(cache.has(file))return cache.get(file);let src=fs.readFileSync(file,'utf8');src=src.replace(/import\s*\{\s*env\s*\}\s*from\s*["']cloudflare:workers["'];?/g,'const env=globalThis.__pipelineEnv;');let js=ts.transpileModule(src,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText;js=js.replace(/from\s*(['"])(\.\.?\/[^'"]+)\1/g,(_,q,p)=>'from '+JSON.stringify(moduleURL(path.resolve(path.dirname(file),p+'.ts'))));const url='data:text/javascript;base64,'+Buffer.from(js).toString('base64');cache.set(file,url);return url}
const news=await import(moduleURL('lib/news.ts'));const pipeline=await import(moduleURL('lib/pipeline.ts'));
const put=(key,v)=>bucket.put(key,JSON.stringify(v));
const old={id:'old',title:'ACE 기존 ETF',url:'https://example.com/old',published:'2026-10-29T16:00:00Z',date:'2026-10-30',category:'상품·전략',brands:['ACE']};
await put('days/2026-10-30.json',[old]);await put('status.json',{windowStart:'2026-10-28T22:40:00.000Z',windowEnd:'2026-10-29T22:40:00.000Z',updated:'2026-10-30T00:00Z'});
const started=await pipeline.startBatch('stage'),id=started.batch.id;assert(started.batch.queries.length>=3&&started.batch.queries.length<=5);assert.equal((await pipeline.startBatch('stage')).skipped,true);assert((await pipeline.reserveQuery(id,0)).reserved);assert((await pipeline.reserveQuery(id,0)).skipped);
const xml='<rss><channel><item><title>ACE 신규 ETF 출시 - 테스트</title><source>테스트</source><link>https://news.google.com/rss/articles/new123</link><pubDate>Sun, 01 Nov 2026 20:00:00 GMT</pubDate></item><item><title>ETF 미래 기사</title><link>https://news.google.com/rss/articles/future</link><pubDate>Tue, 03 Nov 2026 20:00:00 GMT</pubDate></item></channel></rss>';
await assert.rejects(()=>pipeline.receiveFeed(id,1,xml));assert.equal((await pipeline.receiveFeed(id,0,xml)).saved,1);await assert.rejects(()=>pipeline.receiveFeed(id,0,xml));
assert(!(await news.getNews()).articles.some(a=>a.title==='ACE 신규 ETF 출시'));assert(!(await news.getNews()).dates.includes('2026-11-02'));assert((await news.getNews(undefined,true)).articles.some(a=>a.title==='ACE 신규 ETF 출시'));
assert((await pipeline.reserveQuery(id,1)).reserved);await pipeline.queryFailed(id,1,503);assert((await pipeline.reserveQuery(id,2)).skipped);await pipeline.finishBatch(id);
const health=await pipeline.collectionHealth();assert.equal(health.batches[0].results[1].code,503);assert.equal(health.rawArticles.length,1);assert.equal(health.batches[0].results[0].received,2);
assert.equal(health.batches[0].results[0].rejected.outsideWindow,1);
const splitPlans=Array.from({length:6},(_,i)=>pipeline.plan(Date.now()+i*4*3600000));
assert.deepEqual(splitPlans.map(p=>p.queries.length).sort(),[3,3,4,4,4,5]);
assert(splitPlans.some(p=>p.queries.some(q=>q.q.includes("(equity OR sector)"))));
assert(splitPlans.some(p=>p.queries.some(q=>q.q.includes("-신규상장"))));
assert.equal(pipeline.plan(Date.now(),"release").queries.length,2);
const published=await pipeline.publishStaged();assert.equal(published.published,true);assert.equal(published.articles,1);assert.equal((await news.getNews()).status.partial,true);assert.equal((await pipeline.publishStaged()).added,0);assert((await news.getNews()).dates.includes('2026-11-02'));assert(objects.has('days/2026-10-30.json'));
Date.now=()=>Date.parse('2026-11-03T08:00:00+09:00');const before=(await news.getNews()).window;assert.equal((await pipeline.publishStaged()).published,false);assert.deepEqual((await news.getNews()).window,before);
Date.now=()=>Date.parse('2026-11-07T08:00:00+09:00');assert.equal((await pipeline.startBatch('release')).skipped,true);assert((await pipeline.startBatch('stage')).batch);
// Successful queries advance individually, including empty results; a failed
// query retains its older interval while a healthy one uses only a 1h overlap.
Date.now=()=>Date.parse('2026-11-08T01:10:00+09:00');
let first=await pipeline.startBatch('stage');
for(let i=0;i<first.batch.queries.length;i++){await pipeline.reserveQuery(first.batch.id,i);await pipeline.receiveFeed(first.batch.id,i,'<rss><channel></channel></rss>');}
await pipeline.finishBatch(first.batch.id);
Date.now=()=>Date.parse('2026-11-08T05:10:00+09:00');
let next=await pipeline.startBatch('stage');
assert.equal(next.batch.queries[0].start,'2026-11-07T15:10:00.000Z');
assert(next.batch.queries[0].q.endsWith('when:5h'));
await pipeline.reserveQuery(next.batch.id,0);await pipeline.receiveFeed(next.batch.id,0,'<rss><channel></channel></rss>');
await pipeline.reserveQuery(next.batch.id,1);await pipeline.queryFailed(next.batch.id,1,503);
await pipeline.finishBatch(next.batch.id);
Date.now=()=>Date.parse('2026-11-08T09:10:00+09:00');
let third=await pipeline.startBatch('stage');
assert.equal(third.batch.queries[0].start,'2026-11-07T19:10:00.000Z');
assert.equal(third.batch.queries[0].q.endsWith('when:5h'),true);
assert(third.batch.queries.some(q=>Date.parse(q.start)<Date.parse(third.batch.queries[0].start)));
assert.equal(new Set([first.batch.id,next.batch.id,third.batch.id]).size,3);
assert.equal((await pipeline.startBatch('stage')).skipped,true);
for(let i=0;i<third.batch.queries.length;i++){await pipeline.reserveQuery(third.batch.id,i);await pipeline.receiveFeed(third.batch.id,i,'<rss><channel></channel></rss>');}
await pipeline.finishBatch(third.batch.id);
Date.now=()=>Date.parse('2026-11-08T13:10:00+09:00');
const fourth=await pipeline.startBatch('stage');
assert.equal(fourth.batch.queries[1].start,new Date(Math.max(Date.parse(next.batch.queries[1].start),Date.now()-72*3600000)).toISOString(),'failed rotating query must not inherit a newer unrelated global success');
// Naver fallback is separately claimed once and never advances failed Google queries.
assert((await pipeline.reserveFallback(fourth.batch.id)).skipped);
await pipeline.reserveQuery(fourth.batch.id,0);await pipeline.queryFailed(fourth.batch.id,0,503);
const fallbackItem={title:'미국 상장 ETF 신규 상품과 투자 전략',source:'테스트경제',url:'https://n.news.naver.com/mnews/article/001/0000000011',published:new Date(Date.now()-1800000).toISOString()};
await assert.rejects(()=>pipeline.fallbackImport(fourth.batch.id,[fallbackItem]),/예약/);
assert.equal((await pipeline.reserveFallback(fourth.batch.id)).maxItems,20);
assert((await pipeline.reserveFallback(fourth.batch.id)).skipped);
assert.equal((await pipeline.fallbackImport(fourth.batch.id,[fallbackItem])).saved,1);
const ten=Array.from({length:10},(_,i)=>({...fallbackItem,url:'https://n.news.naver.com/mnews/article/001/'+String(20+i)}));
await pipeline.fallbackImport(fourth.batch.id,ten);
await assert.rejects(()=>pipeline.fallbackImport(fourth.batch.id,ten),/상한/);
await pipeline.finishFallback(fourth.batch.id,429);
await assert.rejects(()=>pipeline.fallbackImport(fourth.batch.id,[fallbackItem]),/예약/);
await pipeline.finishBatch(fourth.batch.id);
const fallbackBatch=(await pipeline.collectionHealth()).batches.find(b=>b.id===fourth.batch.id);
assert.equal(fallbackBatch.fallback.state,'failed');assert.equal(fallbackBatch.fallback.code,429);assert.equal(fallbackBatch.fallbackCount,11);
assert((await pipeline.reserveFallback(fourth.batch.id)).skipped);
Date.now=()=>Date.parse('2026-11-08T17:10:00+09:00');
const afterFallback=await pipeline.startBatch('stage');
assert.equal(afterFallback.batch.queries[0].start,fourth.batch.queries[0].start,'Naver does not close a failed Google interval');
for(let i=0;i<afterFallback.batch.queries.length;i++){await pipeline.reserveQuery(afterFallback.batch.id,i);await pipeline.receiveFeed(afterFallback.batch.id,i,'<rss><channel></channel></rss>');}
assert((await pipeline.reserveFallback(afterFallback.batch.id)).reserved,'a fully empty successful RSS batch can be supplemented');
await pipeline.finishFallback(afterFallback.batch.id,0);await pipeline.finishBatch(afterFallback.batch.id);
console.log('PASS: fallback claim lock; 20-item stage cap; unreserved/finished rejection; provider error retained; empty RSS supplementation; failed Google progress preserved');
Date.now=()=>Date.parse('2026-11-13T13:10:00+09:00');
const recovery=await pipeline.startBatch('stage');
assert(recovery.batch.coverageGap);assert(recovery.batch.queries.every(q=>Date.parse(q.start)>=Date.now()-72*3600000));
console.log('PASS: four-hour slots; query-specific successful/zero-result progress; 1h overlap; independent failure recovery; duplicate lock');
Date.now=realNow;console.log('PASS: bounded rotating queries; durable single attempt; no unreserved/repeated ingestion; exact source times; staging invisible to public/archive; failure circuit; health/raw links; publication/zero-data preservation; weekend accumulation');
