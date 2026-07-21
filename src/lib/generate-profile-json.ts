import type { Locale } from "./config";
import { getAllContent } from "./content-query";
import { localize } from "./i18n";
import type { ProfilePack } from "./profile-loader";

export function generateProfileJson(pack: ProfilePack) {
  const localized = (locale: Locale) => ({
    locale,
    name: localize(pack.profile.name, locale),
    headline: localize(pack.profile.headline, locale),
    summary: localize(pack.profile.summary, locale),
    location: localize(pack.profile.location, locale),
    availability: localize(pack.profile.availability.status, locale)
  });

  return {
    schemaVersion: "0.1.0",
    profileId: pack.profile.id,
    generatedAt: new Date().toISOString(),
    profile: {
      ...pack.profile,
      localized: {
        zh: localized("zh"),
        en: localized("en")
      }
    },
    roles: pack.roles.roles,
    metrics: pack.metrics.metrics,
    experience: pack.experience.experiences,
    skills: pack.skills.skillGroups,
    content: {
      zh: summarizeContent("zh"),
      en: summarizeContent("en")
    }
  };
}

function summarizeContent(locale: Locale) {
  const content = getAllContent(locale);
  return {
    cases: content.cases.map(toSummary),
    lab: content.lab.map(toSummary),
    writing: content.writing.map(toSummary),
    notes: content.notes.map(toSummary)
  };
}

function toSummary(entry: ReturnType<typeof getAllContent>["cases"][number]) {
  return {
    slug: entry.slug,
    title: entry.data.title,
    summary: entry.data.summary,
    tags: entry.data.tags,
    featured: entry.data.featured,
    url:
      entry.kind === "cases"
        ? `/${entry.locale}/work/${entry.slug}`
        : `/${entry.locale}/${entry.kind}/${entry.slug}`
  };
}
