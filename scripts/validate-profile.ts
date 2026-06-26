import { activeProfile, locales, type Locale } from "../src/lib/config";
import { loadProfilePack, readContentCollection, type ContentKind } from "../src/lib/profile-loader";

const kinds: ContentKind[] = ["cases", "lab", "writing"];

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
          if (entry.data.translationStatus === "draft") {
            warnings.push(`${entry.filePath}: translationStatus is draft`);
          }
        }

        console.log(`Validated ${entries.length} ${locale}/${kind} entries`);
      }
    }

    for (const kind of kinds) {
      compareTranslations(kind, "zh", "en", contentByKind, warnings);
      compareTranslations(kind, "en", "zh", contentByKind, warnings);
    }

    const zhCases = contentByKind.get("zh:cases") || new Set<string>();
    const enCases = contentByKind.get("en:cases") || new Set<string>();
    const zhLabs = contentByKind.get("zh:lab") || new Set<string>();
    const enLabs = contentByKind.get("en:lab") || new Set<string>();

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
    }
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
