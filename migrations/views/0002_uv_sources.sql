-- Additive migration. Historic PV counters remain unchanged.
CREATE TABLE IF NOT EXISTS view_meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);
INSERT OR IGNORE INTO view_meta VALUES ('v2_since', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'));
-- Short-lived idempotency receipts, not a page/visitor event log.
CREATE TABLE IF NOT EXISTS view_events (
  event_id TEXT PRIMARY KEY, owner TEXT NOT NULL, fingerprint TEXT NOT NULL, expires_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS view_events_expiry ON view_events(expires_at);
-- One row per day/scope/browser/source, retained for 90 natural days.
CREATE TABLE IF NOT EXISTS view_visitors (
  key TEXT NOT NULL, day TEXT NOT NULL, visitor_hash TEXT NOT NULL,
  source TEXT NOT NULL, medium TEXT NOT NULL, basis TEXT NOT NULL,
  PRIMARY KEY (key, day, visitor_hash, source, medium, basis)
);
CREATE INDEX IF NOT EXISTS view_visitors_day ON view_visitors(day);
CREATE TABLE IF NOT EXISTS view_sources_daily (
  key TEXT NOT NULL, day TEXT NOT NULL, source TEXT NOT NULL, medium TEXT NOT NULL, basis TEXT NOT NULL,
  views INTEGER NOT NULL DEFAULT 0 CHECK (views >= 0),
  identified_views INTEGER NOT NULL DEFAULT 0 CHECK (identified_views >= 0),
  PRIMARY KEY (key, day, source, medium, basis)
) WITHOUT ROWID;
