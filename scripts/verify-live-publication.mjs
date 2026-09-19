import fs from 'node:fs';
import { pathToFileURL } from 'node:url';
import { setTimeout as delay } from 'node:timers/promises';
import { verifyArticle, pageAttributes } from './social/core.mjs';

export function countCloudflareBeacons(html) {
  return [...html.matchAll(/<script\b[^>]*>/gi)].filter(([tag]) => {
    const src = pageAttributes(tag).src;
    if (!src) return false;
    try {
      const url = new URL(src, 'https://invalid.example');
      return url.hostname === 'static.cloudflareinsights.com' && url.pathname.startsWith('/beacon');
    } catch { return false; }
  }).length;
}

export async function main() {
  const manifest = JSON.parse(fs.readFileSync('artifacts/notes-publication/notes.json', 'utf8'));
  if (!manifest.productionOrigin || manifest.repository !== process.env.GITHUB_REPOSITORY) {
    console.log('Live verification skipped: not the configured production instance.');
    return;
  }
  const failures = [];
  for (let offset = 0; offset < manifest.notes.length; offset += 6) {
    await Promise.all(manifest.notes.slice(offset, offset + 6).map(async (note) => {
      let error;
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          await verifyArticle(note);
          console.log(`Live article verified: ${note.noteRef}`);
          return;
        } catch (cause) {
          error = cause;
          if (attempt < 2) await delay(2000 * (attempt + 1));
        }
      }
      failures.push(`${note.noteRef}: ${error?.message}`);
    }));
  }
  if (failures.length) throw new Error(`Live publication failed:\n${failures.join('\n')}`);
  console.log(`Verified ${manifest.notes.length} production article URLs, canonical identities and fingerprints.`);

  // Account-controlled Pages injection is observed, not silently configured or assumed.
  const first = manifest.notes[0];
  if (first) {
    try {
      const response = await fetch(first.url, { signal: AbortSignal.timeout(15000) });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const count = countCloudflareBeacons(await response.text());
      console.log(`Cloudflare Web Analytics beacon scripts in production response: ${count}`);
      if (count === 0) console.warn('No Web Analytics beacon observed. Confirm Pages Web Analytics account settings; this is not proof of data collection.');
      if (count > 1) console.warn('Multiple Web Analytics beacons observed. Check for duplicate automatic/manual injection.');
    } catch (error) {
      console.warn(`Analytics injection could not be inspected: ${error.message}`);
    }
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main().catch((error) => {
  console.error(error.message); process.exitCode = 1;
});
