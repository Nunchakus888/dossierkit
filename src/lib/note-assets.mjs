// A deliberately small static SVG dialect; shared by MCP and the build.
// No browser DOM, file system, remote resources, or model calls.
export const ASSET_NAME = /^[a-z][a-z0-9-]{0,47}\.svg$/;
export const ASSET_LIMIT = 8;
export const SVG_LIMIT = 100_000;
export const ASSETS_LIMIT = 400_000;
const tags = new Set(['svg', 'g', 'defs', 'title', 'desc', 'rect', 'circle', 'ellipse', 'line', 'polyline', 'polygon', 'path', 'text', 'tspan', 'linearGradient', 'radialGradient', 'stop', 'marker', 'clipPath']);
const common = new Set(['id', 'fill', 'stroke', 'stroke-width', 'stroke-linecap', 'stroke-linejoin', 'stroke-dasharray', 'stroke-dashoffset', 'opacity', 'fill-opacity', 'stroke-opacity', 'fill-rule', 'clip-rule', 'transform', 'clip-path', 'marker-start', 'marker-mid', 'marker-end']);
const specific = {
  svg: ['xmlns', 'width', 'height', 'viewBox', 'preserveAspectRatio'],
  rect: ['x', 'y', 'width', 'height', 'rx', 'ry'], circle: ['cx', 'cy', 'r'],
  ellipse: ['cx', 'cy', 'rx', 'ry'], line: ['x1', 'x2', 'y1', 'y2'],
  polyline: ['points'], polygon: ['points'], path: ['d'],
  text: ['x', 'y', 'dx', 'dy', 'font-size', 'font-family', 'font-weight', 'text-anchor', 'dominant-baseline', 'letter-spacing'],
  tspan: ['x', 'y', 'dx', 'dy', 'font-size', 'font-family', 'font-weight', 'text-anchor', 'dominant-baseline', 'letter-spacing'],
  linearGradient: ['x1', 'x2', 'y1', 'y2', 'gradientUnits', 'gradientTransform'],
  radialGradient: ['cx', 'cy', 'r', 'fx', 'fy', 'gradientUnits', 'gradientTransform'],
  stop: ['offset', 'stop-color', 'stop-opacity'],
  marker: ['viewBox', 'markerWidth', 'markerHeight', 'refX', 'refY', 'orient', 'markerUnits'],
  clipPath: ['clipPathUnits']
};
const enums = {
  'stroke-linecap': /^(butt|round|square)$/, 'stroke-linejoin': /^(miter|round|bevel)$/,
  'fill-rule': /^(nonzero|evenodd)$/, 'clip-rule': /^(nonzero|evenodd)$/,
  'text-anchor': /^(start|middle|end)$/, 'dominant-baseline': /^(auto|alphabetic|middle|central|hanging|text-before-edge|text-after-edge)$/,
  'gradientUnits': /^(userSpaceOnUse|objectBoundingBox)$/, 'clipPathUnits': /^(userSpaceOnUse|objectBoundingBox)$/,
  'markerUnits': /^(userSpaceOnUse|strokeWidth)$/, 'font-weight': /^(normal|bold|[1-9]00)$/,
  'preserveAspectRatio': /^(none|x(Min|Mid|Max)Y(Min|Mid|Max)( (meet|slice))?)$/
};
const numeric = new Set(['x','y','x1','y1','x2','y2','dx','dy','cx','cy','r','rx','ry','fx','fy','width','height','stroke-width','stroke-dashoffset','font-size','letter-spacing','offset','opacity','fill-opacity','stroke-opacity','stop-opacity','markerWidth','markerHeight','refX','refY']);
const byteLength = (value) => new TextEncoder().encode(value).length;
function fail(message) { throw new Error(`Invalid note asset: ${message}`); }
export function assertAssetName(name) { if (!ASSET_NAME.test(name)) fail('use a flat lowercase name such as cover.svg or architecture.svg.'); return name; }
export function assetDirectory(profile, noteRef) {
  if (!/^[a-zA-Z0-9_-]+$/.test(profile) || !/^(zh|en)\/[a-z0-9]+(?:-[a-z0-9]+)*$/.test(noteRef)) fail('invalid note identity.');
  return `profiles/${profile}/assets/notes/${noteRef}`;
}
export function assetPublicPrefix(profile, noteRef) {
  assetDirectory(profile, noteRef);
  return `/profile-assets/${profile}/notes/${noteRef}/`;
}
function decodeEntities(text) {
  return text.replace(/&([^;\s]+);/g, (_, entity) => {
    const named = { amp:'&', lt:'<', gt:'>', quot:'"', apos:"'" };
    if (Object.hasOwn(named, entity)) return named[entity];
    if (!/^#(?:[0-9]+|x[0-9a-fA-F]+)$/.test(entity)) fail('only built-in XML entities are allowed.');
    const n = entity[1] === 'x' ? parseInt(entity.slice(2), 16) : Number(entity.slice(1));
    if (!Number.isSafeInteger(n) || n < 32 || n > 0x10ffff || (n >= 0xd800 && n <= 0xdfff)) fail('invalid character entity.');
    return String.fromCodePoint(n);
  });
}
function checkXmlText(text) {
  if (/&(?!amp;|lt;|gt;|quot;|apos;|#\d+;|#x[\da-fA-F]+;)/.test(text) || /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(text)) fail('invalid XML text.');
  decodeEntities(text);
}
function numbers(value) {
  if (!/^[+\-\d.eE,%\s]+$/.test(value)) fail('invalid numeric attribute.');
  const parts = value.trim().split(/[\s,]+/);
  if (!parts.length || parts.some((part) => !/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?%?$/.test(part) || !Number.isFinite(parseFloat(part)) || Math.abs(parseFloat(part)) > 100_000)) fail('numeric attribute is out of bounds.');
  return parts.map(parseFloat);
}
function color(value) { return /^(none|transparent|currentColor|[a-zA-Z]{1,24}|#[\da-fA-F]{3,8}|rgba?\([\d.,%\s]+\))$/.test(value); }
export function validateSvg(source, name = 'diagram.svg') {
  assertAssetName(name);
  if (typeof source !== 'string' || !source.trim() || byteLength(source) > SVG_LIMIT) fail(`${name} exceeds ${SVG_LIMIT} bytes or is empty.`);
  const svg = source.replace(/\r\n?/g, '\n').trim();
  if (/<!|<\?|\u0000/.test(svg)) fail('XML declarations, comments, entities and CDATA are not supported.');
  const stack = [], ids = new Map(), refs = [];
  let cursor = 0, count = 0, roots = 0, root, title = '', titleCount = 0;
  const token = /<\/?[A-Za-z][^<>]*>/g;
  for (const match of svg.matchAll(token)) {
    const text = svg.slice(cursor, match.index);
    if (text.includes('<') || text.includes('>') || (text.trim() && !['text', 'tspan', 'title', 'desc'].includes(stack.at(-1)))) fail('malformed or unsupported XML text.');
    checkXmlText(text);
    if (stack.at(-1) === 'title' && stack.length === 2) title += decodeEntities(text);
    cursor = match.index + match[0].length;
    const closing = /^<\/([A-Za-z]+)\s*>$/.exec(match[0]);
    if (closing) { if (stack.pop() !== closing[1]) fail('unbalanced tags.'); continue; }
    const opening = /^<([A-Za-z]+)((?:\s[^<>]*)?)\s*(\/?)>$/.exec(match[0]);
    if (!opening || !tags.has(opening[1])) fail('unsupported SVG element.');
    const tag = opening[1];
    if (tag === 'title' && stack.length === 1) titleCount++;
    if (++count > 1000 || stack.length > 24) fail('too many elements or excessive nesting.');
    if (!stack.length) { if (tag !== 'svg' || ++roots !== 1) fail('exactly one SVG root is required.'); }
    else if (tag === 'svg' || ['title', 'desc', 'stop', 'path', 'rect', 'circle', 'ellipse', 'line', 'polyline', 'polygon'].includes(stack.at(-1))) fail('invalid nested element.');
    const attrs = Object.create(null);
    let raw = opening[2].replace(/\/\s*$/, ''), offset = 0;
    const attr = /\s+([A-Za-z][\w:-]*)\s*=\s*("[^"]*"|'[^']*')/g;
    for (const a of raw.matchAll(attr)) {
      if (raw.slice(offset, a.index).trim()) fail('attributes must be quoted.');
      offset = a.index + a[0].length;
      const key = a[1], encoded = a[2].slice(1, -1);
      checkXmlText(encoded);
      const value = decodeEntities(encoded);
      if (Object.hasOwn(attrs, key) || (!common.has(key) && !(specific[tag] || []).includes(key))) fail(`unsupported or duplicate attribute ${key}.`);
      if (value.includes('<') || /[\u0000-\u001f]/.test(value)) fail('invalid attribute value.');
      attrs[key] = value;
      if (key === 'id') { if (!/^[a-zA-Z][\w-]{0,63}$/.test(value) || ids.has(value)) fail('invalid or duplicate ID.'); ids.set(value, tag); }
      else if (key === 'xmlns') { if (tag !== 'svg' || value !== 'http://www.w3.org/2000/svg') fail('unexpected namespace.'); }
      else if (['fill', 'stroke', 'stop-color', 'clip-path', 'marker-start', 'marker-mid', 'marker-end'].includes(key)) {
        const ref = /^url\(#([a-zA-Z][\w-]{0,63})\)$/.exec(value);
        if (ref) {
          if (stack.some((t) => ['defs','marker','clipPath','linearGradient','radialGradient'].includes(t))) fail('nested resource references are not allowed.');
          refs.push([key, ref[1]]);
        } else if (['clip-path','marker-start','marker-mid','marker-end'].includes(key) ? value !== 'none' : !color(value)) fail('only colors and local typed references are allowed.');
      } else if (numeric.has(key)) {
        const ns = numbers(value);
        if (['width','height','r','rx','ry','font-size','markerWidth','markerHeight'].includes(key) && ns.some((n) => n < 0 || n > 4096)) fail('size is out of bounds.');
      } else if (key === 'viewBox') { if (numbers(value).length !== 4 || value.includes('%')) fail('viewBox needs four numbers.'); }
      else if (key === 'points' || key === 'stroke-dasharray') { if (value !== 'none') numbers(value); }
      else if (key === 'd') { if (value.length > 20000 || !/^[MmZzLlHhVvCcSsQqTtAa0-9eE+.,\s-]+$/.test(value)) fail('invalid path.');
        for (const n of value.matchAll(/[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?/g)) if (!Number.isFinite(Number(n[0])) || Math.abs(Number(n[0])) > 100000) fail('path coordinate is out of bounds.'); }
      else if (key === 'transform' || key === 'gradientTransform') {
        const residue = value.replace(/(?:matrix|translate|scale|rotate|skewX|skewY)\(([^()]*)\)/g, (_, args) => { numbers(args); return ''; });
        if (residue.trim()) fail('invalid transform.');
      } else if (key === 'font-family') { if (!/^[A-Za-z0-9 ,_-]{1,100}$/.test(value)) fail('use a plain font-family name.'); }
      else if (key === 'orient') { if (!['auto','auto-start-reverse'].includes(value)) numbers(value); }
      else if (enums[key] && !enums[key].test(value)) fail(`invalid ${key}.`);
    }
    if (raw.slice(offset).trim()) fail('malformed attributes.');
    if (tag === 'svg') root = attrs;
    if (!/\/\s*>$/.test(match[0])) stack.push(tag);
  }
  if (stack.length || roots !== 1 || svg.slice(cursor).trim()) fail('unclosed SVG document.');
  if (root.xmlns !== 'http://www.w3.org/2000/svg' || !root.viewBox) fail('xmlns and viewBox are required.');
  const [x,y,width,height] = numbers(root.viewBox);
  if (x !== 0 || y !== 0 || width < 1 || height < 1 || width > 2400 || height > 2400) fail('use a viewBox beginning at 0 0 and no larger than 2400 × 2400.');
  for (const key of ['width','height']) if (root[key] && !/^\d+(?:\.\d+)?$/.test(root[key])) fail('root dimensions must be unitless numbers.');
  if (root.width && Number(root.width) !== width || root.height && Number(root.height) !== height) fail('root dimensions must match viewBox.');
  if (name === 'cover.svg' && (width !== 1200 || height !== 630)) fail('cover.svg must use viewBox="0 0 1200 630".');
  title = title.replace(/\s+/g, ' ').trim();
  if (titleCount !== 1 || !title || title.length > 200) fail('one readable root <title> (1–200 characters) is required.');
  for (const [key, id] of refs) {
    const expected = key.startsWith('marker') ? ['marker'] : key === 'clip-path' ? ['clipPath'] : ['linearGradient','radialGradient'];
    if (!expected.includes(ids.get(id))) fail(`missing or incorrect resource #${id}.`);
  }
  return { source: `${svg}\n`, title, width, height };
}
export function applyAssetPatch(existing, patch = {}) {
  const next = Object.assign(Object.create(null), existing);
  if (!patch || typeof patch !== 'object' || Array.isArray(patch) || Object.keys(patch).length > ASSET_LIMIT) fail('assets must be a small filename-to-SVG map.');
  for (const [name, value] of Object.entries(patch)) {
    assertAssetName(name);
    if (value === null) delete next[name];
    else next[name] = validateSvg(value, name).source;
  }
  if (Object.keys(next).length > ASSET_LIMIT || Object.values(next).reduce((sum, s) => sum + byteLength(s), 0) > ASSETS_LIMIT) fail('asset bundle is too large.');
  return next;
}
// Only image destinations are rewritten. Code examples and regular hyperlinks are not.
export function rewriteImageSources(document, format, transform) {
  const html = (value) => value.replace(/<img\b(?:"[^"]*"|'[^']*'|[^'">])*>/gi, (tag) => tag.replace(/\bsrc\s*=\s*(["'])([^"']*)\1/i, (_, quote, src) => `src=${quote}${transform(src)}${quote}`));
  if (format === 'html') return html(document);
  let fenced = null;
  return document.split('\n').map((line) => {
    const fence = /^\s{0,3}(`{3,}|~{3,})/.exec(line);
    if (fence) { if (!fenced) fenced = fence[1]; else if (fence[1][0] === fenced[0] && fence[1].length >= fenced.length) fenced = null; return line; }
    if (fenced || /^( {4}|\t)/.test(line)) return line;
    if (/^\s*\[[^\]]+\]:\s*<?asset:/i.test(line)) fail('use a direct image destination, not a Markdown reference definition.');
    return line.split(/(`+[^`]*`+)/g).map((part) => part.startsWith('`') ? part : html(part.replace(/(!\[(?:\\.|[^\]\\])*\]\(\s*)([^\s)]+)([^)]*\))/g, (_, a, src, b) => `${a}${transform(src)}${b}`))).join('');
  }).join('\n');
}
export function resolveAssetImages(document, format, prefix, assets) {
  return rewriteImageSources(document, format, (src) => {
    let name;
    if (src.startsWith('asset:')) name = src.slice(6);
    else if (src.startsWith(prefix)) name = src.slice(prefix.length);
    else return src;
    assertAssetName(name);
    if (assets && !Object.hasOwn(assets, name)) fail(`missing referenced file ${name}.`);
    return prefix + name;
  });
}
export function portableAssetImages(document, format, prefix) {
  return rewriteImageSources(document, format, (src) => src.startsWith(prefix) && ASSET_NAME.test(src.slice(prefix.length)) ? 'asset:' + src.slice(prefix.length) : src);
}
export async function effectiveNoteHash(contentHash, assets) {
  const names = Object.keys(assets).sort();
  if (!names.length) return contentHash;
  const bytes = new TextEncoder().encode(JSON.stringify([contentHash, ...names.map((name) => [name, assets[name]])]));
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return 'sha256:' + [...new Uint8Array(digest)].map((n) => n.toString(16).padStart(2, '0')).join('');
}
