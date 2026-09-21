/** Aggregate-only PV counter. No visitor IDs, IP addresses or per-visit records. */
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
  return new Set(Object.values(manifest.pages).filter(Boolean));
}
function validateRefs(value, known) {
  if (!Array.isArray(value) || value.length > MAX_REFS) throw new Error('Invalid refs');
  if (value.some((ref) => typeof ref !== 'string' || !known.has(ref))) throw new Error('Unknown article');
  return [...new Set(value)];
}
const keyFor = (ref) => `note:${ref}`;
function totalsSelect(db, refs) {
  const keys = [SITE_KEY, ...refs.map(keyFor)];
  return db.prepare(`SELECT key, views, started_at FROM view_totals WHERE key IN (${keys.map(() => '?').join(',')})`).bind(...keys);
}
function counts(rows, refs, manifest, day) {
  const map = new Map(rows.map((row) => [row.key, row]));
  return {
    totalViews: Number(map.get(SITE_KEY)?.views || 0),
    articles: Object.fromEntries(refs.map((ref) => [ref, Number(map.get(keyFor(ref))?.views || 0)])),
    since: map.get(SITE_KEY)?.started_at || null, timeZone: manifest.timeZone, day
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
      const article = manifest.pages[path];
      if (article && !refs.includes(article)) refs.push(article);
      const keys = [SITE_KEY, ...(article ? [keyFor(article)] : [])];
      const total = db.prepare(`INSERT INTO view_totals (key, views) VALUES ${keys.map(() => '(?, 1)').join(',')} ON CONFLICT(key) DO UPDATE SET views = view_totals.views + 1`).bind(...keys);
      const daily = db.prepare(`INSERT INTO view_daily (key, day, views) VALUES ${keys.map(() => '(?, ?, 1)').join(',')} ON CONFLICT(key, day) DO UPDATE SET views = view_daily.views + 1`).bind(...keys.flatMap((key) => [key, day]));
      // D1 batch is transactional: both rollups and the returned values share one commit.
      const results = await db.batch([total, daily, totalsSelect(db, refs)]);
      return json(counts(results[2].results, refs, manifest, day));
    }
    const mode = url.searchParams.get('mode') || 'counts';
    if (mode === 'summary') {
      const ref = url.searchParams.get('ref');
      if (ref && !known.has(ref)) return json({ error: 'Unknown article' }, 400);
      const key = ref ? keyFor(ref) : SITE_KEY;
      const first = shiftDay(day, -29);
      const result = await db.batch([
        db.prepare('SELECT views, started_at FROM view_totals WHERE key = ?').bind(key),
        db.prepare('SELECT day, views FROM view_daily WHERE key = ? AND day >= ? AND day <= ? ORDER BY day').bind(key, first, day)
      ]);
      const daily = new Map(result[1].results.map((row) => [row.day, Number(row.views)]));
      const trend = Array.from({ length: 30 }, (_, i) => ({ day: shiftDay(first, i), views: daily.get(shiftDay(first, i)) || 0 }));
      return json({ ref: ref || SITE_KEY, total: Number(result[0].results[0]?.views || 0),
        since: result[0].results[0]?.started_at || null, today: daily.get(day) || 0,
        yesterday: daily.get(shiftDay(day, -1)) || 0,
        last7Days: trend.slice(-7).reduce((sum, row) => sum + row.views, 0),
        last30Days: trend.reduce((sum, row) => sum + row.views, 0), trend,
        timeZone: manifest.timeZone, day });
    }
    if (mode === 'top') {
      const period = url.searchParams.get('period') || '7d';
      if (!['all', '7d', '30d'].includes(period)) return json({ error: 'Invalid period' }, 400);
      const statement = period === 'all'
        ? db.prepare("SELECT key, views FROM view_totals WHERE key LIKE 'note:%' ORDER BY views DESC, key LIMIT 100")
        : db.prepare("SELECT key, SUM(views) AS views FROM view_daily WHERE key LIKE 'note:%' AND day >= ? AND day <= ? GROUP BY key ORDER BY views DESC, key LIMIT 100").bind(shiftDay(day, period === '7d' ? -6 : -29), day);
      const result = await statement.all();
      return json({ period, timeZone: manifest.timeZone, day, articles: result.results
        .map((row) => ({ ref: row.key.slice(5), views: Number(row.views) }))
        .filter((row) => known.has(row.ref)).slice(0, 10) });
    }
    if (mode !== 'counts') return json({ error: 'Unknown mode' }, 400);
    let refs;
    try { refs = validateRefs(url.searchParams.getAll('ref'), known); }
    catch { return json({ error: 'Invalid refs' }, 400); }
    const result = await totalsSelect(db, refs).all();
    return json(counts(result.results, refs, manifest, day));
  } catch {
    // Deliberately do not log payloads, database errors, IPs or visitor metadata.
    return json({ error: 'Counter temporarily unavailable' }, 503);
  }
}
