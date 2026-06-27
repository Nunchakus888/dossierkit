import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";
import { marked } from "marked";
import { parse as parseYaml } from "yaml";
import type { z } from "zod";
import { activeProfile, type Locale, profileRoot } from "./config";
import {
  contentFrontmatterSchema,
  educationSchema,
  experienceSchema,
  homeSchema,
  metricsSchema,
  navigationSchema,
  profileSchema,
  resumeSchema,
  rolesSchema,
  skillsSchema,
  themeSchema,
  type ContentFrontmatter,
  type Education,
  type Experience,
  type Home,
  type Metrics,
  type Navigation,
  type Profile,
  type Resume,
  type Roles,
  type Skills,
  type Theme
} from "./schema";

export type ContentKind = "cases" | "lab" | "writing";

export type ContentEntry = {
  kind: ContentKind;
  slug: string;
  locale: Locale;
  filePath: string;
  body: string;
  html: string;
  data: ContentFrontmatter;
};

export type ProfilePack = {
  id: string;
  root: string;
  profile: Profile;
  experience: Experience;
  education: Education;
  skills: Skills;
  roles: Roles;
  metrics: Metrics;
  theme: Theme;
  resume: Resume;
  home: Home;
  navigation: Navigation;
};

function formatZodError(error: z.ZodError, filePath: string) {
  return error.issues
    .map((issue) => `${filePath}: ${issue.path.join(".") || "(root)"} - ${issue.message}`)
    .join("\n");
}

export function readYamlFile<T extends z.ZodTypeAny>(filePath: string, schema: T): z.infer<T> {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Missing required file: ${filePath}`);
  }

  const source = fs.readFileSync(filePath, "utf8");
  const parsed = parseYaml(source);
  const result = schema.safeParse(parsed);

  if (!result.success) {
    throw new Error(formatZodError(result.error, filePath));
  }

  return result.data;
}

export function getProfileRoot(profileId = activeProfile) {
  return profileRoot(profileId);
}

export function loadProfilePack(profileId = activeProfile): ProfilePack {
  const root = getProfileRoot(profileId);

  return {
    id: profileId,
    root,
    profile: readYamlFile(path.join(root, "profile.yaml"), profileSchema),
    experience: readYamlFile(path.join(root, "experience.yaml"), experienceSchema),
    education: readYamlFile(path.join(root, "education.yaml"), educationSchema),
    skills: readYamlFile(path.join(root, "skills.yaml"), skillsSchema),
    roles: readYamlFile(path.join(root, "roles.yaml"), rolesSchema),
    metrics: readYamlFile(path.join(root, "metrics.yaml"), metricsSchema),
    theme: readYamlFile(path.join(root, "theme.yaml"), themeSchema),
    resume: readYamlFile(path.join(root, "resume.yaml"), resumeSchema),
    home: readYamlFile(path.join(root, "home.yaml"), homeSchema),
    navigation: readYamlFile(path.join(root, "navigation.yaml"), navigationSchema)
  };
}

export function readContentCollection(
  locale: Locale,
  kind: ContentKind,
  profileId = activeProfile
): ContentEntry[] {
  const dir = path.join(getProfileRoot(profileId), "content", locale, kind);
  if (!fs.existsSync(dir)) return [];

  return fs
    .readdirSync(dir)
    .filter((file) => file.endsWith(".mdx") || file.endsWith(".md"))
    .map((file) => {
      const filePath = path.join(dir, file);
      const source = fs.readFileSync(filePath, "utf8");
      const parsed = matter(source);
      const data = contentFrontmatterSchema.safeParse(parsed.data);

      if (!data.success) {
        throw new Error(formatZodError(data.error, filePath));
      }

      if (data.data.locale !== locale) {
        throw new Error(`${filePath}: frontmatter locale must be "${locale}"`);
      }

      const html = marked.parse(parsed.content, { async: false }) as string;

      return {
        kind,
        slug: data.data.slug,
        locale,
        filePath,
        body: parsed.content,
        html,
        data: data.data
      };
    })
    .sort((a, b) => {
      const left = a.data.date || a.data.period || "";
      const right = b.data.date || b.data.period || "";
      return right.localeCompare(left);
    });
}

export function readAllLocalizedContent(locale: Locale, profileId = activeProfile) {
  return {
    cases: readContentCollection(locale, "cases", profileId),
    lab: readContentCollection(locale, "lab", profileId),
    writing: readContentCollection(locale, "writing", profileId)
  };
}

export function findContentBySlug(
  locale: Locale,
  kind: ContentKind,
  slug: string,
  profileId = activeProfile
) {
  return readContentCollection(locale, kind, profileId).find((entry) => entry.slug === slug);
}

export function listProfileAssets(profileId = activeProfile) {
  const root = path.join(getProfileRoot(profileId), "assets");
  if (!fs.existsSync(root)) return [];

  const files: string[] = [];
  const walk = (dir: string) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(fullPath);
      } else {
        files.push(path.relative(root, fullPath));
      }
    }
  };

  walk(root);
  return files.map((relativePath) => ({
    profileId,
    relativePath: relativePath.split(path.sep).join("/"),
    fullPath: path.join(root, relativePath)
  }));
}
