import { parse, stringify } from "yaml";
import { z } from "zod";

const slugSchema = z
  .string()
  .max(72)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Use lowercase English words separated by hyphens");

export const noteRefSchema = z
  .string()
  .regex(/^(?:zh|en)\/[a-z0-9]+(?:-[a-z0-9]+)*$/, "Use a noteRef returned by get_note or save_note");

export const noteSaveInputSchema = z
  .object({
    markdown: z
      .string()
      .min(80, "The finished note must contain at least 80 characters")
      .max(500_000, "The note is too large for a single canonical document"),
    noteRef: noteRefSchema
      .optional()
      .describe("Canonical identity returned by get_note or save_note. Required when updating a note."),
    suggestedSlug: slugSchema
      .optional()
      .describe("A concise semantic path proposed by the model. Required only when creating a note."),
    topics: z
      .array(z.string().trim().min(2).max(64))
      .min(1)
      .max(8)
      .optional()
      .describe("Three to six concise topics extracted from the note for classification and search."),
    kind: z.enum(["research", "learning", "engineering"]).optional()
  })
  .strict()
  .superRefine((value, context) => {
    if (!value.noteRef && !value.suggestedSlug) {
      context.addIssue({
        code: "custom",
        path: ["suggestedSlug"],
        message: "Provide suggestedSlug for a new note or noteRef for an existing note"
      });
    }
  });

export const noteGetInputSchema = z
  .object({
    query: z.string().trim().min(2).max(160).describe("A noteRef, filename, exact title, or distinctive title phrase."),
    locale: z.enum(["zh", "en"]).optional()
  })
  .strict();

export type NoteSaveInput = z.input<typeof noteSaveInputSchema>;
type ParsedNoteSaveInput = z.output<typeof noteSaveInputSchema>;

export type ExistingNoteMetadata = {
  locale: "zh" | "en";
  title: string;
  summary: string;
  featured: boolean;
  date?: string;
  kind?: "research" | "learning" | "engineering";
  topics: string[];
  translationKey?: string;
  translationStatus?: "draft" | "machine-translated" | "reviewed" | "complete";
};

export type PreparedNote = {
  title: string;
  summary: string;
  body: string;
  locale: "zh" | "en";
  topics: string[];
  kind: NonNullable<ParsedNoteSaveInput["kind"]>;
  date: string;
  updatedAt: string;
  contentHash: string;
  featured: boolean;
  translationKey?: string;
  translationStatus: "draft" | "machine-translated" | "reviewed" | "complete";
};

const ENGLISH_STOP_WORDS = new Set([
  "a", "an", "and", "are", "as", "at", "be", "by", "for", "from", "how", "in", "into",
  "is", "it", "notes", "of", "on", "or", "research", "study", "the", "to", "using", "with"
]);

export async function prepareNote(
  input: NoteSaveInput,
  now = new Date(),
  existing?: ExistingNoteMetadata
): Promise<PreparedNote> {
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
  const topics = normalizeTopics(parsed.topics || existing?.topics || deriveTopics(title, body));
  const summary = deriveSummary(body, title, locale);
  const date = existing?.date || deriveResearchDate(normalized) || formatDate(now);
  const updatedAt = formatDate(now);
  const kind = parsed.kind || existing?.kind || "research";
  const contentHash = await sha256([
    title,
    summary,
    body,
    locale,
    kind,
    topics.join("\n")
  ].join("\n\n"));

  return {
    title,
    summary,
    body,
    locale,
    topics,
    kind,
    date,
    updatedAt,
    contentHash: `sha256:${contentHash}`,
    featured: existing?.featured || false,
    translationKey: existing?.translationKey,
    translationStatus: existing?.translationStatus || "reviewed"
  };
}

export function renderCanonicalNote(note: PreparedNote) {
  const frontmatter = {
    locale: note.locale,
    ...(note.translationKey ? { translationKey: note.translationKey } : {}),
    translationStatus: note.translationStatus,
    lastReviewedAt: note.updatedAt,
    title: note.title,
    summary: note.summary,
    featured: note.featured,
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

export function collisionSlug(baseSlug: string, title: string) {
  const suffix = stableShortHash(title);
  const prefix = baseSlug.slice(0, 72 - suffix.length - 1).replace(/-+$/g, "");
  return `${prefix}-${suffix}`;
}

export function parseCanonicalNote(source: string) {
  const match = source.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (!match) throw new Error("The canonical note has invalid frontmatter.");
  const value = parse(match[1]) as Record<string, unknown>;
  const locale = value.locale === "en" ? "en" : value.locale === "zh" ? "zh" : undefined;
  if (!locale || typeof value.title !== "string" || typeof value.summary !== "string") {
    throw new Error("The canonical note is missing locale, title, or summary metadata.");
  }
  const kind = value.kind === "learning" || value.kind === "engineering" || value.kind === "research"
    ? value.kind
    : undefined;
  const translationStatus = value.translationStatus === "draft"
    || value.translationStatus === "machine-translated"
    || value.translationStatus === "complete"
    || value.translationStatus === "reviewed"
    ? value.translationStatus
    : undefined;
  const metadata: ExistingNoteMetadata = {
    locale,
    title: value.title,
    summary: value.summary,
    featured: value.featured === true,
    ...(typeof value.date === "string" ? { date: value.date } : {}),
    ...(kind ? { kind } : {}),
    topics: Array.isArray(value.topics) ? value.topics.filter((item): item is string => typeof item === "string") : [],
    ...(typeof value.translationKey === "string" ? { translationKey: value.translationKey } : {}),
    ...(translationStatus ? { translationStatus } : {})
  };
  return {
    metadata,
    body: match[2].trim(),
    markdown: `# ${metadata.title}\n\n${match[2].trim()}\n`,
    contentHash: typeof value.contentHash === "string" ? value.contentHash : ""
  };
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
