// Local browser acceptance only: never sends production counters or external analytics.
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile,writeFile,mkdir,readdir} from 'node:fs/promises';
import {resolve,extname} from 'node:path';
import {chromium} from 'playwright';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const sharp = createRequire(require.resolve('astro/package.json'))('sharp');
const root=resolve('dist'), out='artifacts/brand-refresh', base='http://127.0.0.1:4186';
await mkdir(out,{recursive:true});
const manifest=JSON.parse(await readFile('src/lib/view-counter/manifest.json','utf8'));
const counts={totalViews:2416,articles:Object.fromEntries(Object.entries(manifest.pages).map(([p,r])=>[r||`page:${p}`,128])),since:'2026-09-21T00:00:00Z',timeZone:'Asia/Shanghai'};
const fontResponse=await fetch('https://fonts.googleapis.com/css2?family=Pacifico&display=swap',{signal:AbortSignal.timeout(20000),headers:{'User-Agent':'Mozilla/5.0 Chrome/130.0.0.0 Safari/537.36'}});
assert.ok(fontResponse.ok);
const fontCSS=await fontResponse.text(), fonts=new Map();
for(const url of new Set([...fontCSS.matchAll(/url\((https:\/\/fonts\.gstatic\.com\/[^)]+)\)/g)].map(m=>m[1]))) {
 const r=await fetch(url,{signal:AbortSignal.timeout(20000)});assert.ok(r.ok);fonts.set(url,Buffer.from(await r.arrayBuffer()));
}
assert.ok(fonts.size,'Real signature font needed for visual verification; bytes stay in memory only');
const types={'.html':'text/html','.js':'application/javascript','.css':'text/css','.svg':'image/svg+xml','.ico':'image/x-icon','.png':'image/png'};
const server=createServer(async(req,res)=>{
 try {
  let p=decodeURIComponent(new URL(req.url,base).pathname);
  if(!extname(p))p=p.replace(/\/+$/,'')+'/index.html';
  const full=resolve(root,'.'+p);if(!full.startsWith(root+'/'))return res.writeHead(403).end();
  let bytes=await readFile(full),type=types[extname(p)]||'application/octet-stream';
  if(type==='text/html')bytes=Buffer.from(bytes.toString().replaceAll(`data-origin="${manifest.origin}"`,`data-origin="${base}"`));
  res.writeHead(200,{'Content-Type':type}).end(bytes);
 }catch{res.writeHead(404).end();}
});
await new Promise(r=>server.listen(4186,'127.0.0.1',r));
const browser=await chromium.launch({headless:true});const checks=[];
try {
 const svg=await readFile('dist/favicon.svg','utf8');assert.match(svg,/<title[^>]*>George<\/title>/);assert.ok(!/<(?:text|script|foreignObject|image)\b/i.test(svg));
 for(const [name,size] of [['favicon-32.png',32],['apple-touch-icon.png',180]]){
  const m=await sharp(await readFile('dist/'+name)).metadata();assert.equal(m.width,size);assert.equal(m.height,size);
 }
 const ico=await readFile('dist/favicon.ico');assert.equal(ico.readUInt16LE(2),1);assert.equal(ico.readUInt16LE(4),3);
 for(let i=0;i<3;i++)assert.equal(ico[6+16*i],[16,32,48][i]);
 let iconPages=0;
 async function scan(dir){for(const e of await readdir(dir,{withFileTypes:true})){
  const path=resolve(dir,e.name);if(e.isDirectory()){await scan(path);continue;}if(!e.name.endsWith('.html'))continue;
  const html=await readFile(path,'utf8');
  if(html.includes('<head>')){assert.match(html,/rel="icon"[^>]*href="\/favicon.svg\?v=george-g1"/);iconPages++;}
 }}
 await scan(root);assert.ok(iconPages>=70);
 for(const width of [320,390,768,1440]){
  const context=await browser.newContext({viewport:{width,height:900}}), methods=[];
  await context.route('**/*',route=>{
   const u=new URL(route.request().url());
   if(u.hostname==='fonts.googleapis.com')return route.fulfill({contentType:'text/css',body:fontCSS});
   if(fonts.has(u.href))return route.fulfill({contentType:'font/woff2',body:fonts.get(u.href)});
   if(u.origin!==base)return route.abort();
   if(u.pathname==='/api/views'){methods.push(route.request().method());return route.fulfill({json:counts});}
   return route.continue();
  });
  const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
  for(const path of ['/zh/','/en/','/zh/notes/','/zh/cv/']){
   assert.equal((await page.goto(base+path)).status(),200);
   await page.evaluate(()=>document.fonts.load('400 24px Pacifico'));
   assert.ok(await page.evaluate(()=>document.fonts.check('400 24px Pacifico')));
   for(const sel of ['.brand-word','.site-tagline']){
    const el=page.locator(sel);assert.equal(await el.innerText(),'The Emergence of Everything');
    const s=await el.evaluate(e=>({family:getComputedStyle(e).fontFamily,weight:getComputedStyle(e).fontWeight}));
    assert.match(s.family,/Pacifico/);assert.equal(s.weight,'400');
   }
   const brand=await page.locator('.brand-word').boundingBox(),lang=await page.locator('.language-switch').boundingBox();
   assert.ok(brand.x+brand.width<=lang.x+1);
   assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'No overflow '+width+' '+path);
   const cards=page.locator('[data-note-card]');
   if(await cards.count()){
    assert.equal(await cards.locator('.note-link').count(),0);
    for(const card of await cards.all()){
     assert.equal(await card.locator('a').count(),1,'Exactly one link, on the title');
     const title=card.locator('h2 a');assert.ok((await title.innerText()).length>0);
     const href=await title.getAttribute('href');await readFile(resolve(root,'.'+href,'index.html'));
    }
    const title=cards.first().locator('h2 a');await title.focus();
    assert.notEqual(await title.evaluate(e=>getComputedStyle(e).outlineStyle),'none');
    const target=await title.getAttribute('href');await title.press('Enter');
    await page.waitForURL(u=>u.pathname.replace(/\/+$/,'')===target.replace(/\/+$/,''));
    assert.equal(await page.locator('.note-page h1').count(),1,'Keyboard/title navigation opens article');
    await page.goto(base+path);await page.evaluate(()=>document.fonts.ready);
   }
   const f=page.locator('head link[rel="icon"][type="image/svg+xml"]');
   assert.equal(await f.getAttribute('href'),'/favicon.svg?v=george-g1');
   if(path==='/zh/')await page.screenshot({path:`${out}/home-${width}.png`});
   await page.locator('footer').scrollIntoViewIfNeeded();await page.locator('footer [data-view-count]').waitFor({state:'visible'});
   assert.equal(await page.locator('footer [data-view-count]').count(),1);
   if(path==='/zh/')await page.screenshot({path:`${out}/footer-${width}.png`});
   checks.push({path,width,scriptHeaderAndFooter:true,titleOnlyLinks:true,noOverflow:true,versionedTabIcon:true});
  }
  assert.ok(methods.every(m=>m==='GET'));assert.deepEqual(errors,[]);await context.close();
 }
 await writeFile(`${out}/checks.json`,JSON.stringify({productionWrites:0,fixtureCounts:true,iconPages,icoSizes:[16,32,48],pngSizes:[32,180],checks},null,2));
 console.log(JSON.stringify({passed:true,iconPages,responsiveWidths:[320,390,768,1440],productionWrites:0}));
}finally{await browser.close();await new Promise(r=>server.close(r));}
