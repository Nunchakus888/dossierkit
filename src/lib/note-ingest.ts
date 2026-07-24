import { pinyin } from "pinyin-pro";
import sanitizeHtml from "sanitize-html";
import { parse, stringify } from "yaml";
import { z } from "zod";
import { findPublicContentViolation } from "./content-policy";

export type NoteFormat = "markdown" | "html";

export const noteRefSchema = z
  .string()
  .regex(/^(?:zh|en)\/[a-z0-9]+(?:-[a-z0-9]+)*$/, "Use a noteRef returned by get_note or save_note");

export const noteSaveInputSchema = z
  .object({
    markdown: z
      .string()
      .min(80, "The finished note must contain at least 80 characters")
      .max(500_000, "The note is too large for a single canonical document")
      .optional()
      .describe("Finished Markdown with exactly one H1. Provide either markdown or html, never both."),
    html: z
      .string()
      .min(80, "The finished HTML note must contain at least 80 characters")
      .max(500_000, "The HTML note is too large for a single canonical document")
      .optional()
      .describe("Finished semantic HTML with exactly one H1. Active content and inline styles are rejected."),
    noteRef: noteRefSchema
      .optional()
      .describe("Canonical identity returned by get_note or save_note. Required when updating a note."),
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
    if (Boolean(value.markdown) === Boolean(value.html)) {
      context.addIssue({
        code: "custom",
        path: ["markdown"],
        message: "Provide exactly one of markdown or html"
      });
    }
  });

export const noteGetInputSchema = z
  .object({
    query: z.string().trim().min(2).max(160).describe("A noteRef, filename, exact title, or distinctive title phrase."),
    locale: z.enum(["zh", "en"]).optional()
  })
  .strict();

export const noteDeleteInputSchema = z
  .object({
    noteRef: noteRefSchema.describe("Exact canonical identity returned by get_note."),
    contentHash: z
      .string()
      .regex(/^sha256:[a-f0-9]{64}$/)
      .describe("Current contentHash returned by get_note. Deletion fails if the note changed after it was read.")
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
  format: NoteFormat;
  title: string;
  summary: string;
  body: string;
  text: string;
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
  const content = parsed.markdown
    ? prepareMarkdownContent(parsed.markdown)
    : prepareHtmlContent(parsed.html as string);
  const locale = detectLocale(`${content.title}\n${content.text}`);
  const topics = normalizeTopics(
    parsed.topics
    || existing?.topics
    || deriveTopics(content.title, content.text, content.headings)
  );
  const summary = deriveSummary(content.text, content.title, locale);
  const wordingViolation = findPublicContentViolation(
    "notes",
    `${content.title}\n${summary}\n${content.text}`
  );
  if (wordingViolation) {
    throw new Error(`The note contains unfinished public wording matching ${wordingViolation}.`);
  }
  const date = existing?.date || deriveResearchDate(content.text) || formatDate(now);
  const updatedAt = formatDate(now);
  const kind = parsed.kind || existing?.kind || "research";
  const contentHash = await computeCanonicalContentHash({
    title: content.title,
    summary,
    body: content.body,
    locale,
    kind,
    topics
  });

  return {
    format: content.format,
    title: content.title,
    summary,
    body: content.body,
    text: content.text,
    locale,
    topics,
    kind,
    date,
    updatedAt,
    contentHash,
    featured: existing?.featured || false,
    translationKey: existing?.translationKey,
    translationStatus: existing?.translationStatus || "reviewed"
  };
}

export async function computeCanonicalContentHash(note: {
  title: string;
  summary: string;
  body: string;
  locale: "zh" | "en";
  kind: "research" | "learning" | "engineering";
  topics: string[];
}) {
  const contentHash = await sha256([
    note.title,
    note.summary,
    note.body,
    note.locale,
    note.kind,
    note.topics.join("\n")
  ].join("\n\n"));
  return `sha256:${contentHash}`;
}

export function renderCanonicalNote(note: PreparedNote) {
  if (note.format === "html") return renderCanonicalHtmlNote(note);

  const frontmatter = canonicalMetadata(note);
  const yaml = stringify(frontmatter, {
    aliasDuplicateObjects: false,
    defaultKeyType: "PLAIN",
    defaultStringType: "QUOTE_DOUBLE"
  });
  return `---\n${yaml.trim()}\n---\n\n${note.body.trim()}\n`;
}

function canonicalMetadata(note: PreparedNote) {
  return {
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
}

function renderCanonicalHtmlNote(note: PreparedNote) {
  const metadata = { ...canonicalMetadata(note), format: "html" };
  const metadataJson = JSON.stringify(metadata).replace(/</g, "\\u003c");
  return `<!doctype html>
<html lang="${note.locale}">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="description" content="${escapeHtmlAttribute(note.summary)}">
  <title>${escapeHtml(note.title)}</title>
  <script type="application/json" id="dossierkit-note-metadata">${metadataJson}</script>
  <style>
    body { max-width: 800px; margin: 48px auto; padding: 0 24px; color: #13231c; font: 17px/1.7 system-ui, sans-serif; }
    img, table, pre { max-width: 100%; } pre { overflow: auto; padding: 16px; background: #f4f7f5; }
    table { border-collapse: collapse; } th, td { border: 1px solid #d9e2dd; padding: 8px 10px; text-align: left; }
  </style>
</head>
<body>
  <article data-dossierkit-note-body>
    <h1>${escapeHtml(note.title)}</h1>
${indentHtml(note.body.trim(), 4)}
  </article>
</body>
</html>
`;
}

export function collisionSlug(baseSlug: string, title: string) {
  const suffix = stableShortHash(title);
  const prefix = baseSlug.slice(0, 72 - suffix.length - 1).replace(/-+$/g, "");
  return `${prefix}-${suffix}`;
}

export function deriveCanonicalNoteKey(note: Pick<PreparedNote, "title" | "topics">) {
  const hasHanTitle = /[\u3400-\u9fff]/.test(note.title);
  const semanticTopics = note.topics
    .filter((topic) => /[A-Za-z]/.test(topic))
    .map(asciiSlug)
    .filter(Boolean);
  const candidate = hasHanTitle && semanticTopics.length > 0
    ? semanticTopics.join("-")
    : transliteratedSlug(note.title);
  return trimSlug(candidate) || `note-${stableShortHash(note.title)}`;
}

export function parseCanonicalNote(source: string) {
  if (/^\s*<!doctype html>/i.test(source) || source.includes('id="dossierkit-note-metadata"')) {
    return parseCanonicalHtmlNote(source);
  }

  const match = source.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (!match) throw new Error("The canonical note has invalid frontmatter.");
  const value = parse(match[1]) as Record<string, unknown>;
  const metadata = parseExistingMetadata(value);
  const body = match[2].trim();
  return {
    format: "markdown" as const,
    data: value,
    metadata,
    body,
    text: body,
    markdown: `# ${metadata.title}\n\n${body}\n`,
    contentHash: typeof value.contentHash === "string" ? value.contentHash : ""
  };
}

function parseCanonicalHtmlNote(source: string) {
  const metadataMatch = source.match(
    /<script\s+type="application\/json"\s+id="dossierkit-note-metadata">([\s\S]*?)<\/script>/i
  );
  if (!metadataMatch) throw new Error("The canonical HTML note is missing DossierKit metadata.");
  const value = JSON.parse(metadataMatch[1]) as Record<string, unknown>;
  if (value.format !== "html") throw new Error("The canonical HTML note has an invalid format marker.");
  const metadata = parseExistingMetadata(value);
  const content = prepareHtmlContent(source);
  if (normalizeTitle(content.title) !== normalizeTitle(metadata.title)) {
    throw new Error("The canonical HTML note H1 does not match its metadata title.");
  }
  return {
    format: "html" as const,
    data: value,
    metadata,
    body: content.body,
    text: content.text,
    html: `${source.trim()}\n`,
    contentHash: typeof value.contentHash === "string" ? value.contentHash : ""
  };
}

function parseExistingMetadata(value: Record<string, unknown>): ExistingNoteMetadata {
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
  return {
    locale,
    title: value.title,
    summary: value.summary,
    featured: value.featured === true,
    ...(typeof value.date === "string" ? { date: value.date } : {}),
    ...(kind ? { kind } : {}),
    topics: Array.isArray(value.topics)
      ? value.topics.filter((item): item is string => typeof item === "string")
      : [],
    ...(typeof value.translationKey === "string" ? { translationKey: value.translationKey } : {}),
    ...(translationStatus ? { translationStatus } : {})
  };
}

function normalizeMarkdown(value: string) {
  const normalized = value.replace(/\r\n?/g, "\n").trim();
  if (!normalized.startsWith("---\n")) return normalized;
  return normalized.replace(/^---\n[\s\S]*?\n---\n?/, "").trim();
}

function prepareMarkdownContent(value: string) {
  const normalized = normalizeMarkdown(value);
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
  const headings = Array.from(
    body.matchAll(/^#{2,4}\s+(.+)$/gm),
    (match) => cleanInlineMarkdown(match[1])
  );
  return { format: "markdown" as const, title, body, text: body, headings };
}

function prepareHtmlContent(value: string) {
  const normalized = value.replace(/\r\n?/g, "\n").trim();
  const documentBody = normalized.match(/<body\b[^>]*>([\s\S]*?)<\/body>/i)?.[1] || normalized;
  const canonicalArticle = documentBody.match(
    /<article\b[^>]*\bdata-dossierkit-note-body(?:=(?:"[^"]*"|'[^']*'|[^\s>]+))?[^>]*>([\s\S]*?)<\/article>/i
  );
  const fragment = (canonicalArticle?.[1] || documentBody).trim();
  assertSafeHtml(fragment);
  const sanitized = sanitizeNoteHtml(fragment);
  const h1Matches = Array.from(sanitized.matchAll(/<h1\b[^>]*>([\s\S]*?)<\/h1>/gi));
  if (h1Matches.length !== 1) {
    throw new Error("The HTML note must contain exactly one H1 used as its canonical title.");
  }

  const title = htmlToText(h1Matches[0][1]).trim();
  if (!title) throw new Error("The HTML note H1 must contain a readable title.");
  const body = sanitized.replace(h1Matches[0][0], "").trim();
  const text = htmlToText(body);
  const headings = Array.from(
    body.matchAll(/<h[2-4]\b[^>]*>([\s\S]*?)<\/h[2-4]>/gi),
    (match) => htmlToText(match[1]).trim()
  ).filter(Boolean);
  return { format: "html" as const, title, body, text, headings };
}

function assertSafeMarkdown(value: string) {
  const unsafeHtml = /<(?:script|style|iframe|object|embed|base|form)\b/i;
  const unsafeAttribute = /\bon[a-z]+\s*=|javascript\s*:/i;
  if (unsafeHtml.test(value) || unsafeAttribute.test(value)) {
    throw new Error("The note contains executable HTML or an unsafe URL scheme.");
  }
}

function assertSafeHtml(value: string) {
  const activeContent = /<(?:script|style|iframe|object|embed|base|form|input|button|textarea|select|option|link|meta)\b/i;
  const unsafeAttribute = /\s(?:on[a-z]+|style)\s*=|javascript\s*:|data\s*:\s*text\/html/i;
  if (activeContent.test(value) || unsafeAttribute.test(value)) {
    throw new Error("The HTML note contains active content, inline styles, form controls, or an unsafe URL scheme.");
  }
}

function sanitizeNoteHtml(value: string) {
  return sanitizeHtml(value, {
    allowedTags: [
      "article", "section", "header", "footer", "h1", "h2", "h3", "h4", "h5", "h6",
      "p", "br", "hr", "blockquote", "pre", "code", "kbd", "samp", "strong", "em", "b", "i",
      "u", "s", "del", "ins", "mark", "small", "sub", "sup", "ul", "ol", "li", "dl", "dt",
      "dd", "table", "thead", "tbody", "tfoot", "tr", "th", "td", "caption", "figure",
      "figcaption", "details", "summary", "a", "img"
    ],
    allowedAttributes: {
      a: ["href", "title", "target", "rel"],
      img: ["src", "alt", "title", "width", "height", "loading"],
      code: ["class"],
      pre: ["class"],
      th: ["colspan", "rowspan", "scope"],
      td: ["colspan", "rowspan"]
    },
    allowedClasses: {
      code: ["language-*"],
      pre: ["language-*"]
    },
    allowedSchemes: ["http", "https", "mailto"],
    allowedSchemesByTag: {
      img: ["http", "https"]
    },
    allowProtocolRelative: false,
    transformTags: {
      a: (_tagName, attributes) => ({
        tagName: "a",
        attribs: {
          ...attributes,
          ...(attributes.target === "_blank" ? { rel: "noopener noreferrer" } : {})
        }
      }),
      img: (_tagName, attributes) => ({
        tagName: "img",
        attribs: { ...attributes, loading: attributes.loading || "lazy" }
      })
    }
  }).trim();
}

function deriveTopics(title: string, body: string, headings: string[] = []) {
  const candidates = headings.length > 0
    ? headings
    : Array.from(body.matchAll(/^#{2,4}\s+(.+)$/gm), (match) => cleanInlineMarkdown(match[1]));
  const technical = unique([
    ...extractTechnicalPhrases(title),
    ...candidates.flatMap(extractTechnicalPhrases)
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

function transliteratedSlug(value: string) {
  const transliterated = value.replace(/[\u3400-\u9fff]+/g, (segment) =>
    pinyin(segment, { toneType: "none", type: "array" }).join(" ")
  );
  return asciiSlug(transliterated);
}

function asciiSlug(value: string) {
  return value
    .normalize("NFKD")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function trimSlug(value: string) {
  return value
    .slice(0, 72)
    .replace(/-+$/g, "");
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

function htmlToText(value: string) {
  const withBreaks = value
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(?:p|div|section|article|header|footer|blockquote|pre|li|dt|dd|tr|h[1-6])\s*>/gi, "\n\n");
  return sanitizeHtml(withBreaks, { allowedTags: [], allowedAttributes: {} })
    .replace(/\u00a0/g, " ")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n[ \t]+/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function escapeHtmlAttribute(value: string) {
  return escapeHtml(value).replace(/\r?\n/g, " ");
}

function indentHtml(value: string, spaces: number) {
  const prefix = " ".repeat(spaces);
  return value.split("\n").map((line) => `${prefix}${line}`).join("\n");
}

function normalizeTitle(value: string) {
  return value.normalize("NFKC").toLowerCase().replace(/\s+/g, " ").trim();
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
