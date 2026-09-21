-- Additive and idempotent: deploying must never reset existing counts.
CREATE TABLE IF NOT EXISTS view_totals (
  key TEXT PRIMARY KEY,
  views INTEGER NOT NULL DEFAULT 0 CHECK (views >= 0),
  started_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE TABLE IF NOT EXISTS view_daily (
  key TEXT NOT NULL,
  day TEXT NOT NULL,
  views INTEGER NOT NULL DEFAULT 0 CHECK (views >= 0),
  PRIMARY KEY (key, day)
) WITHOUT ROWID;
CREATE INDEX IF NOT EXISTS view_daily_day ON view_daily(day);
INSERT OR IGNORE INTO view_totals (key, views) VALUES ('site:total', 0);
