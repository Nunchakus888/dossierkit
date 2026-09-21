import { UUID, normalizeAttribution } from './identity.mjs';
export const VISITOR_KEY = 'dossierkit:views:visitor:v2';
export const SOURCE_KEY = 'dossierkit:views:source:v2';
export const EXCLUDE_KEY = 'dossierkit:views:exclude';
const ID_TTL = 90 * 86400000;
const SESSION_TTL = 30 * 60000;
export function isExcluded(win) {
  let excluded = Boolean(win.navigator.webdriver || win.navigator.globalPrivacyControl === true || win.navigator.doNotTrack === '1');
  try { excluded ||= win.localStorage.getItem(EXCLUDE_KEY) === '1'; } catch { /* PV may still work without storage. */ }
  return excluded;
}
export function clearIdentity(win) {
  try { win.localStorage.removeItem(VISITOR_KEY); } catch { /* Storage disabled. */ }
  try { win.sessionStorage.removeItem(SOURCE_KEY); } catch { /* Storage disabled. */ }
}
export async function visitorId(win, now = Date.now()) {
  const readOrCreate = () => {
    try {
      const previous = JSON.parse(win.localStorage.getItem(VISITOR_KEY) || 'null');
      if (previous && UUID.test(previous.id) && Number.isFinite(previous.expires) && previous.expires > now && previous.expires <= now + ID_TTL) return previous.id;
      const id = win.crypto.randomUUID();
      win.localStorage.setItem(VISITOR_KEY, JSON.stringify({ id, expires: now + ID_TTL }));
      // Do not make up a new UV per refresh when storage is blocked or read-only.
      return JSON.parse(win.localStorage.getItem(VISITOR_KEY) || 'null')?.id === id ? id : null;
    } catch { return null; }
  };
  try {
    // Same-origin tabs share this lock; fallback is best-effort on older browsers.
    return win.navigator.locks?.request ? await win.navigator.locks.request(VISITOR_KEY, readOrCreate) : readOrCreate();
  } catch { return null; }
}
export function entrySource(win, doc, now = Date.now()) {
  const current = new URL(win.location.href || win.location.pathname, win.location.origin);
  let referring = null, saved = null;
  try { referring = new URL(doc.referrer); } catch { /* Missing is unknown, not a guessed app. */ }
  try { saved = JSON.parse(win.sessionStorage.getItem(SOURCE_KEY) || 'null'); } catch { /* Optional chain storage. */ }
  const active = saved && Number.isFinite(saved.lastSeen) && now - saved.lastSeen >= 0 && now - saved.lastSeen < SESSION_TTL;
  const internal = referring?.origin === current.origin;
  const navigation = win.performance?.getEntriesByType?.('navigation')?.[0]?.type;
  const tagged = normalizeAttribution({ basis: 'utm', source: current.searchParams.get('utm_source'), medium: current.searchParams.get('utm_medium') });
  let value;
  if (tagged.basis === 'utm' && (!internal || !active)) value = tagged;
  else if (referring && !internal && ['http:', 'https:'].includes(referring.protocol)) value = normalizeAttribution({ basis: 'referrer', source: referring.hostname });
  else if (active && (internal || navigation === 'reload' || navigation === 'back_forward')) value = normalizeAttribution(saved.value);
  else value = normalizeAttribution(null);
  try { win.sessionStorage.setItem(SOURCE_KEY, JSON.stringify({ value, lastSeen: now })); } catch { /* Unknown is acceptable. */ }
  return value;
}
