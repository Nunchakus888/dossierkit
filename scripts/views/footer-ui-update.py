from pathlib import Path
root=Path.cwd()
def edit(path, old, new):
 p=root/path;s=p.read_text();assert s.count(old)==1,(path,s.count(old));p.write_text(s.replace(old,new))
def put(path,text):
 p=root/path;p.parent.mkdir(parents=True,exist_ok=True);p.write_text(text)
put('src/components/views/ViewCount.astro', '''---
import { viewsEnabled } from '../../lib/view-counter/config';
type Props = { noteRef?: string; locale?: string; showTotal?: boolean };
const { noteRef, showTotal = false } = Astro.props;
const paired = Boolean(noteRef && showTotal);
---
{viewsEnabled && <span class="view-count no-print" data-view-count={noteRef || 'site:total'} data-view-total={paired ? 'true' : undefined} data-pagefind-ignore hidden>
  <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/></svg>
  <span data-view-number></span>
  {paired && <><span class="view-separator" aria-hidden="true">/</span><span data-view-total-number></span></>}
</span>}
<style>
  .view-count { display: inline-flex; align-items: center; gap: .3rem; color: var(--color-muted); font-size: .75rem; font-weight: 400; line-height: 1.5; white-space: nowrap; font-variant-numeric: tabular-nums; }
  .view-count[hidden] { display: none !important; }
  svg { flex-shrink: 0; opacity: .7; }
  .view-separator { opacity: .55; margin-inline: .1rem; }
  @media (forced-colors: active) { svg, .view-separator { opacity: 1; } }
</style>
''')
edit('src/components/layout/Footer.astro','  pack: ProfilePack;','  pack: ProfilePack;\n  pageRef?: string;')
edit('src/components/layout/Footer.astro','const { locale, pack } = Astro.props;','const { locale, pack, pageRef } = Astro.props;')
edit('src/components/layout/Footer.astro','''        <ViewCount locale={locale} />
        {viewsEnabled && <a class="counter-privacy" href={`/${locale}/privacy/`}>{locale === "zh" ? "统计与隐私" : "Statistics & privacy"}</a>}''','''        {viewsEnabled && <div class="footer-meta" data-pagefind-ignore>
          <ViewCount noteRef={pageRef} showTotal={Boolean(pageRef)} locale={locale} />
          <a class="counter-privacy" href={`/${locale}/privacy/`}>{locale === "zh" ? "统计与隐私" : "Statistics & privacy"}</a>
        </div>}''')
edit('src/components/layout/Footer.astro','  .counter-privacy {','  .footer-meta { display: flex; align-items: center; justify-content: center; flex-wrap: wrap; gap: .4rem .9rem; }\n\n  .counter-privacy {')
edit('src/layouts/BaseLayout.astro','import ViewCount from "../components/views/ViewCount.astro";\n','')
edit('src/layouts/BaseLayout.astro','  pageCounterInline?: boolean;\n','')
edit('src/layouts/BaseLayout.astro',', pageCounterInline = false','')
edit('src/layouts/BaseLayout.astro','const pageRef = noteRef || `page:${path}`;','''const pageRef = noteRef || `page:${path}`;
// Locale homes show only the site total; every child page shows page / site.
const footerPageRef = publicPage && !/^\\/(zh|en)$/.test(path) ? pageRef : undefined;''')
edit('src/layouts/BaseLayout.astro','      {publicPage && !note && !pageCounterInline && <div class="page-shell page-view-meta no-print" data-pagefind-ignore><ViewCount noteRef={pageRef} locale={locale} /></div>}\n','')
edit('src/layouts/BaseLayout.astro','<Footer locale={locale} pack={pack} />','<Footer locale={locale} pack={pack} pageRef={footerPageRef} />')
edit('src/layouts/BaseLayout.astro','''
<style>
  .page-view-meta { display: flex; justify-content: flex-end; padding-top: .6rem; min-height: 1.5rem; }
</style>
''','\n')
edit('src/layouts/CVLayout.astro','import ViewCount from "../components/views/ViewCount.astro";\n','')
edit('src/layouts/CVLayout.astro','<BaseLayout pageCounterInline ','<BaseLayout ')
edit('src/layouts/CVLayout.astro','        <ViewCount noteRef={`page:/${locale}/cv`} locale={locale} />\n','')
edit('src/pages/[locale]/notes/[slug].astro','import ViewCount from "../../../components/views/ViewCount.astro";\n','')
edit('src/pages/[locale]/notes/[slug].astro','        <ViewCount noteRef={`${locale}/${entry.slug}`} locale={locale} />\n','')
edit('src/lib/view-counter/client.mjs','''      output.textContent = format.format(count);
''','''      const paired = widget.dataset.viewTotal === 'true';
      const totalOutput = paired ? widget.querySelector('[data-view-total-number]') : null;
      // Reveal both values together from the same response, never a partial ratio.
      if (paired && (!totalOutput || !Number.isSafeInteger(data.totalViews) || data.totalViews < 0)) continue;
      output.textContent = format.format(count);
      if (totalOutput) totalOutput.textContent = format.format(data.totalViews);
''')
edit('src/lib/view-counter/client.mjs',"      const label = zh ? `累计浏览 ${format.format(count)} 次${date ? `，自 ${date} 起统计` : ''}`\n        : `${format.format(count)} page views${date ? `, counted since ${date}` : ''}`;", """      const label = paired
        ? (zh ? `本页浏览 ${format.format(count)} 次 / 全站浏览 ${format.format(data.totalViews)} 次${date ? `，本页自 ${date} 起统计` : ''}`
          : `This page: ${format.format(count)} views / Site: ${format.format(data.totalViews)} views${date ? `; page counted since ${date}` : ''}`)
        : (zh ? `累计浏览 ${format.format(count)} 次${date ? `，自 ${date} 起统计` : ''}`
          : `${format.format(count)} page views${date ? `, counted since ${date}` : ''}`);""")
edit('scripts/views/counter.test.mjs','    querySelector() { return this.number; }, setAttribute() {} });', "    querySelector(selector) { return selector === '[data-view-number]' ? this.number : null; }, setAttribute() {} });")
with (root/'scripts/views/counter.test.mjs').open('a') as f:
 f.write('''
// Footer combines two existing values without a second report or a new counter.
test('footer pair shares one report, has one accessible meaning, and leaves cards unchanged', async () => {
  const b = browser();
  const pair = b.widgets[1];
  pair.dataset.viewTotal = 'true';
  pair.totalNumber = { textContent: '' };
  pair.querySelector = function(selector) { return selector === '[data-view-number]' ? this.number : selector === '[data-view-total-number]' ? this.totalNumber : null; };
  pair.setAttribute = function(name, value) { this[name] = value; };
  startViewCounter(b.win, b.doc); await settle();
  assert.equal(b.calls.length, 1);
  assert.equal(pair.number.textContent, '4'); assert.equal(pair.totalNumber.textContent, '7');
  assert.equal(pair.hidden, false); assert.match(pair['aria-label'], /本页浏览 4 次 \\/ 全站浏览 7 次/);
  assert.equal(b.widgets[0].number.textContent, '7');
});
test('footer never shows a partial pair, but genuine zero counts render', async () => {
  for (const totalViews of [undefined, -1, '7', 0]) {
    const b = browser(); const pair = b.widgets[1]; pair.dataset.viewTotal = 'true';
    pair.totalNumber = { textContent: '' };
    pair.querySelector = function(selector) { return selector === '[data-view-number]' ? this.number : selector === '[data-view-total-number]' ? this.totalNumber : null; };
    b.win.fetch = async () => Response.json({ totalViews, articles: { 'zh/first': 0 } });
    startViewCounter(b.win, b.doc); await settle();
    assert.equal(pair.hidden, totalViews !== 0);
    if (totalViews === 0) { assert.equal(pair.number.textContent, '0'); assert.equal(pair.totalNumber.textContent, '0'); }
  }
});
''')
edit('scripts/views/verify-live.mjs', "let lastError;", '''function verifyFooter(html, ref, paired) {
  const footer = html.match(/<footer\\b[^>]*>[\\s\\S]*?<\\/footer>/i)?.[0] || '';
  assert.deepEqual(inspectViewMarkup(footer).refs, [ref]);
  assert.equal(/data-view-total="true"/.test(footer), paired);
  assert.ok(!/本站累计浏览|Site views/.test(footer));
  if (paired && !ref.startsWith('page:/zh/notes') && !ref.startsWith('page:/en/notes')) {
    const main = html.match(/<main\\b[^>]*>[\\s\\S]*?<\\/main>/i)?.[0] || '';
    assert.equal(inspectViewMarkup(main).refs.length, 0, 'Page counter must not duplicate above the footer');
  }
}
let lastError;''')
edit('scripts/views/verify-live.mjs','''      for (const path of ['/zh/cv/', '/en/cv/', '/zh/contact/']) {''','''      verifyFooter(homeHtml, 'site:total', false);
      verifyFooter(articleHtml, manifest.pages[articlePath], true);
      for (const path of ['/zh/cv/', '/en/cv/', '/zh/contact/']) {''')
edit('scripts/views/verify-live.mjs', '        const markup = inspectViewMarkup(await page.text());','''        const pageHtml = await page.text();
        const markup = inspectViewMarkup(pageHtml);
        verifyFooter(pageHtml, 'page:' + path.replace(/\\/+$/, ''), true);''')
edit('scripts/views/verify-live.mjs','      schemaVersion: 2, standalonePagesVerified:', "      footerDisplay: active ? 'home-total-and-subpage-pair' : 'disabled',\n      schemaVersion: 2, standalonePagesVerified:")
edit('docs/view-counter.md','文章与列表卡片显示眼睛图标和累计浏览次数；页脚显示全站累计次数。', '首页页脚仅显示眼睛图标和全站累计数字；文章、简历等子页面在页脚显示一个眼睛图标及「本页 / 全站」数字，不再在标题、正文顶部重复放置统计。列表卡片保留眼睛和对应文章累计数字。可见组件不显示「本站累计浏览」「次」等说明；口径及起始日期保留在悬停提示和无障碍标签中。图标与分隔符使用弱化的中性色，数字为小字号常规字重。')
