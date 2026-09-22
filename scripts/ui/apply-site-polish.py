from pathlib import Path
import re

def change(path, old, new):
    p = Path(path)
    text = p.read_text()
    assert text.count(old) == 1, f'Expected exactly one patch target: {path}: {old[:70]}'
    p.write_text(text.replace(old, new))

Path('src/lib/locale-navigation.ts').write_text('''/** Build-time resolution: never construct a link to an absent translation. */
import { readContentCollection, type ContentKind, type ProfilePack } from './profile-loader';
import type { Locale } from './config';
import { otherLocale } from './i18n';

type Entry = { slug: string; data: { translationKey?: string; translationStatus?: string } };
export function matchTranslation(source: Entry | undefined, targets: Entry[]) {
  if (!source) return undefined;
  const usable = targets.filter(entry => entry.data.translationStatus !== 'draft');
  const keyed = source.data.translationKey
    ? usable.filter(entry => entry.data.translationKey === source.data.translationKey) : [];
  // Ambiguous translation keys must not select an arbitrary article.
  if (keyed.length === 1) return keyed[0];
  return usable.find(entry => entry.slug === source.slug &&
    (!source.data.translationKey || !entry.data.translationKey || source.data.translationKey === entry.data.translationKey));
}

export function localeTarget(pathname: string, locale: Locale, pack: ProfilePack) {
  const target = otherLocale(locale);
  const path = pathname.replace(/\\/index\\.html$/, '/').replace(/\\/+$/, '') || '/';
  const match = /^\\/(zh|en)(?:\\/(.*))?$/.exec(path);
  const suffix = match?.[2] || '';
  const parts = suffix.split('/');
  const collection: Record<string, ContentKind> = { notes: 'notes', work: 'cases', lab: 'lab', writing: 'writing' };
  const section = parts[0];
  const fallback = section in collection ? `/${target}/${section}/` : `/${target}/`;
  const fallbackLabel = locale === 'zh'
    ? (section in collection ? ({notes:'English 笔记',work:'English 案例',lab:'English 实验',writing:'English 文章'}[section]) : 'English 首页')
    : (section in collection ? ({notes:'中文笔记',work:'中文案例',lab:'中文实验',writing:'中文文章'}[section]) : '中文首页');
  if (match && parts.length === 2 && section in collection) {
    const kind = collection[section];
    const source = readContentCollection(locale, kind, pack.id).find(entry => entry.slug === parts[1]);
    const translated = matchTranslation(source, readContentCollection(target, kind, pack.id));
    return { available: Boolean(translated), target, href: translated ? `/${target}/${section}/${translated.slug}/` : fallback, fallbackLabel };
  }
  const common = ['', 'cv', 'contact', 'notes', 'work', 'lab', 'writing', 'privacy'];
  const role = match && parts.length === 2 && section === 'for' && pack.roles.roles.some(role => role.path === parts[1]);
  const available = Boolean((match && common.includes(suffix)) || role || path === '/');
  return { available, target, href: available ? `/${target}/${suffix ? suffix + '/' : ''}` : fallback, fallbackLabel };
}
''')

Path('src/components/layout/LanguageSwitch.astro').write_text('''---
import IconAction from '../common/IconAction.astro';
import { localeTarget } from '../../lib/locale-navigation';
import type { Locale } from '../../lib/config';
import type { ProfilePack } from '../../lib/profile-loader';
type Props = { locale: Locale; pack: ProfilePack };
const { locale, pack } = Astro.props;
const target = localeTarget(Astro.url.pathname, locale, pack);
const zh = locale === 'zh';
const label = zh ? 'English' : '中文';
---
<IconAction icon="languages" label={label} href={target.href} class="language-switch"
  data-language-switch data-translation-available={String(target.available)}
  aria-haspopup={!target.available ? 'dialog' : undefined}
  aria-controls={!target.available ? 'language-notice' : undefined} />
{!target.available && <dialog id="language-notice" class="language-notice" data-language-notice aria-labelledby="language-notice-title" aria-describedby="language-notice-description">
  <div class="language-notice-heading">
    <h2 id="language-notice-title">{zh ? '暂无英文版本' : 'No Chinese version yet'}</h2>
    <IconAction icon="close" label={zh ? '关闭' : 'Close'} data-language-close />
  </div>
  <p id="language-notice-description">{zh ? '继续阅读原文，或浏览英文内容。' : 'Keep reading this page, or explore content in Chinese.'}</p>
  <div class="language-notice-actions">
    <button type="button" data-language-stay autofocus>{zh ? '继续阅读' : 'Keep reading'}</button>
    <a href={target.href} data-language-fallback>{target.fallbackLabel}<span aria-hidden="true"> →</span></a>
  </div>
</dialog>}
<script>
  const trigger = document.querySelector<HTMLAnchorElement>('[data-language-switch]');
  const notice = document.querySelector<HTMLDialogElement>('[data-language-notice]');
  if (trigger && notice && !trigger.dataset.noticeBound) {
    trigger.dataset.noticeBound = 'true';
    trigger.addEventListener('click', event => {
      // A modified click and a no-JS browser still receive a valid list/home URL.
      if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || !notice.showModal) return;
      event.preventDefault();
      notice.showModal();
      trigger.setAttribute('aria-expanded', 'true');
    });
    notice.querySelector('[data-language-close]')?.addEventListener('click', () => notice.close());
    notice.querySelector('[data-language-stay]')?.addEventListener('click', () => notice.close());
    notice.addEventListener('click', event => {
      if (event.target !== notice) return;
      const bounds = notice.getBoundingClientRect();
      if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) notice.close();
    });
    notice.addEventListener('close', () => { trigger.setAttribute('aria-expanded', 'false'); trigger.focus({ preventScroll: true }); });
  }
</script>
<style>
  .language-notice { width: min(23rem, calc(100vw - 2rem)); max-height: calc(100dvh - 2rem); overflow: auto; box-sizing: border-box; margin: auto; padding: 1rem 1.25rem 1.25rem; border: 1px solid var(--color-border); border-radius: 18px; background: var(--color-surface); color: var(--color-foreground); box-shadow: 0 18px 60px rgb(0 0 0 / 12%); }
  .language-notice::backdrop { background: rgb(18 30 28 / 20%); }
  .language-notice-heading { display: flex; align-items: center; justify-content: space-between; gap: .75rem; }
  h2 { margin: 0; font-size: 1rem; font-weight: 600; }
  p { margin: .5rem 0 1rem; color: var(--color-muted); font-size: .875rem; line-height: 1.6; }
  .language-notice-actions { display: flex; justify-content: flex-end; flex-wrap: wrap; gap: .5rem; }
  .language-notice-actions a, .language-notice-actions button { display: inline-flex; min-height: 44px; align-items: center; justify-content: center; gap: .25rem; padding: .5rem .75rem; border: 1px solid var(--color-border); border-radius: 10px; color: var(--color-foreground); background: transparent; font: inherit; font-size: .85rem; cursor: pointer; text-decoration: none; }
  .language-notice-actions a { background: var(--color-accent-soft); border-color: transparent; }
  .language-notice-actions :is(a,button):focus-visible { outline: 2px solid var(--color-accent); outline-offset: 3px; }
</style>
''')

header = 'src/components/layout/Header.astro'
change(header, 'import IconAction from "../common/IconAction.astro";', 'import LanguageSwitch from "./LanguageSwitch.astro";')
change(header, 'import { labels, localePath, localize, otherLocale, switchLocalePath } from "../../lib/i18n";', 'import { localePath, localize } from "../../lib/i18n";')
change(header, 'const l = labels[locale];\nconst altLocale = otherLocale(locale);\nconst altHref = switchLocalePath(Astro.url.pathname, altLocale);\n', '')
change(header, '<IconAction icon="languages" label={l.switchLanguage} href={altHref} class="language-switch" />', '<LanguageSwitch locale={locale} pack={pack} />')
change(header, 'font-family: Georgia, "Times New Roman", serif;\n    font-size: clamp(1.08rem, 1.8vw, 1.34rem);\n    font-style: italic;\n    font-weight: 620;\n    line-height: 1.15;\n    letter-spacing: -0.025em;', '''font-family: "Pacifico", "Brush Script MT", cursive;
    font-size: clamp(1.35rem, 2.15vw, 1.9rem);
    font-style: normal;
    font-weight: 400;
    line-height: 1.45;
    letter-spacing: 0;
    font-feature-settings: "liga" 1, "calt" 1;
    text-wrap: balance;
    padding: .08em .2em .16em 0;
    transform: rotate(-2deg) skewX(-6deg);
    transform-origin: center;
    overflow-wrap: normal;''')
change(header, 'font-size: 0.74rem;\n      letter-spacing: -0.035em;', 'font-size: clamp(.95rem, 4.2vw, 1.15rem);\n      line-height: 1.4;\n      letter-spacing: 0;')

engagement = 'src/components/notes/NoteEngagement.astro'
p = Path(engagement); text = p.read_text(); assert '.share-row {' in text
text = text.replace('.share-row {', '.share-row { justify-content: flex-end;', 1)
p.write_text(text)

note = 'src/pages/[locale]/notes/[slug].astro'
change(note, '''  if (diagrams.length > 0) {
    renderDiagrams().then(() => {
      enableDiagramViewer(diagrams);
    }).catch(() => {
      diagrams.forEach((diagram) => diagram.classList.add("mermaid-failed"));
    });
  }''', '''  if (diagrams.length > 0) {
    const initialHash = window.location.hash;
    let userMoved = false;
    const moved = () => { userMoved = true; };
    const motionEvents = ['wheel', 'touchstart', 'pointerdown', 'keydown'] as const;
    motionEvents.forEach(name => window.addEventListener(name, moved, { passive: true, once: true }));
    renderDiagrams().then(() => {
      enableDiagramViewer(diagrams);
      // Async diagram layout must not leave a deep link above its intended heading.
      if (initialHash && window.location.hash === initialHash && !userMoved) {
        try { document.getElementById(decodeURIComponent(initialHash.slice(1)))?.scrollIntoView({ block: 'start' }); }
        catch { /* A malformed fragment does not affect the page. */ }
      }
    }).catch(() => {
      diagrams.forEach((diagram) => diagram.classList.add("mermaid-failed"));
    }).finally(() => motionEvents.forEach(name => window.removeEventListener(name, moved)));
  }''')
change(note, '      theme: "base",\n      themeVariables:', '      theme: "base",\n      state: { padding: 8, nodeSpacing: 28, rankSpacing: 24 },\n      themeVariables:')
change(note, '    let baseWidth = 0;\n    let aspectRatio = 1.6;', '    let baseWidth = 0;\n    let naturalWidth = 0;\n    let aspectRatio = 1.6;')
change(note, '''      const svg = diagram.querySelector<SVGSVGElement>("svg");
      if (!svg) return;

      const trigger''', '''      const svg = diagram.querySelector<SVGSVGElement>("svg");
      if (!svg) return;
      const box = svg.viewBox.baseVal;
      // Use intrinsic dimensions, downscale only when needed. Narrow state charts
      // must not be stretched to an arbitrary 640px minimum or the prose width.
      if (box.width > 0 && box.height > 0) {
        svg.style.width = `${box.width}px`;
        svg.style.maxWidth = '100%';
        svg.style.minWidth = '0';
        svg.style.height = 'auto';
        svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
        diagram.dataset.diagramReady = 'true';
      }

      const trigger''')
change(note, '''      const bounds = sourceSvg.getBoundingClientRect();
      aspectRatio =''', '''      const bounds = sourceSvg.getBoundingClientRect();
      naturalWidth = viewBox.width > 0 ? viewBox.width : bounds.width;
      aspectRatio =''')
change(note, '''      const availableWidth = Math.max(stage.clientWidth - horizontalPadding, 220);
      const availableHeight = Math.max(stage.clientHeight - verticalPadding, 180);
      baseWidth = Math.max(Math.min(availableWidth, availableHeight * aspectRatio), 220);''', '''      const availableWidth = Math.max(stage.clientWidth - horizontalPadding, 1);
      const availableHeight = Math.max(stage.clientHeight - verticalPadding, 1);
      // Fit BOTH axes, without a width floor that makes tall diagrams overflow.
      baseWidth = Math.max(Math.min(availableWidth, availableHeight * aspectRatio, naturalWidth), 1);''')
change(note, '''    padding: 22px;
    background: rgba(255, 255, 255, 0.7);''', '''    padding: 42px clamp(12px, 2.5vw, 22px) 18px;
    background: rgba(255, 255, 255, 0.7);''')
change(note, '''    width: 100%;
    min-width: 640px;
    height: auto;''', '''    display: block;
    width: auto;
    min-width: 0;
    max-width: 100%;
    height: auto;
    margin-inline: auto;''')
change(note, '''  :global(.note-prose .mermaid-failed) {''', '''  :global(.note-prose :is(h2, h3, h4)[id]) { scroll-margin-top: 100px; }

  :global(.note-prose .mermaid-failed) {''')

p = Path('AGENTS.md')
p.write_text(p.read_text() + '\nLanguage switches resolve published counterparts by translationKey or slug at build time; missing translations keep the reader on the current page with a compact choice of original or target-language index. Keep an actual, valid fallback href for no-JS and modified clicks. Share utilities align right. The site wordmark uses the existing Pacifico signature face; do not add a second font library. Mermaid previews preserve intrinsic aspect ratio and never upscale narrow diagrams to a fixed minimum width.\n')
print('UI-only polish applied. No content, counter, D1, credential or routing changes.')
