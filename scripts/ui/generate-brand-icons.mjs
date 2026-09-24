// Rebuild transparent fallbacks from the self-contained vector source.
import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const sharp = createRequire(require.resolve('astro/package.json'))('sharp');
const source = await readFile('public/favicon.svg');
assert.ok(!/<(?:script|text|image|foreignObject|rect)\b|url\(https?:/i.test(source.toString()), 'Tab icon must have no background plate, fonts or external resources');
const sizes = [16, 32, 48];
async function render(size) {
  const image = await sharp(source, {density: 384}).resize(size, size).png().toBuffer();
  const {data, info} = await sharp(image).ensureAlpha().raw().toBuffer({resolveWithObject:true});
  const alpha = (x,y) => data[(y*info.width+x)*4+3];
  for (const [x,y] of [[0,0],[size-1,0],[0,size-1],[size-1,size-1]]) assert.equal(alpha(x,y),0,'Corner must stay fully transparent');
  let visible=0; for(let i=3;i<data.length;i+=4) if(data[i]>128) visible++;
  assert.ok(visible>size*size*.08 && visible<size*size*.5,'Signature ink must remain visible without a filled background');
  return image;
}
const images = await Promise.all(sizes.map(render));
const directory = Buffer.alloc(6+16*sizes.length);
directory.writeUInt16LE(1,2); directory.writeUInt16LE(sizes.length,4);
let offset = directory.length;
for(let i=0;i<sizes.length;i++) {
  const at=6+16*i; directory[at]=sizes[i]; directory[at+1]=sizes[i];
  directory.writeUInt16LE(1,at+4); directory.writeUInt16LE(32,at+6);
  directory.writeUInt32LE(images[i].length,at+8); directory.writeUInt32LE(offset,at+12);
  offset+=images[i].length;
}
await writeFile('public/favicon.ico',Buffer.concat([directory,...images]));
await writeFile('public/favicon-32.png',images[1]);
await writeFile('public/apple-touch-icon.png',await render(180));
console.log('Generated alpha-preserving Ge icons: ICO 16/32/48, PNG 32, touch icon 180.');
