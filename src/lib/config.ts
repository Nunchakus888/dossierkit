import path from "node:path";

export const locales = ["zh", "en"] as const;
export type Locale = (typeof locales)[number];

export const defaultLocale: Locale =
  process.env.DEFAULT_LOCALE === "en" ? "en" : "zh";

export const activeProfile = process.env.ACTIVE_PROFILE || "default";
export const siteUrl = process.env.PUBLIC_SITE_URL || "https://sunionpeaks.pages.dev";
export const repository = process.env.GITHUB_REPOSITORY || "";

export function rootPath(...segments: string[]) {
  return path.join(process.cwd(), ...segments);
}

export function profileRoot(profileId = activeProfile) {
  return rootPath("profiles", profileId);
}

export function isLocale(value: string | undefined): value is Locale {
  return value === "zh" || value === "en";
}
