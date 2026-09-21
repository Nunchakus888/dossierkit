import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { handleViews } from '../../src/lib/view-counter/server.mjs';
import { normalizeAttribution } from '../../src/lib/view-counter/identity.mjs';
import { visitorId, entrySource } from '../../src/lib/view-counter/browser-context.mjs';
const origin = 'https://sunionpeaks.pages.dev';
const manifest = { origin, timeZone:'Asia/Shanghai', pages: {'/zh':null,'/zh/cv':null,'/en/cv':null,'/zh/contact':null,'/zh/notes/a':'zh/a','/zh/notes/b':'zh/b'} };
const now = new Date('2026-09-21T09:00:00Z');
const secret = 'test-only-key-never-use-in-production-00000';
function fixture() {
  const sqlite = new DatabaseSync(':memory:');
  const schema = ['0001_views.sql','0002_uv_sources.sql'].map((file)=>readFileSync(new URL('../../migrations/views/'+file,import.meta.url),'utf8')).join('\n');
  sqlite.exec(schema);
  const execute = (sql, params) => {
    const stmt = sqlite.prepare(sql);
    if (/^\s*(SELECT|WITH)/i.test(sql)) return {success:true,results:stmt.all(...params)};
    const result = stmt.run(...params); return {success:true,results:[],meta:{changes:result.changes}};
  };
  const db = { prepare(sql) { const bind=(params=[])=>({sql,params,bind:(...p)=>bind(p),all:async()=>execute(sql,params)});return bind(); },
    async batch(statements) { sqlite.exec('BEGIN');try {const r=statements.map((s,i)=>{if(db.failAt===i)throw Error('test failure');return execute(s.sql,s.params);});sqlite.exec('COMMIT');return r;}catch(e){sqlite.exec('ROLLBACK');throw e;} }
  };
  const env = { VIEWS_DB:db, VIEWS_HASH_SECRET:secret };
  const post=(body, date=now, headers={})=>handleViews(new Request(origin+'/api/views',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json','User-Agent':'Mozilla/5.0',...headers},body:JSON.stringify(body)}),env,manifest,date);
  const get=async(query='',date=now)=>{const r=await handleViews(new Request(origin+'/api/views'+query),env,manifest,date);assert.equal(r.status,200);return r.json();};
  return {sqlite,db,env,post,get,schema};
}
const event=(visitor=crypto.randomUUID(), path='/zh/notes/a/', more={})=>({version:2,eventId:crypto.randomUUID(),occurredAt:now.getTime(),visitorId:visitor,path,refs:[],attribution:{source:'github.com',medium:'',basis:'referrer'},...more});
test('v2: same event replay increments once, reload is another PV but one UV',async()=>{
  const f=fixture(),e=event();const first=await f.post(e);assert.equal(first.status,200);assert.equal((await first.json()).duplicate,false);
  const duplicate=await f.post(e);assert.equal((await duplicate.json()).duplicate,true);
  assert.equal((await f.get()).totalViews,1);
  await f.post({...e,eventId:crypto.randomUUID()});
  const s=await f.get('?mode=summary');assert.equal(s.total,2);assert.equal(s.uv.today,1);assert.equal(s.uv.last30Days,1);
  assert.equal(f.sqlite.prepare('SELECT COUNT(*) n FROM view_events').get().n,2);
});
test('v2: concurrent identical events remain idempotent and cross-page UV is not additive',async()=>{
  const f=fixture(),e=event();const responses=await Promise.all(Array.from({length:20},()=>f.post(e)));
  assert.ok(responses.every(r=>r.status===200));assert.equal((await f.get()).totalViews,1);
  await f.post(event(e.visitorId,'/zh/cv/'));await f.post(event(e.visitorId,'/zh/contact/'));
  assert.equal((await f.get('?mode=summary')).uv.today,1);
  const cv=await f.get('?mode=summary&path=/zh/cv/');assert.equal(cv.total,1);assert.equal(cv.uv.today,1);
  assert.equal((await f.get('?path=/zh/cv/')).articles['page:/zh/cv'],1);
  assert.equal((await f.get('?mode=summary&path=/en/cv/')).total,0);
});
test('v2: page/query identities are stable, GET and cards never count',async()=>{
  const f=fixture(),e=event(null,'/zh/cv/index.html',{refs:['zh/a','page:/zh/contact']});await f.post(e);
  const s=await f.get('?ref=zh/a&path=/zh/contact/&path=/zh/cv');assert.equal(s.articles['zh/a'],0);assert.equal(s.articles['page:/zh/contact'],0);assert.equal(s.articles['page:/zh/cv'],1);
  const top=await f.get('?mode=top&type=pages&period=all');assert.deepEqual(top.articles,[{ref:'page:/zh/cv',views:1}]);
});
test('v2: same browser across days is distinct once in 7/30-day UV; no storage means unidentified PV',async()=>{
  const f=fixture(),v=crypto.randomUUID();await f.post(event(v));const tomorrow=new Date(now.getTime()+86400000);
  await f.post(event(v,'/zh/notes/a/',{occurredAt:tomorrow.getTime()}),tomorrow);await f.post(event(null,'/zh/notes/a/',{occurredAt:tomorrow.getTime()}),tomorrow);
  const s=await f.get('?mode=summary',tomorrow);assert.equal(s.uv.today,1);assert.equal(s.uv.yesterday,1);assert.equal(s.uv.last7Days,1);assert.equal(s.total,3);assert.equal(s.uv.identifiableViews30Days,2);
});
test('v2: per-channel UV is nonadditive and source queries never leak visitor/event state',async()=>{
  const f=fixture(),v=crypto.randomUUID();await f.post(event(v));await f.post(event(v,'/zh/cv/',{attribution:{source:'wechat',medium:'group',basis:'utm'}}));
  const s=await f.get('?mode=sources');assert.equal(s.total.pv,2);assert.equal(s.total.uv,1);assert.equal(s.sources.reduce((n,r)=>n+r.uv,0),2);assert.equal(s.channelUVIsNotAdditive,true);
  assert.ok(!JSON.stringify(s).includes(v));assert.ok(!JSON.stringify(s).includes('visitor_hash'));
  const stored=f.sqlite.prepare('SELECT visitor_hash FROM view_visitors LIMIT 1').get().visitor_hash;assert.equal(stored.length,64);assert.notEqual(stored,v);
  const scoped=await f.get('?mode=sources&path=/zh/cv/');assert.equal(scoped.sources[0].source,'wechat');assert.equal(scoped.sources[0].basis,'utm');
});
test('v2: rejected/replayed identities never mutate; failed batch rolls back all tables',async()=>{
  const f=fixture(),e=event();f.db.failAt=4;assert.equal((await f.post(e)).status,503);f.db.failAt=undefined;
  for(const table of ['view_events','view_visitors','view_sources_daily','view_daily'])assert.equal(f.sqlite.prepare(`SELECT COUNT(*) n FROM ${table}`).get().n,0);
  assert.equal((await f.get()).totalViews,0);await f.post(e);
  assert.equal((await f.post({...e,path:'/zh/cv/'})).status,409);assert.equal((await f.get()).totalViews,1);
  assert.equal((await f.post({...e,eventId:'not-uuid'})).status,400);
  assert.equal((await f.post({...e,eventId:crypto.randomUUID(),occurredAt:now.getTime()-86400001})).status,400);
  assert.equal((await f.post(event(),now,{'Sec-GPC':'1'})).status,200);assert.equal((await f.get()).totalViews,1);
});
test('v2: migration rerun preserves PV and since; old protocol stays compatible without fabricated UV',async()=>{
  const f=fixture();await f.post({path:'/zh/notes/a/',refs:[]});await f.post(event());const before=await f.get('?mode=summary');f.sqlite.exec(f.schema);const after=await f.get('?mode=summary');
  assert.equal(after.total,2);assert.equal(after.since,before.since);assert.equal(after.uv.since,before.uv.since);assert.equal(after.uv.today,1);assert.equal(after.uv.observedViews30Days,1);
});
const storage=()=>{const m=new Map();return {getItem:k=>m.get(k)||null,setItem:(k,v)=>m.set(k,v),removeItem:k=>m.delete(k)};};
function browser(href=origin+'/zh/cv/') {return {location:{origin,href},crypto,navigator:{},localStorage:storage(),sessionStorage:storage(),performance:{getEntriesByType:()=>[{type:'navigate'}]}};}
test('v2 browser: stable shared-browser identity, expiration, blocked storage does not inflate UV',async()=>{
  const b=browser();const a=await visitorId(b,100000);assert.equal(await visitorId(b,100100),a);assert.ok(a);
  assert.equal(await visitorId({...b},100200),a);assert.notEqual(await visitorId(b,100000+91*86400000),a);
  assert.equal(await visitorId({...b,localStorage:{getItem(){throw Error();}}}),null);
});
test('v2 browser: UTM and referrer provenance, internal inheritance, fresh direct entry resets source',()=>{
  const b=browser(origin+'/zh/?utm_source=wechat&utm_medium=group&utm_content=private');
  let r=entrySource(b,{referrer:''},100000);assert.deepEqual(r,{source:'wechat',medium:'group',basis:'utm'});assert.ok(!JSON.stringify(r).includes('private'));
  b.location.href=origin+'/zh/cv/';r=entrySource(b,{referrer:origin+'/zh/'},101000);assert.equal(r.source,'wechat');
  r=entrySource(b,{referrer:''},102000);assert.equal(r.basis,'unknown');
  r=entrySource(b,{referrer:'https://github.com/user/repo?secret=do-not-store'},103000);assert.equal(r.source,'github.com');assert.equal(r.basis,'referrer');
  r=entrySource(b,{referrer:origin+'/zh/'},103000+1800001);assert.equal(r.basis,'unknown');
  assert.equal(normalizeAttribution({basis:'utm',source:'name@email.com'}).basis,'unknown');assert.equal(normalizeAttribution({basis:'referrer',source:'127.0.0.1'}).basis,'unknown');
});
