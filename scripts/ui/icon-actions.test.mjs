// Isolated browser acceptance tests. No requests reach production or third parties.
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { resolve, extname } from 'node:path';
import { chromium } from 'playwright';
const root = resolve('dist');
const manifest = JSON.parse(await readFile('src/lib/view-counter/manifest.json', 'utf8'));
const article = Object.keys(manifest.pages).find(p => p.startsWith('/zh/notes/') && manifest.pages[p]);
const english = Object.keys(manifest.pages).find(p => p.startsWith('/en/notes/') && manifest.pages[p]);
assert.ok(article && english);
const base = 'http://127.0.0.1:4179';
const directory = 'artifacts/icon-actions';
await mkdir(directory, { recursive: true });
const server = createServer(async (req, res) => {
  try {
    let path = decodeURIComponent(new URL(req.url, base).pathname);
    if (!extname(path)) path = path.replace(/\/+$/, '') + '/index.html';
    const full = resolve(root, '.' + path);
    if (!full.startsWith(root + '/')) return res.writeHead(403).end();
    let data = await readFile(full);
    const type = ({ '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png' })[extname(path)] || 'application/octet-stream';
    if (type === 'text/html') data = Buffer.from(data.toString().replaceAll('data-origin="' + manifest.origin + '"', 'data-origin="' + base + '"'));
    res.writeHead(200, { 'Content-Type': type }).end(data);
  } catch { res.writeHead(404).end(); }
});
await new Promise(resolve => server.listen(4179, '127.0.0.1', resolve));
const browser = await chromium.launch({headless:true});
const counts = { totalViews: 2416, articles: Object.fromEntries(Object.entries(manifest.pages).map(([p, ref]) => [ref || `page:${p}`, p.includes('/notes/') ? 128 : 36])), since:'2026-09-21T00:00:00Z', timeZone:'Asia/Shanghai' };
const checks=[];
try {
  for (const width of [1440,390]) {
    const context = await browser.newContext({viewport:{width,height:width===390?844:1000}});
    const apiMethods=[];
    await context.route('**/*', route => {
      const u=new URL(route.request().url());
      if(u.origin!==base) return route.abort();
      if(u.pathname==='/api/views') { apiMethods.push(route.request().method()); return route.fulfill({json:counts}); }
      return route.continue();
    });
    await context.addInitScript(() => {
      Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async text=>{if(window.__denyCopy) throw new Error('blocked');window.__copiedLink=text;}}});
      window.print=()=>{window.__printRequested=true;};
    });
    const page=await context.newPage();
    const pageErrors=[];
    page.on('pageerror', e=>pageErrors.push(e.message));
    for (const [path,label] of [[article+'/','article'],[english+'/','article-en'],['/zh/','home'],['/en/','home-en'],['/zh/cv/','cv'],['/en/cv/','cv-en'],['/zh/contact/','contact']]) {
      await page.goto(base+path);
      await page.locator('footer [data-view-count]').waitFor({state:'visible'});
      assert.equal(await page.locator('footer [data-view-count]').count(),1);
      assert.equal(await page.locator('.language-pill').count(),0);
      assert.equal(await page.locator('.language-switch svg').count(),1);
      assert.equal(await page.locator('.language-switch').innerText(),'');
      assert.equal(await page.locator('footer .counter-privacy').innerText(),'');
      assert.ok((await page.locator('footer .counter-privacy').getAttribute('aria-label')).length>0);
      assert.equal(await page.locator('.cv-header [data-view-count], .note-kicker [data-view-count]').count(),0);
      assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),path+' overflow');
      for (const action of await page.locator('[data-icon-action]:visible').all()) {
        assert.ok(await action.getAttribute('aria-label'),'Accessible name');
        assert.ok(await action.getAttribute('title'),'Hover title');
        assert.ok((await action.locator('svg').count())>=1,'Icon rendered');
        const bounds=await action.boundingBox();
        assert.ok(bounds.width>=44 && bounds.height>=44,'44px touch target');
      }
      if(label.startsWith('article')) {
        const toolbar=page.locator('[data-engagement] .share-row');
        await toolbar.scrollIntoViewIfNeeded();
        assert.equal(await toolbar.locator('strong').count(),0);
        const x=page.locator('[data-share-x]');
        assert.equal(await x.count(),1);
        assert.equal(await x.innerText(),'');
        assert.equal(await x.getAttribute('target'),'_blank');
        const intent=new URL(await x.getAttribute('href'));
        assert.ok(['twitter.com','x.com'].includes(intent.hostname));
        const copy=page.locator('[data-copy-link]');
        assert.equal(intent.searchParams.get('url'),await copy.getAttribute('data-copy-link'));
        assert.equal(new URL(intent.searchParams.get('url')).origin,manifest.origin);
        assert.ok(intent.searchParams.get('text').trim().length>0);
        await copy.focus();
        assert.notEqual(await copy.evaluate(el=>getComputedStyle(el).outlineStyle),'none');
        await page.screenshot({path:`${directory}/${label}-share-${width}.png`});
        await copy.click();
        await page.locator('[data-copy-done]').waitFor({state:'visible'});
        assert.equal(await page.evaluate(()=>window.__copiedLink),await copy.getAttribute('data-copy-link'));
        assert.equal(await page.locator('[data-copy-fallback-row]').isVisible(),false);
        await page.evaluate(()=>{window.__denyCopy=true;});
        await copy.click();
        await page.locator('[data-copy-fallback-row]').waitFor({state:'visible'});
        const input=page.locator('[data-copy-fallback]');
        assert.ok(await input.evaluate(el=>document.activeElement===el&&el.selectionEnd===el.value.length));
        assert.equal(await copy.isDisabled(),false);
        await page.evaluate(()=>{window.__denyCopy=false;});
        await copy.click();
        await page.locator('[data-copy-fallback-row]').waitFor({state:'hidden'});
      }
      if(label==='cv') {
        await page.locator('.cv-actions').scrollIntoViewIfNeeded();
        assert.equal(await page.locator('.cv-actions .icon-action').count(),2);
        await page.locator('.cv-actions button').click();
        assert.equal(await page.evaluate(()=>window.__printRequested),true);
        assert.ok((await page.locator('.cv-actions a').getAttribute('href')).endsWith('.pdf'));
        await page.screenshot({path:`${directory}/cv-${width}.png`});
      }
      if(['home','contact'].includes(label)) await page.screenshot({path:`${directory}/${label}-${width}.png`});
      checks.push({path,width,accessibleNames:true,iconOnly:true,touchTarget44:true,footerPreserved:true});
    }
    assert.ok(apiMethods.every(method=>method==='GET'),'Automated check must not create PV');
    assert.deepEqual(pageErrors,[]);
    let diagramPath;
    for(const p of Object.keys(manifest.pages).filter(p=>p.startsWith('/zh/notes/'))) {
      if((await readFile(root+p+'/index.html','utf8')).includes('data-mermaid-diagram')) {diagramPath=p;break;}
    }
    if(diagramPath) {
      await page.goto(base+diagramPath+'/');
      const trigger=page.locator('.mermaid-zoom-trigger').first();
      await trigger.waitFor({state:'visible',timeout:20000});
      await trigger.click();
      const dialog=page.locator('[data-diagram-viewer]');
      await dialog.waitFor({state:'visible'});
      assert.equal(await dialog.locator('[data-icon-action]').count(),4);
      assert.equal(await dialog.locator('[data-diagram-reset]').innerText(),'');
      assert.equal(await dialog.locator('[data-diagram-close]').innerText(),'');
      await dialog.locator('[data-diagram-zoom-in]').click();
      assert.equal(await dialog.locator('[data-diagram-zoom-output]').innerText(),'125%');
      await dialog.locator('[data-diagram-reset]').click();
      assert.equal(await dialog.locator('[data-diagram-zoom-output]').innerText(),'100%');
      await dialog.locator('[data-diagram-close]').click();
      await dialog.waitFor({state:'hidden'});
      assert.equal(await trigger.evaluate(el=>document.activeElement===el),true);
      checks.push({diagramPath,width,zoomAndFit:true,closeAndFocusRestore:true});
    }
    await page.route('**/api/views*',route=>route.fulfill({status:503,json:{error:'unavailable'}}));
    await page.goto(base+'/zh/cv/');
    await page.waitForTimeout(250);
    assert.equal(await page.locator('[data-view-count]:visible').count(),0);
    assert.equal(await page.locator('.cv-header').isVisible(),true);
    await context.close();
  }
  await writeFile(`${directory}/checks.json`,JSON.stringify({isolated:true,productionWrites:0,fixtureCounts:true,checks},null,2));
  console.log('Icon actions passed: share/copy/fallback, both locales, desktop/mobile, CV print/download, footer, diagram zoom/fit/close, and accessible labels.');
} finally { await browser.close(); await new Promise(resolve=>server.close(resolve)); }
