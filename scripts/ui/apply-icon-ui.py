"""UI-only changes. Run against verified main; never edit analytics."""
from pathlib import Path
import re
ROOT=Path.cwd()
def read(p): return (ROOT/p).read_text()
def write(p,s):
 f=ROOT/p; f.parent.mkdir(parents=True,exist_ok=True); f.write_text(s)
def replace(p,old,new):
 s=read(p)
 if s.count(old)!=1: raise RuntimeError(f'{p}: expected one replacement, found {s.count(old)}')
 write(p,s.replace(old,new))
def add_import(p,statement):
 s=read(p); assert s.startswith('---\n'),p
 write(p,s.replace('---\n','---\n'+statement+'\n',1))
def remove_styles(p,pattern): write(p,re.sub(pattern,'',read(p),flags=re.S))
write('src/components/common/IconAction.astro','''---
import Icon from './Icon.astro';
type Props = {
  icon: string;
  label: string;
  href?: string;
  size?: number;
  class?: string;
  [attribute: string]: unknown;
};
const { icon, label, href, size = 18, class: className, ...attributes } = Astro.props;
const Tag = href ? 'a' : 'button';
---
<Tag {...attributes} href={href} type={href ? undefined : 'button'} class:list={['icon-action', className]} title={label} aria-label={label} data-icon-action>
  <Icon name={icon} size={size} />
</Tag>
''')
replace('src/components/common/Icon.astro','const icons: Record<string, string> = {','''const icons: Record<string, string> = {
  "x-brand": '<path fill="currentColor" stroke="none" d="M18.244 2.25h3.308l-7.227 8.26L22.827 21.75H16.17l-5.214-6.817-5.966 6.817H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231Zm-1.161 17.52h1.833L7.084 4.126H5.117Z"/>',
  "link": '<path d="M10 13a5 5 0 0 0 7 .1l3-3a5 5 0 0 0-7.1-7.1l-1.7 1.7"/><path d="M14 11a5 5 0 0 0-7-.1l-3 3a5 5 0 0 0 7.1 7.1l1.7-1.7"/>',
  "check": '<path d="m5 12 4 4L19 6"/>',
  "shield": '<path d="M12 3 4 6v6c0 5 8 9 8 9s8-4 8-9V6Z"/><path d="m9 12 2 2 4-4"/>',
  "linkedin": '<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M7 10v7M11 17v-7M11 13a3 3 0 0 1 6 0v4"/><circle cx="7" cy="7" r=".5" fill="currentColor"/>',
  "arrow-left": '<path d="M19 12H5m6-6-6 6 6 6"/>',
  "expand": '<path d="M8 3H3v5m13-5h5v5M8 21H3v-5m13 5h5v-5"/>',
  "close": '<path d="m6 6 12 12M6 18 18 6"/>',
  "plus": '<path d="M12 5v14M5 12h14"/>',
  "minus": '<path d="M5 12h14"/>',''')
write('src/styles/icon-actions.css','''/* Shared utility controls: quiet by default, clear on focus, touch-sized. */
.icon-action {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: 0 0 auto;
  width: 44px;
  height: 44px;
  min-width: 44px;
  min-height: 44px;
  padding: 0;
  border: 1px solid transparent;
  border-radius: 10px;
  background: transparent;
  color: var(--color-muted);
  box-shadow: none;
  text-decoration: none;
  vertical-align: middle;
  cursor: pointer;
  font: inherit;
  line-height: 1;
  touch-action: manipulation;
  transition: color 150ms ease, background-color 150ms ease;
}
.icon-action:hover:not(:disabled) {
  color: var(--color-foreground);
  background: color-mix(in srgb, var(--color-muted), transparent 92%);
}
.icon-action:focus-visible {
  color: var(--color-foreground);
  outline: 2px solid var(--color-accent);
  outline-offset: 2px;
}
.icon-action:disabled { cursor: default; opacity: .45; }
.icon-action > svg { pointer-events: none; }
.icon-action [hidden] { display: none !important; }
.visually-hidden {
  position: absolute !important;
  width: 1px !important;
  height: 1px !important;
  padding: 0 !important;
  margin: -1px !important;
  overflow: hidden !important;
  clip: rect(0, 0, 0, 0) !important;
  white-space: nowrap !important;
  border: 0 !important;
}
@media (prefers-reduced-motion: reduce) { .icon-action { transition: none; } }
@media (forced-colors: active) { .icon-action { border-color: ButtonText; } }
''')
replace('src/styles/global.css','@import "tailwindcss";','@import "tailwindcss";\n@import "./icon-actions.css";')
p='src/components/notes/NoteEngagement.astro'
s=read(p); old_script=s[s.index('    const root = panel.querySelector<HTMLElement>'):s.index('</script>')]
write(p,'''---
import Icon from '../common/Icon.astro';
import IconAction from '../common/IconAction.astro';
import { integrationContext, noteIntegration } from '../../lib/integrations';
import { composePost } from '../../lib/social-text.mjs';
const { noteRef, title, summary, url, locale = 'zh' } = Astro.props;
const { config, production } = integrationContext();
const options = noteIntegration(config, noteRef);
const visible = production && (options.share || options.comments);
const draft = production && options.share ? composePost({ title, summary, url, text: options.socialText }) : undefined;
const zh = locale === 'zh';
const comments = config.comments;
const copyLabel = zh ? '复制链接' : 'Copy link';
---
{visible && (
  <section class="page-shell note-engagement no-print" data-engagement data-origin={config.productionOrigin} data-pagefind-ignore aria-label={zh ? '分享与讨论' : 'Share and discuss'}>
    <div class="share-row" role="group" aria-label={zh ? '分享与讨论操作' : 'Sharing and discussion actions'}>
      {options.share && draft && <>
        <IconAction icon="x-brand" label={zh ? '分享到 X（新窗口）' : 'Share on X (new window)'} href={draft.intentUrl} target="_blank" rel="noopener noreferrer" data-share-x />
        <button class="icon-action" type="button" data-icon-action data-copy-link={url} title={copyLabel} aria-label={copyLabel}>
          <span data-copy-icon><Icon name="link" /></span>
          <span data-copy-done hidden><Icon name="check" /></span>
        </button>
        <span class="visually-hidden" role="status" aria-live="polite" aria-atomic="true" data-copy-status></span>
      </>}
      {options.comments && <IconAction icon="github" label={zh ? '在 GitHub 讨论（新窗口）' : 'Discuss on GitHub (new window)'} href={`https://github.com/${comments.repo}/discussions`} target="_blank" rel="noopener noreferrer" data-discussion-link />}
    </div>
    {options.share && draft && <div class="copy-fallback-row" data-copy-fallback-row hidden>
      <label class="visually-hidden" for="note-share-url">{zh ? '选择并复制文章链接' : 'Select and copy the article link'}</label>
      <input id="note-share-url" class="copy-fallback" data-copy-fallback type="text" readonly value={url} />
    </div>}
    {options.comments && <section class="comments-panel" aria-label={zh ? '评论与反馈' : 'Comments and reactions'}>
      <p class="visually-hidden">{zh ? '评论公开保存在 GitHub Discussions。' : 'Comments are public in GitHub Discussions.'}</p>
      <div class="giscus" data-giscus-root data-repo={comments.repo} data-repo-id={comments.repoId} data-category={comments.category} data-category-id={comments.categoryId} data-term={options.threadKey} data-theme={comments.theme} data-lang={zh ? 'zh-CN' : 'en'} data-reactions={comments.reactions ? '1' : '0'}></div>
    </section>}
  </section>
)}
<script>
  document.querySelectorAll<HTMLElement>('[data-engagement]').forEach((panel) => {
    if (window.location.origin !== panel.dataset.origin) { panel.hidden = true; return; }
    if (panel.dataset.actionsBound) return;
    panel.dataset.actionsBound = 'true';
    let resetTimer: ReturnType<typeof setTimeout> | undefined;
    panel.querySelector<HTMLButtonElement>('[data-copy-link]')?.addEventListener('click', async (event) => {
      const button = event.currentTarget as HTMLButtonElement;
      const status = panel.querySelector<HTMLElement>('[data-copy-status]');
      const icon = button.querySelector<HTMLElement>('[data-copy-icon]');
      const done = button.querySelector<HTMLElement>('[data-copy-done]');
      const fallback = panel.querySelector<HTMLElement>('[data-copy-fallback-row]');
      const zh = document.documentElement.lang.startsWith('zh');
      const setLabel = (text: string) => { button.title = text; button.setAttribute('aria-label', text); };
      if (resetTimer) clearTimeout(resetTimer);
      button.disabled = true;
      if (status) status.textContent = '';
      if (icon) icon.hidden = false;
      if (done) done.hidden = true;
      setLabel(zh ? '复制链接' : 'Copy link');
      try {
        await navigator.clipboard.writeText(button.dataset.copyLink || '');
        if (fallback) fallback.hidden = true;
        if (icon) icon.hidden = true;
        if (done) done.hidden = false;
        setLabel(zh ? '已复制' : 'Copied');
        if (status) status.textContent = zh ? '链接已复制' : 'Link copied';
        resetTimer = setTimeout(() => {
          if (icon) icon.hidden = false;
          if (done) done.hidden = true;
          setLabel(zh ? '复制链接' : 'Copy link');
          if (status) status.textContent = '';
        }, 2000);
      } catch {
        if (fallback) fallback.hidden = false;
        const input = panel.querySelector<HTMLInputElement>('[data-copy-fallback]');
        if (input) { input.focus(); input.select(); }
        if (status) status.textContent = zh ? '自动复制不可用，请复制已选中的链接' : 'Automatic copy unavailable. Copy the selected link.';
      } finally { button.disabled = false; }
    });
'''+old_script+'''</script>
<style>
  .note-engagement { margin-top: 1.5rem; margin-bottom: 2rem; }
  .share-row { display: flex; flex-wrap: wrap; gap: .25rem; align-items: center; padding: .5rem 0; border-top: 1px solid var(--color-border); }
  .share-row span[data-copy-icon], .share-row span[data-copy-done] { display: inline-flex; }
  .copy-fallback-row { margin: .25rem 0 .75rem; }
  .copy-fallback { width: 100%; border: 1px solid var(--color-border); border-radius: .5rem; padding: .6rem; color: var(--color-muted); background: var(--color-surface); font: inherit; font-size: .8rem; }
  .comments-panel { padding-top: .5rem; }
  .giscus { min-height: 3rem; color: var(--color-muted); font-size: .8rem; }
  [hidden] { display: none !important; }
</style>
''')
replace(p,"'评论区暂时无法加载，可通过下方链接参与讨论。'","'评论暂不可用，可使用上方 GitHub 图标。'")
replace(p,"'Comments are unavailable here. Use the GitHub link below.'","'Comments unavailable. Use the GitHub icon above.'")
p='src/components/layout/Header.astro'
replace(p,'import Icon from "../common/Icon.astro";','import IconAction from "../common/IconAction.astro";')
s,n=re.subn(r'      <a class="language-pill"[\s\S]*?</a>','      <IconAction icon="languages" label={l.switchLanguage} href={altHref} class="language-switch" />',read(p),count=1); assert n==1; write(p,s)
remove_styles(p,r'\n\s*\.language-pill[^{}]*\{[^{}]*\}')
p='src/components/layout/Footer.astro'
add_import(p,'import IconAction from "../common/IconAction.astro";')
replace(p,'<a class="counter-privacy" href={`/${locale}/privacy/`}>{locale === "zh" ? "统计与隐私" : "Statistics & privacy"}</a>','<IconAction icon="shield" size={15} class="counter-privacy" href={`/${locale}/privacy/`} label={locale === "zh" ? "统计与隐私" : "Statistics & privacy"} />')
remove_styles(p,r'\n\s*\.counter-privacy[^{}]*\{[^{}]*\}')
p='src/layouts/CVLayout.astro'
add_import(p,'import IconAction from "../components/common/IconAction.astro";')
replace(p,'''<a class="cv-action primary" href={pdfHref} download aria-label={downloadLabel} title={downloadLabel}>
            <Icon name="download" size={18} />
          </a>''','<IconAction icon="download" class="cv-action" href={pdfHref} download label={downloadLabel} />')
replace(p,'''<button class="cv-action" type="button" onclick="window.print()" aria-label={printLabel} title={printLabel}>
            <Icon name="printer" size={18} />
          </button>''','<IconAction icon="printer" class="cv-action" onclick="window.print()" label={printLabel} />')
remove_styles(p,r'\n  \.cv-action(?:\s|\.|:)[^{}]*\{[^{}]*\}')
p='src/components/dossier/ContactPanel.astro'
replace(p,'import Icon from "../common/Icon.astro";','import IconAction from "../common/IconAction.astro";')
replace(p,'''<a class="button primary" href={`mailto:${pack.profile.links.email}`}>
        <Icon name="mail" size={16} />
        {pack.profile.links.email}
      </a>
      {pack.profile.links.github && <a class="button" href={pack.profile.links.github}>GitHub</a>}
      {pack.profile.links.linkedin && <a class="button" href={pack.profile.links.linkedin}>LinkedIn</a>}''','''<IconAction icon="mail" href={`mailto:${pack.profile.links.email}`} label={`${locale === 'zh' ? '邮件' : 'Email'}: ${pack.profile.links.email}`} />
      {pack.profile.links.github && <IconAction icon="github" href={pack.profile.links.github} label="GitHub" />}
      {pack.profile.links.linkedin && <IconAction icon="linkedin" href={pack.profile.links.linkedin} label="LinkedIn" />}''')
replace(p,'    flex-direction: column;\n    gap: 10px;','    flex-direction: row;\n    flex-wrap: wrap;\n    gap: 4px;')
p='src/components/dossier/QuickLinks.astro'
add_import(p,'import IconAction from "../common/IconAction.astro";')
replace(p,'''<a class="contact-action" href={navHref("contact")}>
        <Icon name={contact.icon} size={24} strokeWidth={1.9} />
        <span>{localize(contact.actionLabel, locale)}</span>
      </a>''','<IconAction icon={contact.icon} href={navHref("contact")} label={localize(contact.actionLabel, locale)} />')
remove_styles(p,r'\n\s*\.contact-action[^{}]*\{[^{}]*\}')
for section in ['notes','writing']:
 p=f'src/pages/[locale]/{section}/[slug].astro'
 add_import(p,'import IconAction from "../../../components/common/IconAction.astro";')
 replace(p,f'<a class="back-link no-print" href={{localePath(locale, "{section}")}}>{{l.backToList}}</a>',f'<IconAction icon="arrow-left" class="back-link no-print" href={{localePath(locale, "{section}")}} label={{l.backToList}} />')
 remove_styles(p,r'\n\s*\.back-link[^{}]*\{[^{}]*\}')
p='src/pages/[locale]/notes/[slug].astro'
s=read(p); start=s.index('          <button\n            type="button"\n            data-diagram-zoom-out'); end=s.index('\n        </div>',start)
s=s[:start]+'''          <IconAction icon="minus" data-diagram-zoom-out label={locale === 'zh' ? '缩小图表 (-)' : 'Zoom out (-)'} />
          <output data-diagram-zoom-output aria-live="polite">100%</output>
          <IconAction icon="plus" data-diagram-zoom-in label={locale === 'zh' ? '放大图表 (+)' : 'Zoom in (+)'} />
          <IconAction icon="expand" data-diagram-reset label={locale === 'zh' ? '适应窗口 (0)' : 'Fit to window (0)'} />
          <IconAction icon="close" data-diagram-close label={locale === 'zh' ? '关闭 (Esc)' : 'Close (Esc)'} />'''+s[end:];write(p,s)
remove_styles(p,r'\n\s*\.diagram-viewer-toolbar button[^{}]*\{[^{}]*\}')
replace(p,'<p>{locale === "zh" ? "交互式图表" : "Interactive diagram"}</p>','')
replace(p,'{locale === "zh" ? "放大查看" : "Expanded view"}','{locale === "zh" ? "图表" : "Diagram"}')
replace(p,'<p class="diagram-viewer-hint">','<p id="diagram-help" class="diagram-viewer-hint visually-hidden">')
replace(p,'        data-diagram-stage\n        tabindex="0"','        data-diagram-stage\n        aria-describedby="diagram-help"\n        tabindex="0"')
p='AGENTS.md';write(p,read(p)+'''
## Public UI actions

Use the shared `IconAction` for familiar utility actions (share, copy, language, contact, download, print, back, zoom, close). Keep utility chrome icon-first, neutral, and quiet. Remove redundant action headings and explanatory prose. Retain meaningful navigation labels and content titles where an icon would be ambiguous. Every icon-only action needs a localized accessible name and hover title, visible keyboard focus, and a 44px touch target. Success feedback may be a temporary check mark with a live-region announcement; keep a usable fallback when an operation fails. Do not change collection semantics, metrics, content, or destinations during visual-only changes.
''')
print('Icon-first UI applied; analytics code, data and destinations unchanged.')
