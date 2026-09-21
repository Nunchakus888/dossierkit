import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { inspectViewMarkup } from './html-inspect.mjs';
const infra = JSON.parse(await readFile('artifacts/views/infrastructure.json', 'utf8'));
const manifest = JSON.parse(await readFile('src/lib/view-counter/manifest.json', 'utf8'));
const articlePath = Object.keys(manifest.pages).find((path) => manifest.pages[path]);
const get = (path) => fetch(manifest.origin + path, {
  headers: { 'User-Agent': 'DossierKit-Deployment-Audit/1.0' }, cache: 'no-store', signal: AbortSignal.timeout(15000)
});
let lastError;
for (let attempt = 0; attempt < 5; attempt++) {
  try {
    const [home, article, api] = await Promise.all([get('/zh/'), get(articlePath + '/'), get('/api/views')]);
    assert.equal(home.status, 200); assert.equal(article.status, 200);
    const [homeHtml, articleHtml, counts] = await Promise.all([home.text(), article.text(), api.json()]);
    const homeMarkup = inspectViewMarkup(homeHtml);
    const articleMarkup = inspectViewMarkup(articleHtml);
    const active = infra.ready === true;
    assert.equal(api.status, active ? 200 : 503);
    assert.equal(homeMarkup.configured, active);
    assert.equal(articleMarkup.configured, active);
    if (active) {
      assert.ok(Number.isSafeInteger(counts.totalViews) && counts.totalViews >= 0);
      assert.ok(counts.since); assert.equal(counts.timeZone, manifest.timeZone);
      const summary = await (await get('/api/views?mode=summary')).json();
      assert.equal(summary.trend.length, 30);
      assert.ok(Number.isSafeInteger(summary.last7Days));
      assert.equal(counts.schemaVersion, 2);
      assert.equal(summary.uv.identity, 'first-party-browser');
      assert.ok(Number.isSafeInteger(summary.uv.last30Days));
      for (const path of ['/zh/cv/', '/en/cv/', '/zh/contact/']) {
        const page = await get(path); assert.equal(page.status, 200);
        const markup = inspectViewMarkup(await page.text());
        assert.ok(markup.refs.includes('page:' + path.replace(/\/+$/, '')));
        const statsResponse = await get('/api/views?mode=summary&path=' + encodeURIComponent(path));
        assert.equal(statsResponse.status, 200);
        const stats = await statsResponse.json(); assert.ok(Number.isSafeInteger(stats.total));
        assert.ok(Number.isSafeInteger(stats.uv.today));
      }
      const sourceResponse = await get('/api/views?mode=sources&period=7d&path=%2Fzh%2Fcv%2F');
      assert.equal(sourceResponse.status, 200);
      const sourceData = await sourceResponse.json(); assert.ok(Array.isArray(sourceData.sources));
      assert.ok(!JSON.stringify(sourceData).includes('visitor_hash'));
      const privacy = await get('/zh/privacy/'); assert.equal(privacy.status, 200);
      const top = await (await get('/api/views?mode=top&period=7d')).json();
      assert.ok(Array.isArray(top.articles));
      assert.ok(homeMarkup.refs.includes('site:total'));
      assert.ok(articleMarkup.refs.includes(manifest.pages[articlePath]));
    } else {
      assert.ok(!('totalViews' in counts));
      assert.equal(homeMarkup.refs.length, 0);
      assert.equal(articleMarkup.refs.length, 0);
    }
    const receipt = { checkedAt: new Date().toISOString(), counterActive: active,
      schemaVersion: 2, standalonePagesVerified: ['/zh/cv/', '/en/cv/', '/zh/contact/'], uvAndSourcesVerified: active,
      productionOrigin: manifest.origin, apiStatus: api.status, staticPagesHealthy: true,
      automatedWritesToProduction: 0,
      status: active ? 'active' : 'code-deployed-awaiting-d1-permission',
      requiredAction: active ? null : infra.requiredAction };
    await mkdir('artifacts/views', { recursive: true });
    await writeFile('artifacts/views/live-receipt.json', JSON.stringify(receipt, null, 2));
    console.log(JSON.stringify(receipt, null, 2));
    process.exit(0);
  } catch (error) {
    lastError = error;
    if (attempt < 4) await new Promise((resolve) => setTimeout(resolve, 4000));
  }
}
throw lastError;
