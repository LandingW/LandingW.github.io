ALTER TABLE albums ADD COLUMN stops_json TEXT NOT NULL DEFAULT '[]';
CREATE TABLE place_search_cache (
  key TEXT PRIMARY KEY,
  results_json TEXT NOT NULL,
  expires_at INTEGER NOT NULL
);
CREATE TABLE service_limits (
  key TEXT PRIMARY KEY,
  next_at INTEGER NOT NULL
);
CREATE TABLE service_events (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
