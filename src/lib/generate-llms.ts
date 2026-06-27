import type { Locale } from "./config";
import { getAllContent } from "./content-query";
import { localize } from "./i18n";
import type { ProfilePack } from "./profile-loader";

export function generateLlmsText(pack: ProfilePack) {
  return ["zh", "en"].map((locale) => renderLocale(pack, locale as Locale)).join("\n\n---\n\n");
}

function renderLocale(pack: ProfilePack, locale: Locale) {
  const content = getAllContent(locale);
  const lines = [
    `# ${localize(pack.profile.name, locale)}`,
    "",
    localize(pack.profile.headline, locale),
    "",
    localize(pack.profile.summary, locale),
    "",
    `Location: ${localize(pack.profile.location, locale)}`,
    `Experience: ${pack.profile.yearsOfExperience} years`,
    "",
    "## Primary focus",
    ...pack.roles.roles.map((role) => `- ${localize(role.title, locale)}: ${role.focusAreas.join(", ")}`),
    "",
    "## Featured work",
    ...content.cases
      .filter((entry) => entry.data.featured)
      .map((entry) => `- ${entry.data.title}: ${entry.data.summary} (/${locale}/work/${entry.slug})`),
    "",
    "## Lab",
    ...content.lab.map((entry) => `- ${entry.data.title}: ${entry.data.summary} (/${locale}/lab/${entry.slug})`),
    "",
    "## Writing",
    ...content.writing.map((entry) => `- ${entry.data.title}: ${entry.data.summary} (/${locale}/writing/${entry.slug})`),
    "",
    "## Contact",
    `Email: ${pack.profile.links.email}`
  ];

  return lines.join("\n");
}
