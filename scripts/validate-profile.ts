import path from "node:path";
import { activeProfile, locales, type Locale } from "../src/lib/config";
import { loadProfilePack, readContentCollection, type ContentKind } from "../src/lib/profile-loader";

const kinds: ContentKind[] = ["cases", "lab", "writing", "notes"];
const bilingualKinds: ContentKind[] = ["cases", "lab", "writing"];
const internalWording = [
  /\bdemos?\b/i,
  /\bexamples?\b/i,
  /\bnot a demo\b/i,
  /\bto be filled\b/i,
  /待补/,
  /后续/,
  /短板/,
  /面试官/,
  /不需要/,
  /不作为/
];

export async function main() {
  const warnings: string[] = [];
  const errors: string[] = [];

  try {
    const pack = loadProfilePack(activeProfile);
    console.log(`Validated YAML profile pack: ${pack.id}`);

    const contentByKind = new Map<string, Set<string>>();

    for (const locale of locales) {
      for (const kind of kinds) {
        const entries = readContentCollection(locale, kind);
        contentByKind.set(`${locale}:${kind}`, new Set(entries.map((entry) => entry.slug)));

        for (const entry of entries) {
          if (path.basename(entry.filePath).replace(/\.(?:md|mdx)$/, "") !== entry.slug) {
            errors.push(`${entry.filePath}: filename must match frontmatter slug "${entry.slug}"`);
          }
          if (/^#\s+/m.test(entry.body)) {
            errors.push(`${entry.filePath}: body must start at H2; the page layout owns the H1 title`);
          }
          for (const pattern of internalWording) {
            if (pattern.test(`${entry.data.title}\n${entry.data.summary}\n${entry.body}`)) {
              errors.push(`${entry.filePath}: public content contains internal wording matching ${pattern}`);
            }
          }
          if (entry.data.translationStatus === "draft") {
            warnings.push(`${entry.filePath}: translationStatus is draft`);
          }
        }

        console.log(`Validated ${entries.length} ${locale}/${kind} entries`);
      }
    }

    for (const kind of bilingualKinds) {
      compareTranslations(kind, "zh", "en", contentByKind, warnings);
      compareTranslations(kind, "en", "zh", contentByKind, warnings);
    }

    const zhCases = contentByKind.get("zh:cases") || new Set<string>();
    const enCases = contentByKind.get("en:cases") || new Set<string>();
    const zhLabs = contentByKind.get("zh:lab") || new Set<string>();
    const enLabs = contentByKind.get("en:lab") || new Set<string>();
    const zhWriting = contentByKind.get("zh:writing") || new Set<string>();
    const enWriting = contentByKind.get("en:writing") || new Set<string>();

    for (const role of pack.roles.roles) {
      for (const slug of role.relatedCases) {
        if (!zhCases.has(slug) || !enCases.has(slug)) {
          errors.push(`roles.yaml: role "${role.id}" references missing bilingual case "${slug}"`);
        }
      }

      for (const slug of role.relatedLabs) {
        if (!zhLabs.has(slug) || !enLabs.has(slug)) {
          errors.push(`roles.yaml: role "${role.id}" references missing bilingual lab "${slug}"`);
        }
      }

      for (const slug of role.relatedWriting) {
        if (!zhWriting.has(slug) || !enWriting.has(slug)) {
          errors.push(`roles.yaml: role "${role.id}" references missing bilingual writing "${slug}"`);
        }
      }
    }

    validateExperienceTimeline(pack.experience.experiences, errors);
  } catch (error) {
    errors.push(error instanceof Error ? error.message : String(error));
  }

  for (const warning of warnings) {
    console.warn(`Warning: ${warning}`);
  }

  if (errors.length > 0) {
    console.error(errors.join("\n"));
    process.exitCode = 1;
    return;
  }

  console.log(warnings.length > 0 ? `Validation passed with ${warnings.length} warning(s).` : "Validation passed.");
}

type ExperiencePeriod = string | { zh: string; en: string };

type TimelineExperience = {
  company: { zh: string; en: string };
  period: ExperiencePeriod;
};

type ParsedPeriod = {
  start: number;
  end: number;
  current: boolean;
};

function validateExperienceTimeline(experiences: TimelineExperience[], errors: string[]) {
  const parsed = experiences.map((experience, index) => {
    const company = experience.company.en || experience.company.zh;
    const zhPeriod = typeof experience.period === "string" ? experience.period : experience.period.zh;
    const enPeriod = typeof experience.period === "string" ? experience.period : experience.period.en;
    const zh = parseExperiencePeriod(zhPeriod, company, "zh", errors);
    const en = parseExperiencePeriod(enPeriod, company, "en", errors);

    if (zh && en && (zh.start !== en.start || zh.end !== en.end || zh.current !== en.current)) {
      errors.push(`experience.yaml: bilingual period mismatch for "${company}"`);
    }

    const period = zh || en;
    if (period?.current && index !== 0) {
      errors.push(`experience.yaml: only the newest experience may use an open-ended period ("${company}")`);
    }

    return { experience, company, period };
  });

  const currentRoles = parsed.filter((item) => item.period?.current);
  if (currentRoles.length > 1) {
    errors.push("experience.yaml: multiple current roles found");
  }

  for (let index = 1; index < parsed.length; index += 1) {
    const newer = parsed[index - 1];
    const older = parsed[index];
    if (!newer.period || !older.period) continue;

    if (older.period.start > newer.period.start) {
      errors.push(`experience.yaml: experiences are not ordered newest-first near "${older.company}"`);
    }

    // Month-only source records may share one handoff month. Anything beyond that is a real overlap.
    if (older.period.end > newer.period.start) {
      errors.push(
        `experience.yaml: overlapping periods for "${older.company}" and "${newer.company}"`
      );
    }
  }
}

function parseExperiencePeriod(
  value: string,
  company: string,
  locale: "zh" | "en",
  errors: string[]
): ParsedPeriod | undefined {
  const match = value.match(/^(\d{4})-(\d{2})\s+-\s+(?:(\d{4})-(\d{2})|(现在|Present))$/);
  if (!match) {
    errors.push(`experience.yaml: invalid ${locale} period for "${company}": "${value}"`);
    return undefined;
  }

  const start = toMonthIndex(match[1], match[2]);
  const current = Boolean(match[5]);
  const end = current ? Number.POSITIVE_INFINITY : toMonthIndex(match[3], match[4]);

  if (start === undefined || end === undefined) {
    errors.push(`experience.yaml: invalid ${locale} month for "${company}": "${value}"`);
    return undefined;
  }

  if (!current && start > end) {
    errors.push(`experience.yaml: period starts after it ends for "${company}": "${value}"`);
  }

  return { start, end, current };
}

function toMonthIndex(year: string | undefined, month: string | undefined) {
  if (!year || !month) return undefined;
  const numericMonth = Number(month);
  if (!Number.isInteger(numericMonth) || numericMonth < 1 || numericMonth > 12) return undefined;
  return Number(year) * 12 + numericMonth - 1;
}

function compareTranslations(
  kind: ContentKind,
  sourceLocale: Locale,
  targetLocale: Locale,
  contentByKind: Map<string, Set<string>>,
  warnings: string[]
) {
  const source = contentByKind.get(`${sourceLocale}:${kind}`) || new Set<string>();
  const target = contentByKind.get(`${targetLocale}:${kind}`) || new Set<string>();

  for (const slug of source) {
    if (!target.has(slug)) {
      warnings.push(`${sourceLocale}/${kind}/${slug}: missing ${targetLocale} translation`);
    }
  }
}

main();
