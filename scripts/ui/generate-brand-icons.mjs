// Rebuild committed favicon fallbacks from the only source of truth: favicon.svg.
import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import sharp from 'sharp';
const source=await readFile('public/favicon.svg');
assert.ok(!/<(?:script|text|image|foreignObject)\b|url\(https?:/i.test(source.toString()), 'Tab icon must not depend on fonts or external resources');
const sizes=[16,32,48];
const images=await Promise.all(sizes.map(n=>sharp(source,{density:384}).resize(n,n).png().toBuffer()));
const directory=Buffer.alloc(6+16*sizes.length);
directory.writeUInt16LE(1,2);directory.writeUInt16LE(sizes.length,4);
let offset=directory.length;
for(let i=0;i<sizes.length;i++) {
  const at=6+16*i;directory[at]=sizes[i];directory[at+1]=sizes[i];
  directory.writeUInt16LE(1,at+4);directory.writeUInt16LE(32,at+6);
  directory.writeUInt32LE(images[i].length,at+8);directory.writeUInt32LE(offset,at+12);
  offset+=images[i].length;
}
await writeFile('public/favicon.ico',Buffer.concat([directory,...images]));
await writeFile('public/favicon-32.png',images[1]);
await sharp(source,{density:384}).resize(180,180).png().toFile('public/apple-touch-icon.png');
console.log('Generated favicon ICO 16/32/48, PNG 32 and Apple icon 180 from the self-contained SVG.');
