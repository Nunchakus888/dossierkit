import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { locales } from '../src/lib/config';
import { readContentCollection } from '../src/lib/profile-loader';
import assert from 'node:assert/strict';
import { validateSvg } from '../src/lib/note-assets.mjs';
import { FONT_BLOB, FONT_URL, noteCover, astroRequire } from '../src/lib/note-media';
const cache = path.resolve('.cache/note-cover-font');
fs.mkdirSync(cache,{recursive:true});
const font = path.join(cache,'NotoSansCJKsc-Regular.otf');
function verified(bytes: Buffer) { return createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex') === FONT_BLOB; }
if (!fs.existsSync(font) || !verified(fs.readFileSync(font))) {
  const response = await fetch(FONT_URL,{signal:AbortSignal.timeout(60000),redirect:'error'});
  if (!response.ok) throw new Error(`Cover font download failed: HTTP ${response.status}`);
  const bytes = Buffer.from(await response.arrayBuffer());
  if (bytes.length > 20_000_000 || !verified(bytes)) throw new Error('Cover font integrity check failed.');
  fs.writeFileSync(font,bytes);
}
// A single fixed CJK font is cached locally, never included in dist or the plugin archive.
const config = path.join(cache,'fonts.conf');
const xmlPath = cache.replaceAll('&','&amp;').replaceAll('<','&lt;');
fs.writeFileSync(config,`<fontconfig><dir>${xmlPath}</dir><cachedir>${xmlPath}/cache</cachedir><alias><family>sans-serif</family><prefer><family>Noto Sans CJK SC</family></prefer></alias><alias><family>system-ui</family><prefer><family>Noto Sans CJK SC</family></prefer></alias></fontconfig>`);
process.env.FONTCONFIG_FILE = config;
const match = spawnSync('fc-match',['-f','%{file}','Noto Sans CJK SC'],{encoding:'utf8',env:process.env});
if (match.status !== 0 || !match.stdout.includes('NotoSansCJKsc-Regular.otf')) throw new Error('Fontconfig could not load the pinned cover font. Install fontconfig for local builds.');
const sharp = astroRequire('sharp');
sharp.cache(false);
sharp.concurrency(1);
const covers = [noteCover(), ...locales.flatMap((locale) => readContentCollection(locale,'notes').map((entry) => noteCover(`${locale}/${entry.slug}`)))];
const output = path.resolve('public/_generated/og');
fs.rmSync(output,{recursive:true,force:true});
for (const cover of new Map(covers.map((cover) => [cover.path,cover])).values()) {
  const destination = path.resolve('public' + cover.path);
  fs.mkdirSync(path.dirname(destination),{recursive:true});
  await sharp(Buffer.from(cover.source),{density:72,limitInputPixels:6_000_000})
    .resize(1200,630,{fit:'contain',background:'#ffffff'}).png().timeout({seconds:10}).toFile(destination);
  const metadata = await sharp(destination).metadata();
  if (metadata.width !== 1200 || metadata.height !== 630 || metadata.format !== 'png') throw new Error('Invalid rendered cover.');
}
console.log(`Cover PNGs ready for ${covers.length - 1} notes; inline SVGs remain unchanged. No AI calls.`);

// Exercise the custom artwork path without adding a test article to production.
const fixture=validateSvg('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 630"><title>中文封面校验</title><rect width="1200" height="630" fill="#ffffff"/><text x="80" y="180" font-family="Noto Sans CJK SC" font-size="60" fill="#111111">架构与执行 Runtime</text></svg>','cover.svg');
const renderFixture=()=>sharp(Buffer.from(fixture.source),{density:72}).resize(1200,630).png().timeout({seconds:10}).toBuffer();
const first=await renderFixture();
assert.ok(first.equals(await renderFixture()),'Identical artwork should rasterize identically.');
assert.equal((await sharp(first).metadata()).width,1200);
const stats=await sharp(first).stats();
assert.ok(stats.channels.some((c:any)=>c.stdev>1),'Custom artwork must not be blank.');
console.log('Custom CJK cover rendering and deterministic rasterization check passed.');
