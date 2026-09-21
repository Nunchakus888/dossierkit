/** One report per visible document. Card/footnote widgets share its result. */
export function startViewCounter(win = window, doc = document) {
  const config = doc.querySelector('[data-view-counter-config]');
  if (!config || win.location.origin !== config.dataset.origin || win.__dossierViewsStarted) return;
  win.__dossierViewsStarted = true;
  const widgets = Array.from(doc.querySelectorAll('[data-view-count]'));
  const refs = [...new Set(widgets.map((el) => el.dataset.viewCount).filter((key) => key !== 'site:total'))];
  const zh = doc.documentElement.lang.startsWith('zh');
  const format = new Intl.NumberFormat(zh ? 'zh-CN' : 'en-US');
  const paint = (data) => {
    for (const widget of widgets) {
      const key = widget.dataset.viewCount;
      const count = key === 'site:total' ? data.totalViews : data.articles?.[key];
      if (!Number.isSafeInteger(count) || count < 0) continue;
      const output = widget.querySelector('[data-view-number]');
      if (!output) continue;
      output.textContent = format.format(count);
      const date = data.since ? new Intl.DateTimeFormat('en-CA', {
        timeZone: data.timeZone, year: 'numeric', month: '2-digit', day: '2-digit'
      }).format(new Date(data.since)) : '';
      const label = zh ? `累计浏览 ${format.format(count)} 次${date ? `，自 ${date} 起统计` : ''}`
        : `${format.format(count)} page views${date ? `, counted since ${date}` : ''}`;
      widget.title = label;
      widget.setAttribute('aria-label', label);
      widget.hidden = false;
    }
  };
  const send = async (chunk, write) => {
    const controller = new AbortController();
    const timeout = win.setTimeout(() => controller.abort(), 8000);
    try {
      const url = new URL('/api/views', win.location.origin);
      if (!write) chunk.forEach((ref) => url.searchParams.append('ref', ref));
      const response = await win.fetch(url, {
        method: write ? 'POST' : 'GET', credentials: 'same-origin', cache: 'no-store', signal: controller.signal,
        ...(write ? { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ path: win.location.pathname, refs: chunk }) } : {})
      });
      if (!response.ok || response.status === 204) return;
      paint(await response.json());
    } catch { /* Missing/blocked statistics must never affect the article. No retry. */ }
    finally { win.clearTimeout(timeout); }
  };
  let sent = false;
  const run = () => {
    if (sent || doc.visibilityState !== 'visible') return;
    sent = true;
    doc.removeEventListener('visibilitychange', run);
    let excluded = win.navigator.webdriver || win.navigator.globalPrivacyControl === true || win.navigator.doNotTrack === '1';
    try { excluded ||= win.localStorage.getItem('dossierkit:views:exclude') === '1'; } catch { /* Storage may be disabled. */ }
    // The first request reads card totals while incrementing ONLY the current page.
    void send(refs.slice(0, 60), !excluded);
    for (let i = 60; i < refs.length; i += 60) void send(refs.slice(i, i + 60), false);
  };
  doc.addEventListener('visibilitychange', run);
  run();
}
