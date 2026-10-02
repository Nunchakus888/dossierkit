import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile,writeFile} from 'node:fs/promises';
import {resolve,extname} from 'node:path';
import {createRequire} from 'node:module';
const require=createRequire(resolve('package.json'));
const {chromium}=require('playwright');
const sharp=createRequire(require.resolve('astro/package.json'))('sharp');
const root=resolve('dist'),out='artifacts/understanding-first';
const note=JSON.parse(await readFile(out+'/note.json','utf8'));
const path=new URL(note.publicUrl).pathname,base='http://127.0.0.1:4191';
const server=createServer(async(req,res)=>{
 try {
  let p=decodeURIComponent(new URL(req.url,base).pathname);
  if(!extname(p))p=p.replace(/\/+$/,'')+'/index.html';
  const full=resolve(root,'.'+p);
  if(!full.startsWith(root+'/'))return res.writeHead(403).end();
  const bytes=await readFile(full);
  const type=({'.html':'text/html','.js':'application/javascript','.css':'text/css','.svg':'image/svg+xml','.png':'image/png'})[extname(p)]||'application/octet-stream';
  res.writeHead(200,{'Content-Type':type}).end(bytes);
 }catch{res.writeHead(404).end();}
});
await new Promise(r=>server.listen(4191,'127.0.0.1',r));
const browser=await chromium.launch({headless:true}),checks=[];
try {
 for(const width of [390,1440]) {
  const context=await browser.newContext({viewport:{width,height:960},reducedMotion:'reduce'});
  const page=await context.newPage(),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await context.route('**/*',route=>{
   const u=new URL(route.request().url());
   if(u.origin!==base)return route.abort();
   if(u.pathname==='/api/views')return route.fulfill({status:503,json:{error:'isolated-test'}});
   return route.continue();
  });
  assert.equal((await page.goto(base+path)).status(),200);
  assert.equal(await page.locator('main h1').count(),1);
  assert.equal(await page.locator('main h1').innerText(),note.title);
  assert.equal(await page.locator('meta[name="dossierkit:note-ref"]').getAttribute('content'),note.noteRef);
  assert.equal((await page.locator('link[rel="canonical"]').getAttribute('href')).replace(/\/$/,''),note.publicUrl.replace(/\/$/,''));
  await page.locator('[data-mermaid-diagram][data-diagram-ready="true"]').waitFor({state:'visible',timeout:30000});
  assert.equal(await page.locator('[data-mermaid-diagram]').count(),1);
  assert.equal(await page.locator('.mermaid-failed').count(),0);
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'No horizontal overflow');
  const coverUrl=new URL(await page.locator('meta[property="og:image"]').getAttribute('content'));
  assert.equal(coverUrl.origin,'https://sunionpeaks.pages.dev');
  const bytes=await readFile(resolve(root,'.'+coverUrl.pathname)),meta=await sharp(bytes).metadata();
  assert.equal(meta.width,1200);assert.equal(meta.height,630);assert.equal(meta.format,'png');assert.ok(bytes.length<2000000);
  const sources=await page.locator('main a[href^="https://"]').evaluateAll(els=>els.map(el=>el.href));
  for(const prefix of ['https://x.com/karpathy/status/2105819303471976479','https://www.asd-ste100.org/','https://www.w3.org/WAI/'])assert.ok(sources.some(s=>s.startsWith(prefix)));
  for(const a of await page.locator('main a[href^="#"]').all()) {
   const id=(await a.getAttribute('href')).slice(1);
   assert.ok(await page.evaluate(id=>Boolean(document.getElementById(id)),decodeURIComponent(id)),'Valid anchor');
  }
  await page.screenshot({path:`${out}/note-${width}.png`});
  await page.locator('[data-mermaid-diagram]').scrollIntoViewIfNeeded();
  await page.screenshot({path:`${out}/diagram-${width}.png`});
  assert.deepEqual(errors,[]);
  checks.push({width,oneH1:true,validAnchors:true,mermaidRendered:true,noOverflow:true,coverDimensions:[1200,630],productionWrites:0});
  await context.close();
 }
 await writeFile(out+'/browser-checks.json',JSON.stringify({noteRef:note.noteRef,checks},null,2));
 console.log('Understanding-first article: desktop/mobile rendering, anchors, Mermaid and cover verified without production traffic.');
}finally{await browser.close();await new Promise(r=>server.close(r));}
