import fs from 'node:fs';
import path from 'node:path';
import { locales } from '../../lib/config';
import { listProfileAssets, readContentCollection } from '../../lib/profile-loader';
import { validateSvg } from '../../lib/note-assets.mjs';
const contentTypes:Record<string,string> = {'.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.webp':'image/webp','.svg':'image/svg+xml','.pdf':'application/pdf'};
export function getStaticPaths() {
  const notes = new Set(locales.flatMap((locale) => readContentCollection(locale,'notes').map((entry) => `${locale}/${entry.slug}`)));
  return listProfileAssets().filter((asset) => {
    if (!asset.relativePath.startsWith('notes/')) return true;
    const match = /^notes\/((zh|en)\/[a-z0-9-]+)\/([a-z][a-z0-9-]{0,47}\.svg)$/.exec(asset.relativePath);
    if (!match || !notes.has(match[1])) return false; // Never publish orphan artwork after a Git-only note deletion.
    if (!fs.lstatSync(asset.fullPath).isFile()) throw new Error('Note artwork cannot be a symlink.');
    validateSvg(fs.readFileSync(asset.fullPath,'utf8'),match[3]);
    return true;
  }).map((asset) => ({params:{asset:`${asset.profileId}/${asset.relativePath}`},props:{fullPath:asset.fullPath}}));
}
export function GET({props}:{props:{fullPath:string}}) {
  const ext = path.extname(props.fullPath).toLowerCase();
  return new Response(fs.readFileSync(props.fullPath),{headers:{'content-type':contentTypes[ext] || 'application/octet-stream','X-Content-Type-Options':'nosniff'}});
}
