import { UUID, normalizeAttribution } from './identity.mjs';
const MAX_EVENT_AGE = 24 * 60 * 60 * 1000;
export const EVENT_RETENTION = 48 * 60 * 60 * 1000;
const encoder = new TextEncoder();
async function hmac(secret, value) {
  const key = await crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return Array.from(new Uint8Array(await crypto.subtle.sign('HMAC', key, encoder.encode(value))), (b) => b.toString(16).padStart(2, '0')).join('');
}
export async function prepareEvent(body, path, secret, now) {
  if (typeof secret !== 'string' || secret.length < 32) throw new Error('Unavailable');
  if (!UUID.test(body.eventId || '') || !Number.isSafeInteger(body.occurredAt)
    || body.occurredAt < now.getTime() - MAX_EVENT_AGE || body.occurredAt > now.getTime() + 300000) throw new TypeError('Invalid event');
  if (body.visitorId != null && !UUID.test(body.visitorId)) throw new TypeError('Invalid visitor');
  const attribution = normalizeAttribution(body.attribution);
  const visitor = body.visitorId ? await hmac(secret, 'visitor:' + body.visitorId.toLowerCase()) : null;
  const fingerprint = await hmac(secret, JSON.stringify([path, body.occurredAt, visitor, attribution]));
  return { id: body.eventId.toLowerCase(), owner: crypto.randomUUID(), fingerprint,
    expires: now.getTime() + EVENT_RETENTION, visitor, ...attribution };
}
export async function recordEvent(db, event, keys, day, readCounts) {
  // All mutations require ownership of the newly inserted receipt. A duplicate
  // INSERT alone is not enough: unconditional increments would double-count.
  const keySQL = keys.map(() => 'SELECT ? AS key').join(' UNION ALL ');
  const guard = 'EXISTS (SELECT 1 FROM view_events WHERE event_id = ? AND owner = ?)';
  const receipt = [event.id, event.owner];
  const statements = [
    db.prepare('INSERT INTO view_events (event_id,owner,fingerprint,expires_at) VALUES (?,?,?,?) ON CONFLICT(event_id) DO NOTHING')
      .bind(event.id, event.owner, event.fingerprint, event.expires),
    db.prepare(`INSERT INTO view_totals(key,views) SELECT key,1 FROM (${keySQL}) WHERE ${guard} ON CONFLICT(key) DO UPDATE SET views=view_totals.views+1`)
      .bind(...keys, ...receipt),
    db.prepare(`INSERT INTO view_daily(key,day,views) SELECT key,?,1 FROM (${keySQL}) WHERE ${guard} ON CONFLICT(key,day) DO UPDATE SET views=view_daily.views+1`)
      .bind(day, ...keys, ...receipt),
    db.prepare(`INSERT INTO view_visitors(key,day,visitor_hash,source,medium,basis) SELECT key,?,?,?,?,? FROM (${keySQL}) WHERE ? IS NOT NULL AND ${guard} ON CONFLICT DO NOTHING`)
      .bind(day, event.visitor, event.source, event.medium, event.basis, ...keys, event.visitor, ...receipt),
    db.prepare(`INSERT INTO view_sources_daily(key,day,source,medium,basis,views,identified_views) SELECT key,?,?,?,?,1,? FROM (${keySQL}) WHERE ${guard} ON CONFLICT(key,day,source,medium,basis) DO UPDATE SET views=view_sources_daily.views+1,identified_views=view_sources_daily.identified_views+excluded.identified_views`)
      .bind(day, event.source, event.medium, event.basis, event.visitor ? 1 : 0, ...keys, ...receipt),
    readCounts,
    db.prepare('SELECT owner,fingerprint FROM view_events WHERE event_id=?').bind(event.id)
  ];
  const result = await db.batch(statements);
  const stored = result[6].results[0];
  return { rows: result[5].results, duplicate: stored.owner !== event.owner,
    conflict: stored.fingerprint !== event.fingerprint };
}
export async function readUV(db, key, day, shiftDay) {
  const first = shiftDay(day, -29);
  const results = await db.batch([
    db.prepare(`SELECT COUNT(DISTINCT CASE WHEN day=? THEN visitor_hash END) AS today,
      COUNT(DISTINCT CASE WHEN day=? THEN visitor_hash END) AS yesterday,
      COUNT(DISTINCT CASE WHEN day>=? THEN visitor_hash END) AS last7Days,
      COUNT(DISTINCT visitor_hash) AS last30Days FROM view_visitors WHERE key=? AND day>=? AND day<=?`)
      .bind(day, shiftDay(day,-1), shiftDay(day,-6), key, first, day),
    db.prepare('SELECT day,COUNT(DISTINCT visitor_hash) AS uv FROM view_visitors WHERE key=? AND day>=? AND day<=? GROUP BY day').bind(key,first,day),
    db.prepare("SELECT value FROM view_meta WHERE key='v2_since'"),
    db.prepare('SELECT SUM(views) AS views,SUM(identified_views) AS identifiedViews FROM view_sources_daily WHERE key=? AND day>=? AND day<=?').bind(key,first,day)
  ]);
  return { ...results[0].results[0], since: results[2].results[0]?.value || null,
    identity: 'first-party-browser', retentionDays: 90, window: 'calendar-days-including-today',
    observedViews30Days: Number(results[3].results[0]?.views || 0),
    identifiableViews30Days: Number(results[3].results[0]?.identifiedViews || 0),
    daily: new Map(results[1].results.map((r) => [r.day, Number(r.uv)])) };
}
export async function readSources(db, key, first, day) {
  const results = await db.batch([
    db.prepare(`SELECT s.source,s.medium,s.basis,SUM(s.views) AS pv,SUM(s.identified_views) AS identifiedPV,
      (SELECT COUNT(DISTINCT v.visitor_hash) FROM view_visitors v WHERE v.key=s.key AND v.day>=? AND v.day<=?
       AND v.source=s.source AND v.medium=s.medium AND v.basis=s.basis) AS uv
      FROM view_sources_daily s WHERE s.key=? AND s.day>=? AND s.day<=?
      GROUP BY s.source,s.medium,s.basis ORDER BY pv DESC,s.source LIMIT 51`).bind(first,day,key,first,day),
    db.prepare('SELECT SUM(views) AS pv,SUM(identified_views) AS identifiedPV FROM view_sources_daily WHERE key=? AND day>=? AND day<=?').bind(key,first,day),
    db.prepare('SELECT COUNT(DISTINCT visitor_hash) AS uv FROM view_visitors WHERE key=? AND day>=? AND day<=?').bind(key,first,day),
    db.prepare("SELECT value FROM view_meta WHERE key='v2_since'")
  ]);
  return { sources: results[0].results.slice(0,50), truncated: results[0].results.length>50,
    total: { pv: Number(results[1].results[0]?.pv || 0), identifiedPV: Number(results[1].results[0]?.identifiedPV || 0), uv: Number(results[2].results[0]?.uv || 0) },
    since: results[3].results[0]?.value || null, attribution: 'tagged-or-referrer-entry-chain-not-verified-platform',
    channelUVIsNotAdditive: true };
}
