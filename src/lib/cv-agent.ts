import fs from "node:fs";
import path from "node:path";
import { parse } from "yaml";
import { z } from "zod";
import { localizedStringSchema } from "./schema";
import { localize } from "./i18n";
import type { Locale } from "./config";
import type { ContentEntry, ProfilePack } from "./profile-loader";

const localized = localizedStringSchema;
const project = z.object({ title: localized, summary: localized }).strict();
const architecturePoint = project.extend({ status: z.enum(["implemented", "designed"]) });
const reference = z.object({
  noteRef: z.string().regex(/^(zh|en)\/[a-z0-9]+(?:-[a-z0-9]+)*$/),
  label: localized
}).strict();

// An opt-in view, deliberately absent from ProfilePack and public JSON exports.
export const cvAgentSchema = z.object({
  focus: localized,
  summary: localized,
  // Opt-in display filename, independent of the legacy resume export name.
  pdfFilenameBase: z.string().min(1).max(100).optional(),
  experiences: z.array(z.object({
    sourceCompany: z.string().min(1),
    summary: localized,
    projects: z.array(project).max(5).default([])
  }).strict()).min(1),
  architecture: z.object({
    title: localized,
    stage: localized,
    summary: localized,
    points: z.array(architecturePoint).min(1).max(4)
  }).strict(),
  research: z.array(z.object({
    title: localized,
    summary: localized,
    sources: z.array(reference).min(1).max(2)
  }).strict()).max(3),
  skillGroups: z.array(z.object({
    title: localized,
    skills: z.array(z.string().min(1)).min(1)
  }).strict()).min(1).max(4)
}).strict().superRefine((value, ctx) => {
  const companies = new Set<string>();
  value.experiences.forEach((item, index) => {
    if (companies.has(item.sourceCompany)) {
      ctx.addIssue({ code: "custom", path: ["experiences", index, "sourceCompany"], message: "Duplicate experience selector" });
    }
    companies.add(item.sourceCompany);
  });
});

export type CvAgentConfig = z.infer<typeof cvAgentSchema>;

export function readCvAgentConfig(root: string): CvAgentConfig | null {
  const file = path.join(root, "cv-agent.yaml");
  if (!fs.existsSync(file)) return null;
  const result = cvAgentSchema.safeParse(parse(fs.readFileSync(file, "utf8")));
  if (!result.success) {
    throw new Error(result.error.issues.map((issue) => `${file}: ${issue.path.join(".")} - ${issue.message}`).join("\n"));
  }
  return result.data;
}

export function agentPdfFileName(filenameBase: string, locale: Locale): string {
  const base = filenameBase.normalize("NFC").trim();
  if (base.length > 100 || !/^[\p{L}\p{N}][\p{L}\p{N} ._-]*$/u.test(base) || base.includes("..") || base.endsWith(".")) {
    throw new Error("Unsafe CV PDF filename");
  }
  return `${base}-${locale}.pdf`;
}

export function agentPdfPath(filenameBase: string, locale: Locale): string {
  return `/resumes/cv-agent/${encodeURIComponent(agentPdfFileName(filenameBase, locale))}`;
}

export function buildCvAgentView(pack: ProfilePack, config: CvAgentConfig, notes: ContentEntry[], locale: Locale) {
  const experiences = config.experiences.map((selection) => {
    const matches = pack.experience.experiences.filter((item) => item.company.en === selection.sourceCompany);
    if (matches.length !== 1) throw new Error(`cv-agent: expected one experience for ${selection.sourceCompany}; found ${matches.length}`);
    const source = matches[0];
    // Identity, role and dates remain canonical; no mutation of the legacy pack.
    return { company: source.company, role: source.role, period: source.period,
      summary: selection.summary, projects: selection.projects };
  });
  const research = config.research.map((item) => ({
    ...item,
    sources: item.sources.map((reference) => {
      const [sourceLocale, slug] = reference.noteRef.split("/");
      const original = notes.find((note) => note.locale === sourceLocale && note.slug === slug);
      if (!original) throw new Error(`cv-agent: unresolved note ${reference.noteRef}`);
      const translated = notes.find((note) => note.locale === locale
        && (note.slug === original.slug || (original.data.translationKey && note.data.translationKey === original.data.translationKey))
        && ["reviewed", "complete"].includes(note.data.translationStatus));
      const selected = translated || original;
      return { ...reference, href: `/${selected.locale}/notes/${selected.slug}/`, sourceLocale: selected.locale };
    })
  }));
  const pdfBase = config.pdfFilenameBase || pack.resume.filename;
  return {
    ...config, experiences, research,
    pdfHref: agentPdfPath(pdfBase, locale),
    pdfDownloadFilename: agentPdfFileName(pdfBase, locale)
  };
}

export type CvAgentView = ReturnType<typeof buildCvAgentView>;

export function renderCvAgentPlainText(pack: ProfilePack, view: CvAgentView, locale: Locale, siteUrl: string): string {
  const zh = locale === "zh";
  const text = (value: Parameters<typeof localize>[0]) => localize(value, locale);
  const lines = [
    `${text(pack.profile.name)} | ${text(pack.profile.headline)}`,
    `${text(pack.profile.location)} | ${pack.profile.yearsOfExperience} ${zh ? "年经验" : "years of experience"}`,
    `Email: ${pack.profile.links.email}`,
    ...(pack.profile.links.github ? [`GitHub: ${pack.profile.links.github}`] : []),
    "",
    zh ? "概览" : "Profile",
    text(view.summary),
    "",
    zh ? "关键数据" : "Key metrics",
    ...pack.metrics.metrics.map((metric) => `- ${text(metric.label)}: ${text(metric.value)}`),
    "",
    zh ? "工作经历" : "Experience"
  ];
  for (const item of view.experiences) {
    lines.push("", `${text(item.company)} | ${text(item.role)} | ${text(item.period)}`, text(item.summary));
    for (const project of item.projects) lines.push(`- ${text(project.title)}: ${text(project.summary)}`);
  }
  lines.push("", zh ? "架构实践" : "Architecture Practice", `${text(view.architecture.title)} | ${text(view.architecture.stage)}`, text(view.architecture.summary));
  for (const point of view.architecture.points) {
    lines.push(`- ${text(point.title)}: ${text(point.summary)}`);
  }
  if (view.research.length) lines.push("", zh ? "技术研究" : "Selected Technical Research");
  for (const item of view.research) {
    lines.push(`- ${text(item.title)}: ${text(item.summary)}`);
    for (const source of item.sources) lines.push(`  ${text(source.label)}: ${new URL(source.href, siteUrl).href}`);
  }
  lines.push("", zh ? "核心能力" : "Core Capabilities");
  for (const group of view.skillGroups) lines.push(`- ${text(group.title)}: ${group.skills.join(" / ")}`);
  return `${lines.join("\n")}\n`;
}
