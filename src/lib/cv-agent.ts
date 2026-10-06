import fs from "node:fs";
import path from "node:path";
import { parse } from "yaml";
import { z } from "zod";
import { localizedStringSchema } from "./schema";
import type { Locale } from "./config";
import type { ContentEntry, ProfilePack } from "./profile-loader";

const localized = localizedStringSchema;
const project = z.object({ title: localized, summary: localized }).strict();
const reference = z.object({
  noteRef: z.string().regex(/^(zh|en)\/[a-z0-9]+(?:-[a-z0-9]+)*$/),
  label: localized
}).strict();

// An opt-in view, deliberately absent from ProfilePack and public JSON exports.
export const cvAgentSchema = z.object({
  focus: localized,
  summary: localized,
  experiences: z.array(z.object({
    sourceCompany: z.string().min(1),
    summary: localized,
    projects: z.array(project).max(4).default([])
  }).strict()).min(1),
  architecture: z.object({
    title: localized,
    stage: localized,
    summary: localized,
    points: z.array(project).min(1).max(4)
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

export function agentPdfPath(filename: string, locale: Locale): string {
  if (!/^[a-zA-Z0-9_-]+$/.test(filename)) throw new Error("Unsafe CV PDF filename");
  return `/resumes/cv-agent/${filename}-${locale}.pdf`;
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
  return { ...config, experiences, research, pdfHref: agentPdfPath(pack.resume.filename, locale) };
}

export type CvAgentView = ReturnType<typeof buildCvAgentView>;
