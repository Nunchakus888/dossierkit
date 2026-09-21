import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { handleViews, dayInZone, normalizePath } from '../../src/lib/view-counter/server.mjs';
import { startViewCounter } from '../../src/lib/view-counter/client.mjs';
const origin = 'https://sunionpeaks.pages.dev';
const manifest = { origin, timeZone: 'Asia/Shanghai', pages: {
  '/zh': null, '/en': null, '/zh/notes': null, '/zh/notes/first': 'zh/first', '/en/notes/first': 'en/first'
}};
const now = new Date('2026-09-21T18:00:00Z');
function fixture() {
  const sqlite = new DatabaseSync(':memory:');
  const migration = ['0001_views.sql','0002_uv_sources.sql'].map((name) => readFileSync(new URL('../../migrations/views/' + name, import.meta.url), 'utf8')).join('\n');
  sqlite.exec(migration);
  const execute = (sql, params = []) => {
    const prepared = sqlite.prepare(sql);
    if (/^\s*(SELECT|WITH|PRAGMA)/i.test(sql)) return { success: true, results: prepared.all(...params) };
    prepared.run(...params);
    return { success: true, results: [] };
  };
  const db = {
    prepare(sql) {
      const make = (params = []) => ({ sql, params, bind: (...values) => make(values), all: async () => execute(sql, params) });
      return make();
    },
    async batch(statements) {
      sqlite.exec('BEGIN');
      try {
        const results = statements.map((item, index) => {
          if (db.failAt === index) throw new Error('Injected database failure');
          return execute(item.sql, item.params);
        });
        sqlite.exec('COMMIT'); return results;
      } catch (error) { sqlite.exec('ROLLBACK'); throw error; }
    }
  };
  const request = async ({ path = '/zh/notes/first/', refs = [], date = now, body, headers = {}, url = origin + '/api/views' } = {}) => {
    return handleViews(new Request(url, { method: 'POST', headers: { Origin: origin, 'Content-Type': 'application/json',
      'User-Agent': 'Mozilla/5.0', ...headers }, body: body ?? JSON.stringify({ path, refs }) }), { VIEWS_DB: db }, manifest, date);
  };
  const get = (query = '', date = now) => handleViews(new Request(origin + '/api/views' + query), { VIEWS_DB: db }, manifest, date);
  return { sqlite, db, request, get, migration };
}
test('article + site increment once; cards are read-only; GET is read-only', async () => {
  const f = fixture();
  const response = await f.request({ refs: ['en/first', 'zh/first'] });
  assert.equal(response.status, 200);
  assert.deepEqual((await response.json()).articles, { 'en/first': 0, 'zh/first': 1 });
  for (let i = 0; i < 3; i++) assert.equal((await (await f.get('?ref=zh/first')).json()).totalViews, 1);
  await f.request({ path: '/zh/' });
  const result = await (await f.get('?ref=zh/first')).json();
  assert.equal(result.totalViews, 2); assert.equal(result.articles['zh/first'], 1);
});
test('daily rollups use site timezone and 7/30 natural days', async () => {
  const f = fixture();
  for (const date of ['2026-09-21T15:59:59Z', '2026-09-21T16:00:00Z', '2026-09-21T18:00:00Z']) await f.request({ date: new Date(date) });
  const result = await (await f.get('?mode=summary&ref=zh/first')).json();
  assert.equal(result.day, '2026-09-22'); assert.equal(result.today, 2);
  assert.equal(result.yesterday, 1); assert.equal(result.last7Days, 3); assert.equal(result.last30Days, 3);
  assert.equal(result.trend.length, 30); assert.equal(result.total, 3);
  assert.equal(dayInZone(new Date('2026-09-21T16:00:00Z'), 'Asia/Shanghai'), '2026-09-22');
});
test('concurrent increments are atomic and migrations never reset data', async () => {
  const f = fixture();
  await Promise.all(Array.from({ length: 40 }, () => f.request()));
  f.sqlite.exec(f.migration);
  const s = await (await f.get('?mode=summary')).json();
  assert.equal(s.total, 40); assert.equal(s.today, 40);
  const a = await (await f.get('?mode=summary&ref=zh/first')).json();
  assert.equal(a.total, 40); assert.equal(a.today, 40);
});
test('failed transaction rolls back BOTH cumulative and daily counts', async () => {
  const f = fixture(); f.db.failAt = 1;
  assert.equal((await f.request()).status, 503);
  delete f.db.failAt;
  const result = await (await f.get('?mode=summary')).json();
  assert.equal(result.total, 0); assert.equal(result.today, 0);
});
test('unbound database is unavailable, never a plausible fake zero', async () => {
  const result = await handleViews(new Request(origin + '/api/views'), {}, manifest);
  assert.equal(result.status, 503); assert.ok(!('totalViews' in await result.json()));
});
test('preview origins, cross-site reports, mismatched referers are rejected', async () => {
  const f = fixture();
  assert.equal((await f.request({ url: 'https://preview.sunionpeaks.pages.dev/api/views' })).status, 403);
  assert.equal((await f.request({ headers: { Origin: 'https://unrelated.example' } })).status, 403);
  assert.equal((await f.request({ headers: { 'Sec-Fetch-Site': 'cross-site' } })).status, 403);
  assert.equal((await f.request({ headers: { Referer: origin + '/zh/' } })).status, 403);
  assert.equal((await f.request({ headers: { Referer: origin + '/zh/notes/first/?utm_source=test' } })).status, 200);
});
test('unknown paths, admin, API, 404 and forged article refs do not create rows', async () => {
  const f = fixture();
  for (const path of ['/admin', '/api/mcp', '/404', '/', '/zh/not-published', '/zh/notes/first/?foo=1']) {
    assert.equal((await f.request({ path })).status, 400);
  }
  assert.equal((await f.request({ refs: ['zh/missing'] })).status, 400);
  assert.equal((await f.request({ refs: Array(61).fill('zh/first') })).status, 400);
  assert.equal((await f.get('?ref=zh/missing')).status, 400);
  assert.equal((await (await f.get()).json()).totalViews, 0);
  assert.equal(f.sqlite.prepare('SELECT COUNT(*) AS n FROM view_daily').get().n, 0);
});
test('bad payloads and oversized requests are rejected', async () => {
  const f = fixture();
  for (const body of ['not json', 'null', '[]', '"hello"', 'a'.repeat(4100)]) assert.equal((await f.request({ body })).status, 400);
  assert.equal((await f.request({ headers: { 'Content-Type': 'text/plain' } })).status, 415);
});
test('known robots and audits do not write; external links/query variations share identity', async () => {
  const f = fixture();
  assert.equal((await f.request({ headers: { 'User-Agent': 'Googlebot' } })).status, 204);
  assert.equal((await f.request({ headers: { 'User-Agent': 'DossierKit-Deployment-Audit/1.0' } })).status, 204);
  await f.request({ path: '/zh/notes/first/index.html' });
  assert.equal((await (await f.get('?ref=zh/first')).json()).articles['zh/first'], 1);
  assert.equal(normalizePath('/zh/notes/first/'), normalizePath('/zh/notes/first'));
});
test('rankings are generated from aggregates, not extra tracking', async () => {
  const f = fixture();
  await f.request(); await f.request(); await f.request({ path: '/en/notes/first/' });
  for (const period of ['all', '7d', '30d']) {
    const result = await (await f.get('?mode=top&period=' + period)).json();
    assert.deepEqual(result.articles, [{ ref: 'zh/first', views: 2 }, { ref: 'en/first', views: 1 }]);
  }
  assert.equal((await f.get('?mode=top&period=36500d')).status, 400);
});
function browser({ visible = true, exclude = false, available = true, configured = true } = {}) {
  const listeners = new Map(); const calls = [];
  const widget = (ref) => ({ dataset: { viewCount: ref }, hidden: true, number: { textContent: '' },
    querySelector() { return this.number; }, setAttribute() {} });
  const widgets = [widget('site:total'), widget('zh/first')];
  const doc = { documentElement: { lang: 'zh' }, visibilityState: visible ? 'visible' : 'hidden',
    querySelector: () => configured ? { dataset: { origin } } : null,
    querySelectorAll: () => widgets, addEventListener: (key, fn) => listeners.set(key, fn), removeEventListener: (key) => listeners.delete(key) };
  const win = { crypto, location: { origin, pathname: '/zh/' }, navigator: {}, localStorage: { getItem: () => exclude ? '1' : null },
    setTimeout, clearTimeout,
    fetch: async (url, options) => { calls.push({ url: url.href, options }); return available ? Response.json({ totalViews: 7, articles: { 'zh/first': 4 }, timeZone: 'Asia/Shanghai', since: '2026-09-21T00:00:00Z' }) : new Response(null, { status: 503 }); } };
  return { doc, win, calls, widgets, listeners };
}
const settle = () => new Promise((resolve) => setTimeout(resolve, 0));
test('client sends one report, paints site + cards, repeated initialization does not double-count', async () => {
  const b = browser(); startViewCounter(b.win, b.doc); startViewCounter(b.win, b.doc); await settle();
  assert.equal(b.calls.length, 1); assert.equal(b.calls[0].options.method, 'POST');
  assert.equal(b.widgets[0].number.textContent, '7'); assert.equal(b.widgets[1].number.textContent, '4');
  assert.equal(b.widgets[0].hidden, false);
});
test('hidden tabs wait until visible, then count only once', async () => {
  const b = browser({ visible: false }); startViewCounter(b.win, b.doc); await settle(); assert.equal(b.calls.length, 0);
  b.doc.visibilityState = 'visible'; b.listeners.get('visibilitychange')(); await settle(); assert.equal(b.calls.length, 1);
  assert.equal(b.listeners.size, 0);
});
test('opt-out and webdriver read without counting', async () => {
  for (const exclusion of ['local', 'webdriver', 'gpc']) {
    const b = browser({ exclude: exclusion === 'local' });
    if (exclusion === 'webdriver') b.win.navigator.webdriver = true;
    if (exclusion === 'gpc') b.win.navigator.globalPrivacyControl = true;
    startViewCounter(b.win, b.doc); await settle(); assert.equal(b.calls[0].options.method, 'GET');
  }
});
test('failed statistics stay hidden; disabled build makes no API request', async () => {
  const b = browser({ available: false }); startViewCounter(b.win, b.doc); await settle();
  assert.ok(b.widgets.every((widget) => widget.hidden)); assert.equal(b.calls.length, 1);
  const disabled = browser({ configured: false }); startViewCounter(disabled.win, disabled.doc); await settle(); assert.equal(disabled.calls.length, 0);
});
