import fs from 'node:fs';
import assert from 'node:assert/strict';
import { validateArticleHtml } from './social/core.mjs';
const manifest = JSON.parse(fs.readFileSync('dist/_meta/notes.json', 'utf8'));
for (const note of manifest.notes) {
  const url = new URL(note.url);
  const file = `dist${url.pathname}/index.html`;
  assert.ok(fs.existsSync(file), `Missing built article: ${note.noteRef}`);
  const html = fs.readFileSync(file, 'utf8');
  validateArticleHtml(html, note.url, note);
  assert.equal(/<button\b[^>]*data-copy-link=/i.test(html), note.share, `Share toggle mismatch: ${note.noteRef}`);
  assert.equal(/<div\b[^>]*data-giscus-root/i.test(html), note.comments, `Comment toggle mismatch: ${note.noteRef}`);
  assert.ok(!/<script\b[^>]*src=["'][^"']*goatcounter/i.test(html), 'Unexpected analytics provider.');
}
console.log(`Static publication identity and feature switches verified for ${manifest.notes.length} notes.`);
