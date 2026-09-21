/** Inspect actual rendered counter elements, not selectors inside bundled scripts. */
export function inspectViewMarkup(html) {
  const markup = html.replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, '')
    .replace(/<!--[\s\S]*?-->/g, '');
  return {
    configured: /<span\b[^>]*\sdata-view-counter-config(?=[\s=>])/i.test(markup),
    refs: [...markup.matchAll(/<span\b[^>]*\sdata-view-count=(["'])(.*?)\1/gi)].map((match) => match[2])
  };
}
