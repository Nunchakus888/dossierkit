// Build-time asset resolver. No per-article manifest and no second content copy.
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { activeProfile, profileRoot } from './config';
import { loadProfilePack } from './profile-loader';
import { localize } from './i18n';
import { ASSET_NAME, ASSET_LIMIT, validateSvg, applyAssetPatch } from './note-assets.mjs';
export const FONT_BLOB = 'dc15562470b4f842321894787a0d066879ccff8b';
export const FONT_URL = 'https://raw.githubusercontent.com/notofonts/noto-cjk/f8d157532fbfaeda587e826d4cd5b21a49186f7c/Sans/OTF/SimplifiedChinese/NotoSansCJKsc-Regular.otf';
const require = createRequire(import.meta.url);
// Reuse the renderer already locked and installed by Astro; fail visibly if Astro changes it.
export const astroRequire = createRequire(require.resolve('astro/package.json'));
const rendererVersion = astroRequire('sharp/package.json').version;
const recipe = `dossierkit-cover-v1:sharp-${rendererVersion}:font-${FONT_BLOB}:1200x630`;
export function loadNoteAssets(noteRef: string, profile = activeProfile): Record<string,string> {
  if (!/^(zh|en)\/[a-z0-9]+(?:-[a-z0-9]+)*$/.test(noteRef)) throw new Error('Invalid note media identity.');
  const root = path.join(profileRoot(profile), 'assets', 'notes', noteRef);
  if (!fs.existsSync(root)) return {};
  if (!fs.realpathSync(root).startsWith(fs.realpathSync(profileRoot(profile)) + path.sep) || fs.lstatSync(root).isSymbolicLink()) throw new Error('Note asset directories cannot be symlinks.');
  const entries = fs.readdirSync(root);
  if (entries.length > ASSET_LIMIT) throw new Error('Too many note assets.');
  const assets: Record<string,string> = {};
  for (const name of entries) {
    if (!ASSET_NAME.test(name) || !fs.lstatSync(path.join(root,name)).isFile()) throw new Error(`Unsupported note asset: ${name}`);
    const source = fs.readFileSync(path.join(root,name),'utf8');
    validateSvg(source,name);
    assets[name] = source;
  }
  applyAssetPatch(assets);
  return assets;
}
function escape(value: string) { return value.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;'); }
export function fallbackCover() {
  const pack = loadProfilePack();
  const brand = pack.navigation.brand.mark || localize(pack.profile.name,'en');
  const name = localize(pack.profile.name,'en');
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 630"><title>${escape(brand)}</title><rect width="1200" height="630" fill="#f5f5fa"/><defs><linearGradient id="accent"><stop offset="0%" stop-color="#fa5560"/><stop offset="50%" stop-color="#b14bf4"/><stop offset="100%" stop-color="#4d91ff"/></linearGradient></defs><rect x="70" y="70" width="1060" height="490" rx="28" fill="#fff"/><rect x="110" y="120" width="190" height="8" rx="4" fill="url(#accent)"/><text x="110" y="245" font-family="Noto Sans CJK SC" font-size="42" fill="#171a2f">${escape(brand.slice(0,42))}</text><text x="110" y="338" font-family="Noto Sans CJK SC" font-size="34" fill="#53566e">工作与学习笔记 · Research and Engineering</text><text x="110" y="475" font-family="Noto Sans CJK SC" font-size="26" fill="#73778d">${escape(name.slice(0,50))}</text></svg>`;
}
export function noteCover(noteRef?: string) {
  const assets = noteRef ? loadNoteAssets(noteRef) : {};
  const source = assets['cover.svg'] || fallbackCover();
  const image = validateSvg(source,'cover.svg');
  const hash = createHash('sha256').update(recipe).update(image.source).digest('hex').slice(0,24);
  return {...image,path:`/_generated/og/${activeProfile}/${hash}.png`,custom:Boolean(assets['cover.svg'])};
}
