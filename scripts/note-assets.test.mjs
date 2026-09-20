import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateSvg, applyAssetPatch, resolveAssetImages, portableAssetImages, effectiveNoteHash, assetDirectory } from '../src/lib/note-assets.mjs';
export const cover = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 630"><title>Runtime overview</title><rect width="1200" height="630" fill="#fff"/><text x="80" y="100" font-size="48">Harness</text></svg>';
test('small static SVG cover and gradients are accepted', () => {
  assert.equal(validateSvg(cover, 'cover.svg').width, 1200);
  assert.equal(validateSvg(cover.replace('<rect', '<defs><linearGradient id="g"><stop offset="0%" stop-color="#fff"/><stop offset="100%" stop-color="#ddd"/></linearGradient></defs><rect').replace('fill="#fff"', 'fill="url(#g)"'), 'cover.svg').height, 630);
});
test('reject executable, external, recursive and malformed XML', () => {
  for (const bad of [
    '<script>alert(1)</script>', '<foreignObject/>', '<image href="https://evil.test/a"/>', '<use href="#x"/>',
    '<rect onclick="x()"/>', '<rect style="fill:red"/>', '<rect fill="url(https://evil.test/a)"/>',
    '<rect fill="url(#missing)"/>', '<g><rect></g>', '<rect width="NaN"/>', '<rect xmlns:x="https://evil.test"/>',
    '<text>&unknown;</text>', '<text>&#0;</text>', '<rect id="dup"/><path id="dup" d="M0 0"/>',
    '<defs><marker id="m"><path d="M0 0" marker-end="url(#m)"/></marker></defs>'
  ]) assert.throws(() => validateSvg(cover.replace('</svg>', bad + '</svg>')));
  assert.throws(() => validateSvg('<!DOCTYPE svg>' + cover));
  assert.throws(() => validateSvg(cover.replace('1200 630', '100 100'), 'cover.svg'));
  assert.throws(() => validateSvg(cover.replace('<title>Runtime overview</title>', '')));
  assert.throws(() => validateSvg(cover.replace('<rect', '<rect width="1"')));
});
test('preserve omitted assets, update same name, delete only explicitly, reject traversal', () => {
  const a = applyAssetPatch({}, { 'cover.svg': cover });
  assert.deepEqual(applyAssetPatch(a), a);
  assert.deepEqual(Object.keys(applyAssetPatch(a, {'cover.svg':null})), []);
  assert.throws(() => applyAssetPatch(a, {'../cover.svg':cover}));
  assert.throws(() => assetDirectory('../default', 'zh/a'));
  assert.throws(() => applyAssetPatch({}, { 'cover.svg': cover.repeat(1000) }));
});
test('only image URLs resolve, code and prose remain unchanged', () => {
  const prefix = '/profile-assets/default/notes/en/runtime/';
  const md = '![Architecture](asset:cover.svg)\n`![literal](asset:cover.svg)`\n```md\n![literal](asset:missing.svg)\n```\nA link [doc](https://example.com)';
  const result = resolveAssetImages(md, 'markdown', prefix, {'cover.svg':cover});
  assert.ok(result.startsWith(`![Architecture](${prefix}cover.svg)`));
  assert.match(result, /!\[literal\]\(asset:missing.svg\)/);
  assert.equal(portableAssetImages(result, 'markdown', prefix), md);
  assert.throws(() => resolveAssetImages('![A](asset:missing.svg)', 'markdown', prefix, {}));
  assert.throws(() => resolveAssetImages('![A](asset:../x.svg)', 'markdown', prefix, {}));
  assert.match(resolveAssetImages('<img alt="A" src="asset:cover.svg">', 'html', prefix, {'cover.svg':cover}), /src="\/profile-assets/);
});
test('asset-only changes affect effective hash, legacy no-assets hash is unchanged', async () => {
  const base = 'sha256:' + '0'.repeat(64);
  assert.equal(await effectiveNoteHash(base, {}), base);
  assert.notEqual(await effectiveNoteHash(base, {'cover.svg':cover}), await effectiveNoteHash(base, {'cover.svg':cover.replace('Harness','Tools')}));
});

test('unsupported reference images fail explicitly rather than create broken assets',()=>{
  assert.throws(()=>resolveAssetImages('![diagram][ref]\n\n[ref]: asset:cover.svg','markdown','/images/',{'cover.svg':cover}),/direct image/);
});
