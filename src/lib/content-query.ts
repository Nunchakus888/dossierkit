import type { Locale } from "./config";
import {
  findContentBySlug,
  readAllLocalizedContent,
  readContentCollection,
  type ContentKind
} from "./profile-loader";

export function getCollection(locale: Locale, kind: ContentKind) {
  return readContentCollection(locale, kind);
}

export function getContent(locale: Locale, kind: ContentKind, slug: string) {
  return findContentBySlug(locale, kind, slug);
}

export function getFeatured(locale: Locale, kind: ContentKind, limit = 3) {
  return readContentCollection(locale, kind)
    .filter((entry) => entry.data.featured)
    .slice(0, limit);
}

export function getAllContent(locale: Locale) {
  return readAllLocalizedContent(locale);
}
