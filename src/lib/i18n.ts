import type { Locale } from "./config";
import type { LocalizedString } from "./schema";

export const labels = {
  zh: {
    home: "首页",
    cv: "简历",
    work: "案例",
    lab: "实验",
    writing: "文章",
    contact: "联系",
    roles: "定位方向",
    proof: "履历重点",
    experience: "经历",
    skills: "能力",
    featuredCases: "代表案例",
    featuredLab: "实验记录",
    latestWriting: "文章",
    readMore: "查看详情",
    viewCv: "查看简历",
    email: "邮件联系",
    switchLanguage: "English",
    availability: "当前状态",
    metrics: "关键指标",
    relatedWork: "相关案例",
    relatedLab: "相关实验",
    backToList: "返回列表"
  },
  en: {
    home: "Home",
    cv: "CV",
    work: "Work",
    lab: "Lab",
    writing: "Writing",
    contact: "Contact",
    roles: "Focus",
    proof: "Highlights",
    experience: "Experience",
    skills: "Skills",
    featuredCases: "Featured Work",
    featuredLab: "Lab Notes",
    latestWriting: "Writing",
    readMore: "Read more",
    viewCv: "View CV",
    email: "Email",
    switchLanguage: "中文",
    availability: "Availability",
    metrics: "Key Metrics",
    relatedWork: "Related Work",
    relatedLab: "Related Lab",
    backToList: "Back to list"
  }
} as const;

export function localize(value: LocalizedString | string | undefined, locale: Locale) {
  if (!value) return "";
  if (typeof value === "string") return value;
  return value[locale] || value.zh || value.en || "";
}

export function otherLocale(locale: Locale): Locale {
  return locale === "zh" ? "en" : "zh";
}

export function localePath(locale: Locale, path = "") {
  const normalized = path.startsWith("/") ? path : `/${path}`;
  return `/${locale}${normalized === "/" ? "" : normalized}`;
}

export function switchLocalePath(pathname: string, targetLocale: Locale) {
  if (pathname.startsWith("/zh")) return pathname.replace(/^\/zh/, `/${targetLocale}`);
  if (pathname.startsWith("/en")) return pathname.replace(/^\/en/, `/${targetLocale}`);
  return `/${targetLocale}`;
}
