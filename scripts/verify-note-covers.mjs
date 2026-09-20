// The same checks validate generated files and the public responses after deployment.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import { pageAttributes } from './social/core.mjs';

export function assertPng(bytes) {
  assert.ok(bytes.length > 33 && bytes.length < 2_000_000, 'Cover must be a PNG under 2 MB.');
  assert.equal(bytes.subarray(0,8).toString('hex'), '89504e470d0a1a0a', 'Not PNG bytes.');
  assert.equal(bytes.subarray(12,16).toString('ascii'), 'IHDR');
  assert.equal(bytes.readUInt32BE(16),1200); assert.equal(bytes.readUInt32BE(20),630);
}
export function assertCoverMetadata(html, expected) {
  const tags = [...html.matchAll(/<meta\b[^>]*>/gi)].map(([tag]) => pageAttributes(tag));
  const one = (name) => { const values=tags.filter((t) => t.property===name || t.name===name); assert.equal(values.length,1,`Expected one ${name}`); return values[0].content; };
  assert.equal(one('og:image'),expected); assert.equal(one('twitter:image'),expected);
  assert.equal(one('twitter:card'),'summary_large_image');
  assert.equal(one('og:image:width'),'1200'); assert.equal(one('og:image:height'),'630');
  assert.equal(one('og:image:type'),'image/png');
  assert.ok(one('og:image:alt')?.trim()); assert.ok(one('twitter:image:alt')?.trim());
}
export async function main(live=process.argv.includes('--live')) {
  const manifest=JSON.parse(fs.readFileSync('artifacts/notes-publication/notes.json','utf8'));
  const images=new Set();
  for (const note of manifest.notes) {
    const page=new URL(note.url), image=new URL(note.imageUrl);
    assert.equal(image.origin,page.origin,'Cover must use the public origin.');
    assert.match(image.pathname,/^\/_generated\/og\/[\w-]+\/[a-f0-9]{24}\.png$/);
    let html;
    if (live) {
      page.searchParams.set('__dk_cover',image.pathname.split('/').at(-1));
      const res=await fetch(page,{signal:AbortSignal.timeout(15000),headers:{'Cache-Control':'no-cache'}});
      assert.equal(res.status,200); assert.equal(new URL(res.url).pathname.replace(/\/$/,''),page.pathname.replace(/\/$/,''));
      html=await res.text();
    } else html=fs.readFileSync(path.join('dist',page.pathname,'index.html'),'utf8');
    assertCoverMetadata(html,note.imageUrl); images.add(note.imageUrl);
  }
  for (const image of images) {
    let bytes;
    if (live) {
      const res=await fetch(image,{redirect:'error',signal:AbortSignal.timeout(15000)});
      assert.equal(res.status,200); assert.match(res.headers.get('content-type')||'',/^image\/png/);
      bytes=Buffer.from(await res.arrayBuffer());
    } else bytes=fs.readFileSync(path.join('dist',new URL(image).pathname));
    assertPng(bytes);
  }
  console.log(`${live?'Production':'Build'}: ${manifest.notes.length} article cards and ${images.size} distinct PNG covers verified.`);
}
if (process.argv[1] && import.meta.url===pathToFileURL(process.argv[1]).href) main().catch((error)=>{console.error(error);process.exitCode=1;});
