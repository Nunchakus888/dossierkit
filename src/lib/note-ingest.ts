import { pinyin } from "pinyin-pro";
import { stringify } from "yaml";
import { z } from "zod";

export const noteSaveInputSchema = z.object({
  markdown: z
    .string()
    .min(80, "The finished note must contain at least 80 characters")
    .max(500_000, "The note is too large for a single canonical document"),
  topics: z
    .array(z.string().trim().min(2).max(64))
    .min(1)
    .max(8)
    .optional()
    .describe("Three to six concise topics extracted from the note for classification and search."),
  kind: z.enum(["research", "learning", "engineering"]).default("research")
}).strict();

export type NoteSaveInput = z.input<typeof noteSaveInputSchema>;
type ParsedNoteSaveInput = z.output<typeof noteSaveInputSchema>;

export type PreparedNote = {
  title: string;
  summary: string;
  body: string;
  locale: "zh" | "en";
  topics: string[];
  kind: ParsedNoteSaveInput["kind"];
  date: string;
  updatedAt: string;
  contentHash: string;
  baseSlug: string;
};

const ENGLISH_STOP_WORDS = new Set([
  "a", "an", "and", "are", "as", "at", "be", "by", "for", "from", "how", "in", "into",
  "is", "it", "notes", "of", "on", "or", "research", "study", "the", "to", "using", "with"
]);

const PINYIN_STOP_WORDS = new Set([
  "de", "yu", "he", "ji", "yi", "jiu", "jiu", "ru", "he", "cong", "dao", "zai", "dui", "ji",
  "gou", "jian", "shen", "du", "xue", "xi", "bi", "ji", "yan", "jiu", "ji", "shu"
]);

export async function prepareNote(input: NoteSaveInput, now = new Date()): Promise<PreparedNote> {
  const parsed = noteSaveInputSchema.parse(input);
  const normalized = normalizeMarkdown(parsed.markdown);
  assertSafeMarkdown(normalized);
  const titleMatch = normalized.match(/^#\s+(.+)$/m);

  if (!titleMatch) {
    throw new Error("The note must contain one level-one Markdown heading used as its canonical title.");
  }

  const h1Count = (normalized.match(/^#\s+.+$/gm) || []).length;
  if (h1Count !== 1) {
    throw new Error("The note must contain exactly one level-one heading; use level two or lower for sections.");
  }

  const title = cleanInlineMarkdown(titleMatch[1]);
  const body = normalized.replace(titleMatch[0], "").trim();
  const locale = detectLocale(`${title}\n${body}`);
  const topics = normalizeTopics(parsed.topics || deriveTopics(title, body));
  const summary = deriveSummary(body, title, locale);
  const date = deriveResearchDate(normalized) || formatDate(now);
  const updatedAt = formatDate(now);
  const baseSlug = deriveNaturalSlug(title);
  const contentHash = await sha256([
    title,
    summary,
    body,
    locale,
    parsed.kind,
    topics.join("\n")
  ].join("\n\n"));

  return {
    title,
    summary,
    body,
    locale,
    topics,
    kind: parsed.kind,
    date,
    updatedAt,
    contentHash: `sha256:${contentHash}`,
    baseSlug
  };
}

export function renderCanonicalNote(note: PreparedNote, slug = note.baseSlug) {
  const frontmatter = {
    slug,
    locale: note.locale,
    translationStatus: "reviewed",
    lastReviewedAt: note.updatedAt,
    title: note.title,
    summary: note.summary,
    featured: false,
    date: note.date,
    updatedAt: note.updatedAt,
    kind: note.kind,
    topics: note.topics,
    tags: note.topics,
    contentHash: note.contentHash
  };

  const yaml = stringify(frontmatter, {
    aliasDuplicateObjects: false,
    defaultKeyType: "PLAIN",
    defaultStringType: "QUOTE_DOUBLE"
  });
  return `---\n${yaml.trim()}\n---\n\n${note.body.trim()}\n`;
}

export function deriveNaturalSlug(title: string) {
  const preferred = extractTitleSlugTokens(title);

  const tokens = [...preferred];
  if (tokens.length === 0) {
    const pinyinTokens = pinyin(title, { toneType: "none", type: "array" })
      .map((token) => token.toLowerCase().replace(/[^a-z0-9]+/g, ""))
      .filter((token) => token.length > 1 && !PINYIN_STOP_WORDS.has(token));
    tokens.push(...pinyinTokens);
  }

  const selected = unique(tokens).slice(0, 6);
  let slug = selected.join("-").replace(/-+/g, "-").replace(/^-|-$/g, "");
  while (slug.length > 72 && selected.length > 3) {
    selected.pop();
    slug = selected.join("-");
  }

  slug = slug.slice(0, 72).replace(/-+$/g, "");
  if (!slug) {
    slug = `note-${stableShortHash(title)}`;
  }

  return slug;
}

const TITLE_CONCEPTS: Array<{ pattern: RegExp; tokens: string[] }> = [
  { pattern: /智能体/g, tokens: ["agent"] },
  { pattern: /架构/g, tokens: ["architecture"] },
  { pattern: /平台/g, tokens: ["platform"] },
  { pattern: /评测|评估/g, tokens: ["evaluation"] },
  { pattern: /动作/g, tokens: ["action"] },
  { pattern: /治理/g, tokens: ["governance"] },
  { pattern: /记忆/g, tokens: ["memory"] },
  { pattern: /上下文/g, tokens: ["context"] },
  { pattern: /检索/g, tokens: ["retrieval"] },
  { pattern: /工作流/g, tokens: ["workflow"] },
  { pattern: /可观测/g, tokens: ["observability"] },
  { pattern: /安全/g, tokens: ["security"] },
  { pattern: /工具/g, tokens: ["tools"] },
  { pattern: /模型/g, tokens: ["model"] },
  { pattern: /数据/g, tokens: ["data"] },
  { pattern: /笔记/g, tokens: ["notes"] },
  { pattern: /归档|发布/g, tokens: ["publishing"] }
];

function extractTitleSlugTokens(title: string) {
  const matches: Array<{ index: number; tokens: string[] }> = [];
  for (const match of title.matchAll(/[A-Za-z][A-Za-z0-9+]*/g)) {
    const token = match[0].toLowerCase();
    if (!ENGLISH_STOP_WORDS.has(token)) matches.push({ index: match.index, tokens: [token] });
  }
  for (const concept of TITLE_CONCEPTS) {
    for (const match of title.matchAll(concept.pattern)) {
      matches.push({ index: match.index, tokens: concept.tokens });
    }
  }
  return unique(matches.sort((left, right) => left.index - right.index).flatMap((match) => match.tokens));
}

export function collisionSlug(baseSlug: string, title: string) {
  const suffix = stableShortHash(title);
  const prefix = baseSlug.slice(0, 72 - suffix.length - 1).replace(/-+$/g, "");
  return `${prefix}-${suffix}`;
}

export function extractExistingNoteIdentity(source: string) {
  const title = source.match(/^title:\s*["']?(.+?)["']?\s*$/m)?.[1]?.replace(/["']$/, "") || "";
  const contentHash = source.match(/^contentHash:\s*["']?(sha256:[a-f0-9]{64})["']?\s*$/m)?.[1] || "";
  return { title, contentHash };
}

function normalizeMarkdown(value: string) {
  const normalized = value.replace(/\r\n?/g, "\n").trim();
  if (!normalized.startsWith("---\n")) return normalized;
  return normalized.replace(/^---\n[\s\S]*?\n---\n?/, "").trim();
}

function assertSafeMarkdown(value: string) {
  const unsafeHtml = /<(?:script|style|iframe|object|embed|base|form)\b/i;
  const unsafeAttribute = /\bon[a-z]+\s*=|javascript\s*:/i;
  if (unsafeHtml.test(value) || unsafeAttribute.test(value)) {
    throw new Error("The note contains executable HTML or an unsafe URL scheme.");
  }
}

function deriveTopics(title: string, body: string) {
  const headings = Array.from(body.matchAll(/^#{2,4}\s+(.+)$/gm), (match) => cleanInlineMarkdown(match[1]));
  const technical = unique([
    ...extractTechnicalPhrases(title),
    ...headings.flatMap(extractTechnicalPhrases)
  ]);
  return technical.slice(0, 6);
}

function normalizeTopics(values: string[]) {
  return unique(values.map((value) => cleanInlineMarkdown(value).trim()).filter(Boolean)).slice(0, 8);
}

function extractTechnicalPhrases(value: string) {
  const phrases = value.match(/[A-Za-z][A-Za-z0-9]*(?:[ .+\/-][A-Za-z0-9][A-Za-z0-9+]*)*/g) || [];
  return phrases
    .map((phrase) => phrase.trim().replace(/[./]+$/g, ""))
    .filter((phrase) => phrase.length >= 2 && !ENGLISH_STOP_WORDS.has(phrase.toLowerCase()));
}

function extractEnglishTokens(value: string) {
  return (value.match(/[A-Za-z][A-Za-z0-9+]*/g) || [])
    .map((token) => token.toLowerCase())
    .filter((token) => token.length >= 2);
}

function deriveSummary(body: string, title: string, locale: "zh" | "en") {
  const blocks = body.split(/\n\s*\n/);
  for (const block of blocks) {
    const compact = block
      .replace(/^>\s?/gm, "")
      .replace(/^#{1,6}\s+/gm, "")
      .replace(/^[-*+]\s+/gm, "")
      .replace(/```[\s\S]*?```/g, "")
      .trim();
    if (!compact || compact.startsWith("|") || compact.startsWith("[")) continue;
    const cleaned = cleanInlineMarkdown(compact).replace(/\s+/g, " ");
    if (cleaned.length >= 28 && !/^研究日期[:：]/.test(cleaned)) {
      return truncate(cleaned, locale === "zh" ? 110 : 180);
    }
  }
  return locale === "zh" ? `${title}的结构化研究与工程笔记。` : `Structured research and engineering notes on ${title}.`;
}

function deriveResearchDate(markdown: string) {
  return markdown.match(/(?:研究日期|Research date)[:：]\s*(\d{4}-\d{2}-\d{2})/i)?.[1];
}

function detectLocale(value: string): "zh" | "en" {
  const han = (value.match(/[\u3400-\u9fff]/g) || []).length;
  const latin = (value.match(/[A-Za-z]/g) || []).length;
  return han >= Math.max(8, latin * 0.15) ? "zh" : "en";
}

function cleanInlineMarkdown(value: string) {
  return value
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/[*_`~]/g, "")
    .trim();
}

function truncate(value: string, max: number) {
  if (value.length <= max) return value;
  return `${value.slice(0, max).replace(/[，。；,:;\s]+$/g, "")}…`;
}

function formatDate(value: Date) {
  return value.toISOString().slice(0, 10);
}

function unique<T>(values: T[]) {
  return [...new Set(values)];
}

function stableShortHash(value: string) {
  let hash = 0x811c9dc5;
  for (const char of value.normalize("NFKC").toLowerCase()) {
    hash ^= char.codePointAt(0) || 0;
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(36).padStart(7, "0").slice(0, 7);
}

async function sha256(value: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}
