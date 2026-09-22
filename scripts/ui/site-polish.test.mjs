// Isolated acceptance: local static build, mocked counters, no production requests.
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile, mkdir, writeFile, readdir } from 'node:fs/promises';
import { resolve, extname } from 'node:path';
import { chromium } from 'playwright';
const root=resolve('dist');
const directory='artifacts/site-polish';
await mkdir(directory,{recursive:true});
const manifest=JSON.parse(await readFile('src/lib/view-counter/manifest.json','utf8'));
const base='http://127.0.0.1:4182';
const note='/zh/notes/github-copilot-agent-runtime-rust-ffi-harness-ai/';
const anchor='qian-yi-ce-l-e-atomic-replacement';
const counts={totalViews:2416,articles:Object.fromEntries(Object.entries(manifest.pages).map(([p,r])=>[r||`page:${p}`,128])),since:'2026-09-21T00:00:00Z',timeZone:'Asia/Shanghai'};
const checks=[];
// Fetch only the already-used public font, before opening pages. Keep font bytes
// in runner memory, never in screenshots/evidence artifacts or the repository.
const fontCssUrl='https://fonts.googleapis.com/css2?family=Pacifico&display=swap';
const cssResponse=await fetch(fontCssUrl,{signal:AbortSignal.timeout(20000),headers:{'User-Agent':'Mozilla/5.0 Chrome/130.0.0.0 Safari/537.36'}});
assert.ok(cssResponse.ok,'Existing signature font stylesheet is available');
const fontCss=await cssResponse.text();
const fontAssets=new Map();
for(const url of new Set([...fontCss.matchAll(/url\((https:\/\/fonts\.gstatic\.com\/[^)]+)\)/g)].map(m=>m[1]))) {
  const response=await fetch(url,{signal:AbortSignal.timeout(20000)});
  assert.ok(response.ok,'Existing signature font can load');
  fontAssets.set(url,Buffer.from(await response.arrayBuffer()));
}
assert.ok(fontAssets.size);
const server=createServer(async(req,res)=>{
  try {
    let path=decodeURIComponent(new URL(req.url,base).pathname);
    if(!extname(path))path=path.replace(/\/+$/,'')+'/index.html';
    const full=resolve(root,'.'+path);
    if(!full.startsWith(root+'/'))return res.writeHead(403).end();
    let body=await readFile(full);
    const type=({'.html':'text/html','.js':'application/javascript','.css':'text/css','.svg':'image/svg+xml','.png':'image/png'})[extname(path)]||'application/octet-stream';
    if(type==='text/html')body=Buffer.from(body.toString().replaceAll('data-origin="'+manifest.origin+'"','data-origin="'+base+'"'));
    res.writeHead(200,{'Content-Type':type}).end(body);
  }catch{res.writeHead(404).end();}
});
await new Promise(r=>server.listen(4182,'127.0.0.1',r));
const browser=await chromium.launch({headless:true});
try {
  // Every rendered locale link, including missing-content fallbacks, resolves.
  let linkCount=0;
  async function scan(dir) {
    for(const entry of await readdir(dir,{withFileTypes:true})) {
      const path=resolve(dir,entry.name);
      if(entry.isDirectory()){await scan(path);continue;}
      if(!entry.name.endsWith('.html'))continue;
      const html=await readFile(path,'utf8');
      const tag=html.match(/<a\b[^>]*\bdata-language-switch(?:\s|=|>)[^>]*>/);
      if(!tag)continue;
      const href=tag[0].match(/\bhref="([^"]+)"/)?.[1];
      assert.ok(href?.startsWith('/'));
      await readFile(resolve(root,'.'+href,'index.html'));
      linkCount++;
    }
  }
  await scan(root);assert.ok(linkCount>=60);
  checks.push({validLanguageTargets:linkCount});
  for(const width of [1440,768,390,320]) {
    const height=width>900?1000:844;
    const context=await browser.newContext({viewport:{width,height}});
    const apiMethods=[];const errors=[];
    await context.route('**/*',async route=>{
      const url=new URL(route.request().url());
      if(url.hostname==='fonts.googleapis.com')return route.fulfill({contentType:'text/css',body:fontCss});
      if(fontAssets.has(url.href))return route.fulfill({contentType:'font/woff2',body:fontAssets.get(url.href)});
      if(url.origin!==base)return route.abort();
      if(url.pathname==='/api/views'){apiMethods.push(route.request().method());return route.fulfill({json:counts});}
      return route.continue();
    });
    const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
    for(const path of ['/zh/','/en/','/zh/cv/']) {
      assert.equal((await page.goto(base+path)).status(),200);
      await page.evaluate(()=>document.fonts.load('400 24px Pacifico'));
      assert.ok(await page.evaluate(()=>document.fonts.check('400 24px Pacifico')));
      const brand=page.locator('.brand-word');
      assert.equal(await brand.innerText(),'The Emergence of Everything');
      assert.match(await brand.evaluate(el=>getComputedStyle(el).fontFamily),/Pacifico/);
      assert.equal(await brand.evaluate(el=>getComputedStyle(el).fontWeight),'400');
      assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'Header does not overflow: '+path+' '+width);
      const brandBounds=await brand.boundingBox(), langBounds=await page.locator('.language-switch').boundingBox();
      assert.ok(brandBounds.x+brandBounds.width<=langBounds.x+1,'Wordmark does not overlap language control');
      assert.ok(langBounds.width>=44&&langBounds.height>=44);
      const search=page.locator('[data-note-search]');
      if(await search.count()){const b=await search.boundingBox();assert.ok(brandBounds.x+brandBounds.width<=b.x+2,'Wordmark does not overlap search');}
      assert.equal(await page.locator('[data-translation-available="true"]').count(),1);
      if(path==='/zh/')await page.screenshot({path:`${directory}/home-${width}.png`});
      if(path==='/zh/cv/'){await page.locator('.language-switch').click();assert.ok(page.url().endsWith('/en/cv/'));}
    }
    assert.equal((await page.goto(base+note+'#'+anchor)).status(),200);
    await page.locator('[data-mermaid-diagram][data-diagram-ready="true"]').nth(1).waitFor({state:'visible',timeout:30000});
    const diagram=page.locator('[data-mermaid-diagram]').nth(1);
    const dimensions=await diagram.evaluate(el=>{
      const svg=el.querySelector('svg');const b=svg.getBoundingClientRect();const box=svg.viewBox.baseVal;
      return {width:b.width,height:b.height,naturalWidth:box.width,naturalHeight:box.height,container:el.getBoundingClientRect().width,overflow:el.scrollWidth>el.clientWidth+1};
    });
    assert.ok(dimensions.width<=dimensions.naturalWidth+1,'Narrow chart is never upscaled');
    assert.ok(dimensions.width<=dimensions.container,'Diagram fits the document');
    assert.ok(!dimensions.overflow,'No arbitrary 640px horizontal overflow');
    assert.ok(Math.abs((dimensions.width/dimensions.height)/(dimensions.naturalWidth/dimensions.naturalHeight)-1)<.01,'Aspect ratio preserved');
    assert.ok(dimensions.height<1050,'Compact vertical state diagram');
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
    await page.locator('#'+anchor).scrollIntoViewIfNeeded();
    await page.screenshot({path:`${directory}/atomic-anchor-${width}.png`});
    await diagram.screenshot({path:`${directory}/atomic-diagram-${width}.png`});
    await diagram.hover();
    const trigger=diagram.locator('.mermaid-zoom-trigger');
    await trigger.click();
    const viewer=page.locator('[data-diagram-viewer]');await viewer.waitFor({state:'visible'});
    await page.waitForTimeout(100);
    const fit=await viewer.evaluate(el=>{
      const stage=el.querySelector('[data-diagram-stage]');const svg=el.querySelector('[data-diagram-canvas] svg');const b=svg.getBoundingClientRect();const style=getComputedStyle(stage);
      return {width:b.width,height:b.height,availableWidth:stage.clientWidth-parseFloat(style.paddingLeft)-parseFloat(style.paddingRight),availableHeight:stage.clientHeight-parseFloat(style.paddingTop)-parseFloat(style.paddingBottom)};
    });
    assert.ok(fit.width<=fit.availableWidth+1&&fit.height<=fit.availableHeight+1,'Fit respects width AND height');
    await page.screenshot({path:`${directory}/atomic-expanded-${width}.png`});
    await viewer.locator('[data-diagram-zoom-in]').click();
    assert.equal(await viewer.locator('[data-diagram-zoom-output]').innerText(),'125%');
    await viewer.locator('[data-diagram-reset]').click();
    assert.equal(await viewer.locator('[data-diagram-zoom-output]').innerText(),'100%');
    await page.keyboard.press('Escape');await viewer.waitFor({state:'hidden'});
    assert.ok(await trigger.evaluate(el=>el===document.activeElement));
    const share=page.locator('[data-engagement] .share-row');await share.scrollIntoViewIfNeeded();
    const align=await share.evaluate(el=>{const row=el.getBoundingClientRect();const a=[...el.querySelectorAll('[data-icon-action]')].at(-1).getBoundingClientRect();return Math.abs(row.right-a.right);});
    assert.ok(align<2,'Share tools align to right edge');
    await page.screenshot({path:`${directory}/share-right-${width}.png`});
    await page.evaluate(()=>window.scrollTo({top:0,behavior:'instant'}));
    const language=page.locator('[data-language-switch]');
    assert.equal(await language.getAttribute('data-translation-available'),'false');
    assert.equal(await language.getAttribute('href'),'/en/notes/');
    const original=page.url();await language.click();
    const notice=page.locator('[data-language-notice]');await notice.waitFor({state:'visible'});
    assert.equal(page.url(),original,'Missing translation does not navigate');
    assert.ok(await notice.locator('[data-language-stay]').evaluate(el=>el===document.activeElement));
    await page.screenshot({path:`${directory}/language-notice-${width}.png`});
    await page.keyboard.press('Escape');await notice.waitFor({state:'hidden'});
    assert.equal(page.url(),original);assert.ok(await language.evaluate(el=>el===document.activeElement));
    await language.click();await notice.locator('[data-language-stay]').click();await notice.waitFor({state:'hidden'});
    assert.equal(page.url(),original);
    await language.click();const fallback=notice.locator('[data-language-fallback]');
    await fallback.click();assert.ok(page.url().endsWith('/en/notes/'));
    assert.equal(await page.locator('html').getAttribute('lang'),'en');
    assert.deepEqual(errors,[]);
    assert.ok(apiMethods.every(m=>m==='GET'),'Automated tests never add PV');
    checks.push({width,height,signatureFontLoaded:true,shareRightAligned:true,translationNotice:true,translationFallback200:true,cvSwitch200:true,dimensions,fit,productionWrites:0});
    await context.close();
  }
  await writeFile(`${directory}/checks.json`,JSON.stringify({isolated:true,fixtureCounts:true,productionWrites:0,checks},null,2));
  console.log('Site polish acceptance passed: exact locale targets, missing-translation dialog, share alignment, real signature font, intrinsic Mermaid and modal sizing.');
}finally{await browser.close();await new Promise(r=>server.close(r));}
