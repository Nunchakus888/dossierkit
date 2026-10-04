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

function sentenceParts(value) {
  const text = plainText(value);
  return text.match(/[^。！？!?]+[。！？!?]?/g)?.map((part) => part.trim()).filter(Boolean) || [];
}

function questionHook(title) {
  const clean = plainText(title);
  const parts = clean.split(/[：:]/).map((part) => part.trim()).filter(Boolean);
  const tail = parts.at(-1) || clean;
  return /[？?]$/.test(tail) ? tail : '';
}

export function defaultShareText({ title, summary, url }) {
  const parsed = new URL(url);
  const zh = /^\/zh(?:\/|$)/.test(parsed.pathname) || /[\u3400-\u9fff]/.test(`${title} ${summary}`);
  const cleanTitle = plainText(title);
  const summaryParts = sentenceParts(summary);
  const contrast = zh
    ? /(不等于|不是|并不|不该|关键|真正|别只|不要只|问题在于|值得)/
    : /\b(not|isn't|doesn't|rather than|instead of|the key|what matters|worth)\b/i;
  const question = questionHook(cleanTitle);

  let hook = question;
  if (!hook && summaryParts[0] && contrast.test(summaryParts[0])) hook = summaryParts[0];
  if (!hook) hook = cleanTitle || summaryParts[0] || '';

  let insight = summaryParts.find((part) => part !== hook);
  if (!insight && cleanTitle && cleanTitle !== hook) insight = cleanTitle;

  const cta = zh
    ? '把关键机制、证据边界和最容易误读的地方拆开了 ↓'
    : 'I broke down the mechanism, evidence, and the easy-to-miss caveats ↓';
  const budget = 236;
  const separatorWeight = 2; // two line breaks between blocks
  const ctaWeight = weightedUpperBound(cta);
  const hookBudget = Math.max(24, Math.min(104, budget - ctaWeight - separatorWeight));
  const hookText = shorten(hook, hookBudget);
  const used = weightedUpperBound(hookText) + ctaWeight + separatorWeight * 2;
  const insightBudget = Math.max(0, budget - used);
  const insightText = insightBudget >= 24 && insight ? shorten(insight, insightBudget) : '';

  return [hookText, insightText, cta].filter(Boolean).join('\n\n');
}

export function composePost({ title, summary, url, text: override }) {
  const parsed = new URL(url);
  if (parsed.protocol !== 'https:' || parsed.username || parsed.password) throw new Error('Invalid sharing URL.');
  const text = override ? shorten(override, 236) : defaultShareText({ title, summary, url });
  if (!text || weightedUpperBound(text) + 24 > 260) throw new Error('Invalid X draft length.');
  const intent = new URL('https://x.com/intent/tweet');
  intent.searchParams.set('text', text);
  intent.searchParams.set('url', url);
  return { text, url, fullText: `${text}\n${url}`, intentUrl: intent.toString() };
}
