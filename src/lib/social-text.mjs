/** Dependency-free, conservative X text budgeting. Emoji sequences may be overcounted, never truncated mid-grapheme. */
export function plainText(value) {
  return String(value || '').normalize('NFC')
    .replace(/```[\s\S]*?```/g, '')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/https?:\/\/\S+/g, '')
    .replace(/<[^>]*>/g, '')
    .replace(/[\u0000-\u001f\u007f\u200b\u202a-\u202e\u2066-\u2069]/g, ' ')
    .replace(/\[(?:事实|推断)\]/g, '').replace(/[*#`]/g, '')
    .replace(/@/g, '＠').replace(/\s+/g, ' ').trim();
}

// X's single-weight ranges; other code points count as two. Joined emoji are deliberately overcounted.
export function weightedUpperBound(value) {
  return [...value.normalize('NFC')].reduce((total, ch) => {
    const n = ch.codePointAt(0);
    return total + (n <= 0x10ff || (n >= 0x2000 && n <= 0x200d)
      || (n >= 0x2010 && n <= 0x201f) || (n >= 0x2032 && n <= 0x2037) ? 1 : 2);
  }, 0);
}

export function shorten(value, budget) {
  const text = plainText(value);
  if (weightedUpperBound(text) <= budget) return text;
  let result = '';
  for (const { segment } of new Intl.Segmenter(undefined, { granularity: 'grapheme' }).segment(text)) {
    if (weightedUpperBound(result + segment) > budget - 2) break;
    result += segment;
  }
  return result.trimEnd() + '…';
}

export function canonicalArticleUrl(origin, noteRef) {
  const base = new URL(origin);
  if (base.protocol !== 'https:' || base.username || base.password || base.pathname !== '/'
    || base.search || base.hash) throw new Error('A bare HTTPS production origin is required.');
  if (!/^(zh|en)\/[a-z0-9]+(?:-[a-z0-9]+)*$/.test(noteRef)) throw new Error('Invalid noteRef.');
  const [locale, key] = noteRef.split('/');
  return `${base.origin}/${locale}/notes/${key}`;
}

export function composePost({ title, summary, url, text: override }) {
  const parsed = new URL(url);
  if (parsed.protocol !== 'https:' || parsed.username || parsed.password) throw new Error('Invalid sharing URL.');
  const heading = shorten(title, 132);
  const text = override ? shorten(override, 236)
    : [heading, shorten(summary, Math.max(0, 234 - weightedUpperBound(heading)))].filter(Boolean).join('\n');
  if (!text || weightedUpperBound(text) + 24 > 260) throw new Error('Invalid X draft length.');
  const intent = new URL('https://x.com/intent/tweet');
  intent.searchParams.set('text', text);
  intent.searchParams.set('url', url);
  return { text, url, fullText: `${text}\n${url}`, intentUrl: intent.toString() };
}
