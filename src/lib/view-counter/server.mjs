/** Public aggregate counter. Never return event receipts or visitor hashes. */
import { allRefs, isUnlistedRef, keyForRef, refForPath } from './identity.mjs';
import { prepareEvent, recordEvent, readUV, readSources } from './metrics.mjs';
export const SITE_KEY = 'site:total';
export const MAX_REFS = 60;

export function dayInZone(date, timeZone) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone, year: 'numeric', month: '2-digit', day: '2-digit'
  }).formatToParts(date);
  const p = (name) => parts.find((part) => part.type === name).value;
  return `${p('year')}-${p('month')}-${p('day')}`;
}
export function shiftDay(day, amount) {
  const date = new Date(`${day}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + amount);
  return date.toISOString().slice(0, 10);
}
export function normalizePath(path) {
  if (typeof path !== 'string' || path.length > 512 || !path.startsWith('/')
    || /[?#\\\s]/.test(path) || path.startsWith('//')) return null;
  return path.replace(/\/index\.html$/, '/').replace(/\/+$/, '') || '/';
}
function json(body, status = 200) {
  return Response.json(body, { status, headers: {
    'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff',
    'X-Robots-Tag': 'noindex', 'Vary': 'Origin'
  }});
}
function knownRefs(manifest) {
  return allRefs(manifest);
}
function validateRefs(value, known) {
  if (!Array.isArray(value) || value.length > MAX_REFS) throw new Error('Invalid refs');
  if (value.some((ref) => typeof ref !== 'string' || !known.has(ref))) throw new Error('Unknown article');
  return [...new Set(value)];
}
const keyFor = keyForRef;
function totalsSelect(db, refs) {
  const keys = [SITE_KEY, ...refs.map(keyFor)];
  return db.prepare(`SELECT key, views, started_at FROM view_totals WHERE key IN (${keys.map(() => '?').join(',')})`).bind(...keys);
}
function counts(rows, refs, manifest, day) {
  const map = new Map(rows.map((row) => [row.key, row]));
  return {
    totalViews: Number(map.get(SITE_KEY)?.views || 0),
    articles: Object.fromEntries(refs.map((ref) => [ref, Number(map.get(keyFor(ref))?.views || 0)])),
    since: map.get(SITE_KEY)?.started_at || null, timeZone: manifest.timeZone, day,
    sinceByRef: Object.fromEntries(refs.map((ref) => [ref, map.get(keyFor(ref))?.started_at || null])),
    schemaVersion: 2
  };
}
async function readBody(request) {
  if (Number(request.headers.get('content-length') || 0) > 4096) throw new Error('Body too large');
  const reader = request.body?.getReader();
  if (!reader) throw new Error('Missing body');
  let size = 0;
  const chunks = [];
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 4096) { await reader.cancel(); throw new Error('Body too large'); }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  const body = JSON.parse(new TextDecoder().decode(bytes));
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw new Error('Invalid body');
  return body;
}

export async function handleViews(request, env, manifest, now = new Date()) {
  const url = new URL(request.url);
  if (url.origin !== manifest.origin) return json({ error: 'Production host only' }, 403);
  if (!['GET', 'POST'].includes(request.method)) return json({ error: 'Method not allowed' }, 405);
  const origin = request.headers.get('origin');
  if ((origin && origin !== manifest.origin) || (request.method === 'POST' && origin !== manifest.origin)
    || request.headers.get('sec-fetch-site') === 'cross-site') return json({ error: 'Origin rejected' }, 403);
  // Fail closed: do not expose plausible zero counters without a working database.
  if (!env.VIEWS_DB) return json({ error: 'Counter unavailable' }, 503);
  const db = env.VIEWS_DB;
  const known = knownRefs(manifest);
  const day = dayInZone(now, manifest.timeZone);
  try {
    if (request.method === 'POST') {
      if (!request.headers.get('content-type')?.toLowerCase().startsWith('application/json')) {
        return json({ error: 'JSON required' }, 415);
      }
      let body, path, refs;
      try {
        body = await readBody(request);
        path = normalizePath(body.path);
        if (!path || !Object.hasOwn(manifest.pages, path)) return json({ error: 'Unknown page' }, 400);
        refs = validateRefs(body.refs || [], known);
      } catch { return json({ error: 'Invalid request' }, 400); }
      const referer = request.headers.get('referer');
      if (referer) {
        try {
          const ref = new URL(referer);
          if (ref.origin !== manifest.origin || normalizePath(ref.pathname) !== path) return json({ error: 'Page mismatch' }, 403);
        } catch { return json({ error: 'Invalid referrer' }, 403); }
      }
      // A lightweight exclusion, not a claim of complete bot/fraud prevention.
      if (/bot|crawler|spider|headless|playwright|puppeteer|deployment-audit/i.test(request.headers.get('user-agent') || '')) {
        return new Response(null, { status: 204, headers: { 'Cache-Control': 'no-store' } });
      }
      const article = refForPath(path, manifest);
      if (article && !refs.includes(article)) refs.push(article);
      const keys = [SITE_KEY, ...(article ? [keyFor(article)] : [])];
      if (body.version === 2) {
        if (request.headers.get('sec-gpc') === '1' || request.headers.get('dnt') === '1') {
          return json(counts((await totalsSelect(db, refs).all()).results, refs, manifest, day));
        }
        let event;
        try { event = await prepareEvent(body, path, env.VIEWS_HASH_SECRET, now); }
        catch (error) { return json({ error: error instanceof TypeError ? 'Invalid event' : 'Counter temporarily unavailable' }, error instanceof TypeError ? 400 : 503); }
        const result = await recordEvent(db, event, keys, day, totalsSelect(db, refs));
        if (result.conflict) return json({ error: 'Event identity conflict' }, 409);
        return json({ ...counts(result.rows, refs, manifest, day), duplicate: result.duplicate });
      }
      if (body.version != null) return json({ error: 'Unsupported version' }, 400);
      // Already-open v1 clients preserve PV but cannot supply historical UV/source.
      const total = db.prepare(`INSERT INTO view_totals (key, views) VALUES ${keys.map(() => '(?, 1)').join(',')} ON CONFLICT(key) DO UPDATE SET views = view_totals.views + 1`).bind(...keys);
      const daily = db.prepare(`INSERT INTO view_daily (key, day, views) VALUES ${keys.map(() => '(?, ?, 1)').join(',')} ON CONFLICT(key, day) DO UPDATE SET views = view_daily.views + 1`).bind(...keys.flatMap((key) => [key, day]));
      // D1 batch is transactional: both rollups and the returned values share one commit.
      const results = await db.batch([total, daily, totalsSelect(db, refs)]);
      return json(counts(results[2].results, refs, manifest, day));
    }
    const mode = url.searchParams.get('mode') || 'counts';
    if (mode === 'summary') {
      const ref = url.searchParams.get('ref') || (url.searchParams.has('path') ? refForPath(normalizePath(url.searchParams.get('path')), manifest) : null);
      if (url.searchParams.has('path') && !ref) return json({ error: 'Unknown page' }, 400);
      if (ref && !known.has(ref)) return json({ error: 'Unknown article' }, 400);
      const key = ref ? keyFor(ref) : SITE_KEY;
      const first = shiftDay(day, -29);
      const result = await db.batch([
        db.prepare('SELECT views, started_at FROM view_totals WHERE key = ?').bind(key),
        db.prepare('SELECT day, views FROM view_daily WHERE key = ? AND day >= ? AND day <= ? ORDER BY day').bind(key, first, day)
      ]);
      const daily = new Map(result[1].results.map((row) => [row.day, Number(row.views)]));
      const trend = Array.from({ length: 30 }, (_, i) => ({ day: shiftDay(first, i), views: daily.get(shiftDay(first, i)) || 0 }));
      const uvData = await readUV(db, key, day, shiftDay);
      const { daily: uvDaily, ...uv } = uvData;
      for (const item of trend) item.uv = uvDaily.get(item.day) || 0;
      return json({ uv, ref: ref || SITE_KEY, total: Number(result[0].results[0]?.views || 0),
        since: result[0].results[0]?.started_at || null, today: daily.get(day) || 0,
        yesterday: daily.get(shiftDay(day, -1)) || 0,
        last7Days: trend.slice(-7).reduce((sum, row) => sum + row.views, 0),
        last30Days: trend.reduce((sum, row) => sum + row.views, 0), trend,
        timeZone: manifest.timeZone, day });
    }
    if (mode === 'sources') {
      const period = url.searchParams.get('period') || '7d';
      if (!['today','yesterday','7d','30d'].includes(period)) return json({ error: 'Invalid period' }, 400);
      const path = url.searchParams.get('path');
      const ref = url.searchParams.get('ref') || (path ? refForPath(normalizePath(path), manifest) : null);
      if ((path && !ref) || (ref && !known.has(ref))) return json({ error: 'Unknown page' }, 400);
      const end = period === 'yesterday' ? shiftDay(day,-1) : day;
      const first = period === '7d' ? shiftDay(day,-6) : period === '30d' ? shiftDay(day,-29) : end;
      return json({ ...(await readSources(db, ref ? keyFor(ref) : SITE_KEY, first, end)), ref: ref || SITE_KEY, period, from: first, to: end, timeZone: manifest.timeZone });
    }
    if (mode === 'top') {
      const period = url.searchParams.get('period') || '7d';
      if (!['all', '7d', '30d'].includes(period)) return json({ error: 'Invalid period' }, 400);
      const type = url.searchParams.get('type') || 'notes';
      if (!['notes', 'pages', 'all'].includes(type)) return json({ error: 'Invalid type' }, 400);
      const pattern = type === 'notes' ? 'note:%' : type === 'pages' ? 'page:%' : '%';
      const statement = period === 'all'
        ? db.prepare("SELECT key, views FROM view_totals WHERE key LIKE ? AND key != 'site:total' ORDER BY views DESC, key LIMIT 200").bind(pattern)
        : db.prepare("SELECT key, SUM(views) AS views FROM view_daily WHERE key LIKE ? AND key != 'site:total' AND day >= ? AND day <= ? GROUP BY key ORDER BY views DESC, key LIMIT 200").bind(pattern, shiftDay(day, period === '7d' ? -6 : -29), day);
      const result = await statement.all();
      return json({ period, type, timeZone: manifest.timeZone, day, articles: result.results
        .map((row) => ({ ref: row.key.startsWith('note:') ? row.key.slice(5) : row.key, views: Number(row.views) }))
        .filter((row) => known.has(row.ref) && !isUnlistedRef(row.ref)).slice(0, 10) });
    }
    if (mode !== 'counts') return json({ error: 'Unknown mode' }, 400);
    let refs;
    try {
      const paths = url.searchParams.getAll('path').map((p) => refForPath(normalizePath(p), manifest));
      refs = validateRefs([...url.searchParams.getAll('ref'), ...paths], known);
    }
    catch { return json({ error: 'Invalid refs' }, 400); }
    const result = await totalsSelect(db, refs).all();
    return json(counts(result.results, refs, manifest, day));
  } catch {
    // Deliberately do not log payloads, database errors, IPs or visitor metadata.
    return json({ error: 'Counter temporarily unavailable' }, 503);
  }
}
