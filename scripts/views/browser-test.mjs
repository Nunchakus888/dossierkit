// Isolated UI test: all external requests are blocked and the API is mocked.
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { resolve, extname } from 'node:path';
import { chromium } from 'playwright';
const root = resolve('dist');
const manifest = JSON.parse(await readFile('src/lib/view-counter/manifest.json', 'utf8'));
const article = Object.keys(manifest.pages).find((path) => path.startsWith('/zh/notes/') && !manifest.pages[path]?.startsWith('page:'));
assert.ok(article, 'A published article must be tested');
const base = 'http://127.0.0.1:4178';
const server = createServer(async (req, res) => {
  try {
    let path = decodeURIComponent(new URL(req.url, base).pathname);
    if (!extname(path)) path = path.replace(/\/+$/, '') + '/index.html';
    const full = resolve(root, '.' + path);
    if (!full.startsWith(root + '/')) { res.writeHead(403).end(); return; }
    let data = await readFile(full);
    const type = extname(path) === '.js' ? 'application/javascript' : extname(path) === '.css' ? 'text/css' : extname(path) === '.html' ? 'text/html' : 'application/octet-stream';
    if (type === 'text/html') data = Buffer.from(data.toString().replaceAll('data-origin="' + manifest.origin + '"', 'data-origin="' + base + '"'));
    res.writeHead(200, { 'Content-Type': type }).end(data);
  } catch { res.writeHead(404).end(); }
});
await new Promise((resolve) => server.listen(4178, '127.0.0.1', resolve));
const browser = await chromium.launch({ headless: true });
const counts = { totalViews: 2416, articles: Object.fromEntries(Object.entries(manifest.pages).map(([path, ref]) => [ref || `page:${path}`, ref && !ref.startsWith('page:') ? 128 : 36])), since: '2026-09-21T00:00:00Z', timeZone: 'Asia/Shanghai' };
const checks = [];
await mkdir('artifacts/views/ui', { recursive: true });
try {
  for (const viewport of [{ width: 1440, height: 1000 }, { width: 390, height: 844 }]) {
    const context = await browser.newContext({ viewport });
    const requests = [];
    await context.route('**/*', async (route) => {
      const url = new URL(route.request().url());
      if (url.origin !== base) return route.abort();
      if (url.pathname === '/api/views') { requests.push(route.request().method()); return route.fulfill({ json: counts }); }
      return route.continue();
    });
    const page = await context.newPage();
    for (const locale of ['zh', 'en']) {
      await page.goto(`${base}/${locale}/`);
      const widget = page.locator('footer [data-view-count="site:total"]');
      await widget.waitFor({ state: 'visible' });
      assert.equal(await widget.innerText(), '2,416');
      assert.equal(await widget.locator('svg').count(), 1);
      assert.equal(await widget.locator('[data-view-total-number]').count(), 0);
      assert.ok(await page.locator('[data-note-card] [data-view-count]').count());
      assert.equal(await page.locator('[data-note-card] [data-view-number]').first().textContent(), '128');
      await page.locator('footer').scrollIntoViewIfNeeded();
      if (locale === 'zh') await page.screenshot({ path: `artifacts/views/ui/home-footer-${viewport.width}.png` });
    }
    for (const [path, label] of [[article + '/', 'article'], ['/zh/cv/', 'cv'], ['/en/cv/', 'cv-en'], ['/zh/contact/', 'contact'], ['/zh/notes/', 'notes-list']]) {
      requests.length = 0;
      await page.goto(base + path);
      const ref = manifest.pages[path.replace(/\/+$/, '')];
      const widget = page.locator('footer [data-view-count]');
      await widget.waitFor({ state: 'visible' });
      assert.equal(await widget.count(), 1);
      assert.equal(await widget.getAttribute('data-view-count'), ref);
      assert.equal(await widget.locator('svg').count(), 1);
      assert.equal(await widget.locator('[data-view-number]').innerText(), label === 'article' ? '128' : '36');
      assert.equal(await widget.locator('[data-view-total-number]').innerText(), '2,416');
      assert.equal((await widget.innerText()).replace(/\s/g, ''), (label === 'article' ? '128' : '36') + '/2,416');
      assert.match(await widget.getAttribute('aria-label'), label === 'cv-en' ? /This page: 36 views \/ Site: 2,416 views/ : /本页浏览 .* 次 \/ 全站浏览 2,416 次/);
      assert.equal(await page.locator('.note-kicker [data-view-count], .cv-header [data-view-count], .page-view-meta').count(), 0);
      if (label !== 'notes-list') assert.equal(await page.locator('main [data-view-count]').count(), 0);
      assert.deepEqual(requests, ['GET'], 'Automated browser reads only, one shared request');
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
      if (['article', 'cv'].includes(label)) {
        await page.screenshot({ path: `artifacts/views/ui/${label}-header-${viewport.width}.png` });
        await page.locator('footer').scrollIntoViewIfNeeded();
        await page.screenshot({ path: `artifacts/views/ui/${label}-footer-${viewport.width}.png` });
      }
      assert.equal(await widget.evaluate((el) => getComputedStyle(el).fontWeight), '400');
      assert.equal(await widget.evaluate((el) => getComputedStyle(el).fontSize), '12px');
      checks.push({ path, viewport, oneFooterEye: true, paired: true, noHeaderCounter: true, noHorizontalOverflow: true, productionWrites: 0 });
    }
    await page.goto(base + '/zh/cv/');
    await page.locator('footer [data-view-count]').waitFor({ state: 'visible' });
    // The same widget works for long totals without wrapping or adding an icon.
    await page.route('**/api/views*', (route) => route.fulfill({ json: { ...counts, totalViews: 123456789, articles: { 'page:/zh/cv': 9876543 } } }));
    await page.reload();
    await page.locator('footer [data-view-count]').waitFor({ state: 'visible' });
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
    await page.route('**/api/views*', (route) => route.fulfill({ status: 503, json: { error: 'unavailable' } }));
    await page.reload(); await page.waitForTimeout(300);
    assert.equal(await page.locator('[data-view-count]').filter({ visible: true }).count(), 0);
    assert.ok(await page.locator('.cv-header').isVisible());
    await context.close();
  }
  await writeFile('artifacts/views/ui/checks.json', JSON.stringify({ isolatedMock: true, fixtureCountsOnly: true, checks }, null, 2));
  console.log('Compact footer counter: homepage, article, CV, list, mobile/desktop, large numbers and failure mode passed.');
} finally { await browser.close(); server.close(); }
