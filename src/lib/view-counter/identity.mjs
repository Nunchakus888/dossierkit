// A note retains its v1 identity. Every other page gets its own scope.
// These unlisted CV paths are countable on direct visits, but never appear in public rankings.
export const isUnlistedRef = (ref) => /^page:\/(zh|en)\/cv-agent$/.test(ref);
export function refForPath(path, manifest) {
  return Object.hasOwn(manifest.pages, path) ? (manifest.pages[path] || `page:${path}`) : null;
}
export const keyForRef = (ref) => ref.startsWith('page:/') ? ref : `note:${ref}`;
export const allRefs = (manifest) => new Set(Object.keys(manifest.pages).map((p) => refForPath(p, manifest)));
export const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const label = (v) => typeof v === 'string' && /^[a-z0-9][a-z0-9_.-]{0,39}$/i.test(v) ? v.toLowerCase() : '';
export function normalizeAttribution(value) {
  const direct = { source: 'direct-unknown', medium: '', basis: 'unknown' };
  if (!value || typeof value !== 'object') return direct;
  if (value.basis === 'utm') {
    const source = label(value.source);
    return source ? { source, medium: label(value.medium), basis: 'utm' } : direct;
  }
  if (value.basis === 'referrer' && typeof value.source === 'string' && value.source.length <= 253) {
    const host = value.source.toLowerCase().replace(/^www\./, '');
    // Hostname only: no credentials, paths, ports, IP addresses or arbitrary URLs.
    if (/^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/.test(host)) {
      return { source: host, medium: '', basis: 'referrer' };
    }
  }
  return direct;
}
