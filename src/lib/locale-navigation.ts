/** Build-time resolution: never construct a link to an absent translation. */
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
  const path = pathname.replace(/\/index\.html$/, '/').replace(/\/+$/, '') || '/';
  const match = /^\/(zh|en)(?:\/(.*))?$/.exec(path);
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
