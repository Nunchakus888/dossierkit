import test from 'node:test';
import assert from 'node:assert/strict';
import { inspectViewMarkup } from './html-inspect.mjs';
test('inline selectors, CSS, comments and escaped article text do not enable counters', () => {
  const html = `<script>document.querySelector('[data-view-counter-config]'); const x='<span data-view-count="site:total">';</script><style>[data-view-count="site:total"]{display:none}</style><!-- <span data-view-counter-config> --><p>&lt;span data-view-counter-config&gt;</p>`;
  assert.deepEqual(inspectViewMarkup(html), { configured: false, refs: [] });
});
test('actual config and counter spans are detected independently of quoting and scope attributes', () => {
  const html = `<span hidden data-view-counter-config data-origin="https://sunionpeaks.pages.dev"></span><span class="view-count" data-view-count="site:total" hidden></span><span data-astro-cid-abc data-view-count='zh/first' hidden></span>`;
  assert.deepEqual(inspectViewMarkup(html), { configured: true, refs: ['site:total', 'zh/first'] });
});
