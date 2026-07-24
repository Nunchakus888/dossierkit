import { pinyin } from "pinyin-pro";

export type NoteHeading = {
  depth: number;
  id: string;
  text: string;
};

export function removeDuplicateNoteLead(html: string, summary: string) {
  const sectionLead = html.match(
    /^\s*<h2(?:\s[^>]*)?>([\s\S]*?)<\/h2>\s*<p(?:\s[^>]*)?>([\s\S]*?)<\/p>\s*/i
  );
  if (sectionLead) {
    const headingText = normalizeComparisonText(decodeEntities(sectionLead[1].replace(/<[^>]+>/g, "")));
    const paragraphText = normalizeComparisonText(decodeEntities(sectionLead[2].replace(/<[^>]+>/g, "")));
    if (
      isSummaryEquivalent(`${headingText} ${paragraphText}`, summary)
      || isSummaryEquivalent(paragraphText, summary)
    ) {
      return html.slice(sectionLead[0].length);
    }
  }

  const lead = html.match(/^\s*<p(?:\s[^>]*)?>([\s\S]*?)<\/p>\s*/i);
  if (!lead) return html;

  const leadText = normalizeComparisonText(decodeEntities(lead[1].replace(/<[^>]+>/g, "")));
  return isSummaryEquivalent(leadText, summary) ? html.slice(lead[0].length) : html;
}

function isSummaryEquivalent(content: string, summary: string) {
  const contentText = normalizeComparisonText(content);
  const summaryText = normalizeComparisonText(summary);
  const summaryStem = summaryText.replace(/[.…]+$/g, "");
  return contentText === summaryText
    || (summaryStem.length >= 24 && contentText.startsWith(summaryStem))
    || (contentText.length >= 24 && summaryText.startsWith(contentText));
}

export function decorateNoteHtml(html: string) {
  const headings: NoteHeading[] = [];
  const seen = new Map<string, number>();
  let headingIndex = 0;

  const decorated = html.replace(/<h([2-4])(?:\s[^>]*)?>([\s\S]*?)<\/h\1>/gi, (_match, level, inner) => {
    const text = decodeEntities(inner.replace(/<[^>]+>/g, "").trim());
    if (!text) return _match;

    headingIndex += 1;
    const base = headingSlug(text) || `section-${headingIndex}`;
    const count = seen.get(base) || 0;
    seen.set(base, count + 1);
    const id = count === 0 ? base : `${base}-${count + 1}`;
    const depth = Number(level);
    if (depth === 2) headings.push({ depth, id, text });

    return `<h${level} id="${id}"><a class="heading-anchor" href="#${id}" aria-label="Link to ${escapeAttribute(text)}">${inner}</a></h${level}>`;
  });

  const withDiagrams = decorated.replace(
    /<pre><code class="language-mermaid">([\s\S]*?)<\/code><\/pre>/g,
    '<div class="mermaid" data-mermaid-diagram>$1</div>'
  );

  return { html: withDiagrams, headings };
}

function normalizeComparisonText(value: string) {
  return value
    .normalize("NFKC")
    .replace(/\s+/g, " ")
    .trim();
}

function headingSlug(value: string) {
  const transliterated = value.replace(/[\u3400-\u9fff]+/g, (segment) =>
    pinyin(segment, { toneType: "none", type: "array" }).join(" ")
  );
  return transliterated
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 72)
    .replace(/-+$/g, "");
}

function decodeEntities(value: string) {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function escapeAttribute(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
