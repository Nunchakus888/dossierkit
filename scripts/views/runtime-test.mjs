// Actual D1 binding locally; no cloud credentials or production writes.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
const require = createRequire(import.meta.url);
const wranglerRequire = createRequire(require.resolve('wrangler'));
const { build } = wranglerRequire('esbuild');
const { Miniflare } = wranglerRequire('miniflare');
const origin='https://sunionpeaks.pages.dev';
const manifest={origin,timeZone:'Asia/Shanghai',pages:{'/zh':null,'/zh/cv':null,'/zh/notes/a':'zh/a'}};
const compiled=await build({stdin:{contents:`import {handleViews} from ${JSON.stringify(resolve('src/lib/view-counter/server.mjs'))}; export default {fetch(request,env){return handleViews(request,env,${JSON.stringify(manifest)})}};`,resolveDir:process.cwd()},bundle:true,format:'esm',platform:'browser',target:'es2022',write:false});
const mf=new Miniflare({modules:true,script:compiled.outputFiles[0].text,compatibilityDate:'2026-06-01',d1Databases:['VIEWS_DB'],bindings:{VIEWS_HASH_SECRET:'local-runtime-test-key-do-not-use-in-production'}});
try {
  const db=await mf.getD1Database('VIEWS_DB');
  for(const name of ['0001_views.sql','0002_uv_sources.sql']) {
    const text=await readFile('migrations/views/'+name,'utf8');
    const queries=text.replace(/^--.*$/gm,'').split(';').map(s=>s.trim()).filter(Boolean);
    await db.batch(queries.map(sql=>db.prepare(sql)));
  }
  const payload={version:2,eventId:crypto.randomUUID(),visitorId:crypto.randomUUID(),occurredAt:Date.now(),path:'/zh/cv/',refs:[],attribution:{source:'wechat',medium:'group',basis:'utm'}};
  const post=(body)=>mf.dispatchFetch(origin+'/api/views',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json','User-Agent':'Mozilla/5.0'},body:JSON.stringify(body)});
  const reports=await Promise.all(Array.from({length:8},()=>post(payload)));
  for(const response of reports){assert.equal(response.status,200);assert.equal((await response.json()).articles['page:/zh/cv'],1);}
  await post({...payload,eventId:crypto.randomUUID(),path:'/zh/notes/a/'});
  const summary=await (await mf.dispatchFetch(origin+'/api/views?mode=summary')).json();
  assert.equal(summary.total,2);assert.equal(summary.uv.today,1);
  const sources=await (await mf.dispatchFetch(origin+'/api/views?mode=sources')).json();assert.equal(sources.total.pv,2);assert.equal(sources.total.uv,1);
  await mkdir('artifacts/views',{recursive:true});
  await writeFile('artifacts/views/runtime-test.json',JSON.stringify({runtime:'Miniflare D1',idempotentConcurrentReports:8,totalPV:2,uv:1,cvPV:1,productionWrites:0,status:'passed'},null,2));
  console.log('Actual local D1 binding: concurrent idempotency, CV scope, UV and sources passed.');
} finally {await mf.dispose();}
