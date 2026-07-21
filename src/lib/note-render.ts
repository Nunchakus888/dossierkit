import { pinyin } from "pinyin-pro";

export type NoteHeading = {
  depth: number;
  id: string;
  text: string;
};

export function decorateNoteHtml(html: string) {
  const headings: NoteHeading[] = [];
  const seen = new Map<string, number>();
  let headingIndex = 0;

  const decorated = html.replace(/<h([2-4])>([\s\S]*?)<\/h\1>/g, (_match, level, inner) => {
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

  return { html: decorated, headings };
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
