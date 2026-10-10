import { readdir, readFile, writeFile } from 'node:fs/promises';
import { join, relative, sep } from 'node:path';
import { normalizePath } from '../../src/lib/view-counter/server.mjs';
const root = process.cwd();
const settings = JSON.parse(await readFile(join(root, 'src/lib/view-counter/settings.json'), 'utf8'));
const pages = {};
async function walk(dir) {
  for (const item of await readdir(dir, { withFileTypes: true })) {
    const file = join(dir, item.name);
    if (item.isDirectory()) await walk(file);
    else if (item.name.endsWith('.html')) {
      const path = normalizePath('/' + relative(join(root, 'dist'), file).split(sep).join('/'));
      // Only actual public locale pages. Excludes root redirects, errors, APIs and admin.
      if (!/^\/(zh|en)(\/|$)/.test(path)) continue;
      const html = await readFile(file, 'utf8');
      if (!html.includes('data-pagefind-body') || /http-equiv=["']refresh/i.test(html)) continue;
      const match = html.match(/name="dossierkit:note-ref"\s+content="([^"]+)"/);
      pages[path] = match?.[1] || null;
    }
  }
}
await walk(join(root, 'dist'));

// Server-only allowlist for shared-by-link CV pages. They remain excluded from
// Pagefind, sitemap, the public page-ref meta and aggregate top-page rankings.
for (const locale of ['zh', 'en']) {
  let html;
  try {
    html = await readFile(join(root, 'dist', locale, 'cv-agent', 'index.html'), 'utf8');
  } catch (error) {
    if (error?.code === 'ENOENT') continue;
    throw error;
  }
  if (!html.includes('data-pagefind-ignore="all"') || html.includes('data-pagefind-body')
    || !/<meta[^>]+name="robots"[^>]+content="[^"]*noindex/i.test(html)
    || !html.includes('data-cv-signature')) {
    throw new Error(`Refusing to register non-unlisted Agent CV: ${locale}`);
  }
  pages[`/${locale}/cv-agent`] = null;
}
if (!Object.hasOwn(pages, '/zh') || !Object.values(pages).some(Boolean)) throw new Error('Public view manifest is empty');
await writeFile(join(root, 'src/lib/view-counter/manifest.json'), JSON.stringify({ origin: settings.origin, timeZone: settings.timeZone, pages }, null, 2)+'\n');
console.log(`View allowlist: ${Object.keys(pages).length} countable routes (including unlisted CV when configured); ${Object.values(pages).filter(Boolean).length} articles.`);
