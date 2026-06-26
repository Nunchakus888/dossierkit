import type { Locale } from "./config";
import { localize } from "./i18n";
import type { ProfilePack } from "./profile-loader";

export function pageTitle(pack: ProfilePack, locale: Locale, title?: string) {
  const name = localize(pack.profile.name, locale);
  return title ? `${title} | ${name}` : `${name} | Dossier`;
}

export function pageDescription(pack: ProfilePack, locale: Locale, description?: string) {
  return description || localize(pack.profile.summary, locale);
}
