// Isolated acceptance. Counters are fixtures and all non-local browser requests are blocked.
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve,extname} from 'node:path';
import {createRequire} from 'node:module';
import {chromium} from 'playwright';
const require=createRequire(import.meta.url), sharp=createRequire(require.resolve('astro/package.json'))('sharp');
const root=resolve('dist'), base='http://127.0.0.1:4188', out='artifacts/ge-favicon';
await mkdir(out,{recursive:true});
const manifest=JSON.parse(await readFile('src/lib/view-counter/manifest.json','utf8'));
const counts={totalViews:2416,articles:Object.fromEntries(Object.entries(manifest.pages).map(([p,r])=>[r||`page:${p}`,128])),since:'2026-09-21T00:00:00Z',timeZone:'Asia/Shanghai'};
const types={'.html':'text/html','.js':'application/javascript','.css':'text/css','.svg':'image/svg+xml','.ico':'image/x-icon','.png':'image/png'};
const server=createServer(async(req,res)=>{
 try {
  let p=decodeURIComponent(new URL(req.url,base).pathname);
  if(!extname(p))p=p.replace(/\/+$/,'')+'/index.html';
  const full=resolve(root,'.'+p);if(!full.startsWith(root+'/'))return res.writeHead(403).end();
  let data=await readFile(full);const type=types[extname(p)]||'application/octet-stream';
  if(type==='text/html') data=Buffer.from(data.toString().replaceAll(`data-origin="${manifest.origin}"`,`data-origin="${base}"`));
  res.writeHead(200,{'Content-Type':type}).end(data);
 }catch{res.writeHead(404).end();}
});
await new Promise(r=>server.listen(4188,'127.0.0.1',r));
const browser=await chromium.launch({headless:true}), checks=[];
async function alphaCheck(buffer,size) {
 const {data,info}=await sharp(buffer).ensureAlpha().raw().toBuffer({resolveWithObject:true});
 assert.equal(info.width,size);assert.equal(info.height,size);
 for(const [x,y]of [[0,0],[size-1,0],[0,size-1],[size-1,size-1]])assert.equal(data[(y*size+x)*4+3],0);
 let min=size,max=0,ink=0;
 for(let y=0;y<size;y++)for(let x=0;x<size;x++)if(data[(y*size+x)*4+3]>128){min=Math.min(min,x);max=Math.max(max,x);ink++;}
 assert.ok(ink>size*size*.08&&ink<size*size*.5);
 assert.ok(max-min>=size*.8,'No excessive horizontal padding');
 return {size,transparentCorners:true,inkPixels:ink,inkWidth:max-min+1};
}
try{
 const svg=await readFile('dist/favicon.svg','utf8');
 assert.ok(!/<(?:rect|text|script|image|foreignObject)\b/.test(svg));
 assert.match(svg,/connected Ge signature/);assert.match(svg,/prefers-color-scheme:dark/);
 const pixels=[];
 for(const [p,size]of [['favicon-32.png',32],['apple-touch-icon.png',180]])pixels.push(await alphaCheck(await readFile('dist/'+p),size));
 const ico=await readFile('dist/favicon.ico');assert.equal(ico.readUInt16LE(4),3);
 for(let i=0;i<3;i++){
  const at=6+16*i,size=ico[at],length=ico.readUInt32LE(at+8),offset=ico.readUInt32LE(at+12);
  assert.equal(size,[16,32,48][i]);pixels.push(await alphaCheck(ico.subarray(offset,offset+length),size));
 }
 const note='/zh/notes/github-copilot-agent-runtime-rust-ffi-harness-ai/';
 const en=Object.keys(manifest.pages).find(p=>p.startsWith('/en/notes/'))+'/';
 for(const width of [320,390,768,1440]){
  const context=await browser.newContext({viewport:{width,height:900},reducedMotion:'reduce'}),methods=[];
  await context.route('**/*',route=>{
   const u=new URL(route.request().url());
   if(u.origin!==base)return route.abort();
   if(u.pathname==='/api/views'){methods.push(route.request().method());return route.fulfill({json:counts});}
   return route.continue();
  });
  const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  for(const [path,label]of [[note,'article'],[en,'article-en'],['/zh/writing/agent-evaluation-playbook/','writing']]){
   assert.equal((await page.goto(base+path)).status(),200);
   const back=page.locator('main .back-link').first(),heading=page.locator('main article h1').first();
   await heading.waitFor({state:'visible'});
   const edge=await heading.evaluate(e=>e.getBoundingClientRect().left);
   const box=await back.boundingBox();assert.ok(box.width>=44&&box.height>=44,'Preserve 44px hit area');
   const inkLeft=await back.locator('svg').evaluate(svg=>{
    const b=svg.querySelector('path').getBBox();return new DOMPoint(b.x,b.y).matrixTransform(svg.getScreenCTM()).x;
   });
   assert.ok(Math.abs(inkLeft-edge)<=1,`${label} ${width}: arrow ${inkLeft} vs heading ${edge}`);
   assert.ok(box.x>=0,'Touch target stays in viewport');
   assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'No horizontal overflow');
   assert.match(await page.locator('head link[rel="icon"][type="image/svg+xml"]').getAttribute('href'),/george-ge2/);
   await back.focus();assert.notEqual(await back.evaluate(e=>getComputedStyle(e).outlineStyle),'none');
   if(label==='article')await page.screenshot({path:`${out}/article-back-${width}.png`});
   const href=await back.getAttribute('href');await back.press('Enter');
   await page.waitForURL(u=>u.pathname.replace(/\/+$/,'')===href.replace(/\/+$/,''));
   checks.push({width,path,arrowLeft:inkLeft,articleLeft:edge,hitWidth:box.width,hitHeight:box.height,keyboardNavigation:true});
  }
  assert.ok(methods.every(m=>m==='GET'),'No production/test tracking writes');assert.deepEqual(errors,[]);
  await context.close();
 }
 for(const scheme of ['light','dark']){
  const context=await browser.newContext({colorScheme:scheme,viewport:{width:320,height:320}}), page=await context.newPage();
  await page.goto(base+'/favicon.svg');
  const fill=await page.locator('.ink').evaluate(e=>getComputedStyle(e).fill);
  assert.equal(fill,scheme==='light'?'rgb(32, 43, 42)':'rgb(238, 245, 243)');
  await page.screenshot({path:`${out}/vector-${scheme}.png`,omitBackground:true});
  checks.push({scheme,fill,noBackground:true});await context.close();
 }
 await writeFile(`${out}/checks.json`,JSON.stringify({passed:true,productionWrites:0,fixtureCounts:true,pixels,checks},null,2));
 console.log('Transparent Ge assets, adaptive ink, optical back-arrow alignment and navigation verified.');
}finally{await browser.close();await new Promise(r=>server.close(r));}
