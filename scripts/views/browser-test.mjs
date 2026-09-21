// Isolated UI test: production API is mocked; these requests never affect real counters.
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { resolve, extname } from 'node:path';
import { chromium } from 'playwright';
const root = resolve('dist');
const manifest = JSON.parse(await readFile('src/lib/view-counter/manifest.json', 'utf8'));
const article = Object.keys(manifest.pages).find((path) => path.startsWith('/zh/') && manifest.pages[path]);
const server = createServer(async (req, res) => {
  try {
    let path = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    if (!extname(path)) path = path.replace(/\/+$/, '') + '/index.html';
    const full = resolve(root, '.' + path);
    if (!full.startsWith(root + '/')) { res.writeHead(403).end(); return; }
    let data = await readFile(full);
    const type = extname(path) === '.js' ? 'application/javascript' : extname(path) === '.css' ? 'text/css' : extname(path) === '.html' ? 'text/html' : 'application/octet-stream';
    if (type === 'text/html') data = Buffer.from(data.toString().replaceAll('data-origin="https://sunionpeaks.pages.dev"', 'data-origin="http://127.0.0.1:4178"'));
    res.writeHead(200, { 'Content-Type': type }).end(data);
  } catch { res.writeHead(404).end(); }
});
await new Promise((resolve) => server.listen(4178, '127.0.0.1', resolve));
const browser = await chromium.launch({ headless: true });
const counts = { totalViews: 2416, articles: Object.fromEntries(Object.values(manifest.pages).filter(Boolean).map((ref) => [ref, 128])), since: '2026-09-21T00:00:00Z', timeZone: 'Asia/Shanghai' };
const checks = [];
try {
  for (const viewport of [{ width: 1440, height: 1000 }, { width: 390, height: 844 }]) {
    const context = await browser.newContext({ viewport });
    await context.route('**/*', async (route) => {
      const url = new URL(route.request().url());
      if (url.hostname !== '127.0.0.1') return route.abort();
      if (url.pathname === '/api/views') return route.fulfill({ json: counts });
      return route.continue();
    });
    const page = await context.newPage();
    await page.goto('http://127.0.0.1:4178/zh/');
    await page.locator('[data-view-count="site:total"]:visible').waitFor();
    assert.ok((await page.locator('[data-note-card] [data-view-count]:visible').count()) > 0);
    assert.equal(await page.locator('[data-note-card] [data-view-number]').first().textContent(), '128');
    await page.goto('http://127.0.0.1:4178' + article + '/');
    await page.locator('.note-kicker [data-view-count]:visible').waitFor();
    assert.equal(await page.locator('.note-kicker [data-view-number]').textContent(), '128');
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
    await mkdir('artifacts/views/ui', { recursive: true });
    await page.screenshot({ path: `artifacts/views/ui/article-${viewport.width}.png`, fullPage: false });
    checks.push({ viewport, articleCounter: true, cardCounters: true, footerCounter: true, horizontalOverflow: false, productionWrites: 0 });
    await page.route('**/api/views*', (route) => route.fulfill({ status: 503, json: { error: 'unavailable' } }));
    await page.reload(); await page.waitForTimeout(300);
    assert.equal(await page.locator('[data-view-count]:visible').count(), 0);
    await context.close();
  }
  await writeFile('artifacts/views/ui/checks.json', JSON.stringify({ isolatedMock: true, checks }, null, 2));
  console.log('Desktop/mobile counter rendering and failure-mode checks passed (isolated API).');
} finally { await browser.close(); server.close(); }
