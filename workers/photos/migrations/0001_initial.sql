CREATE TABLE albums (
  id TEXT PRIMARY KEY, title TEXT NOT NULL, description TEXT NOT NULL DEFAULT '',
  place TEXT NOT NULL DEFAULT '', date TEXT NOT NULL DEFAULT '',
  latitude REAL, longitude REAL, published INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);
CREATE TABLE photos (
  id TEXT PRIMARY KEY, album_id TEXT NOT NULL REFERENCES albums(id),
  original_key TEXT NOT NULL, filename TEXT NOT NULL, mime TEXT NOT NULL,
  bytes INTEGER NOT NULL, fingerprint TEXT NOT NULL, upload_id TEXT,
  state TEXT NOT NULL CHECK(state IN ('uploading','queued','processing','ready','failed','aborted')),
  caption TEXT NOT NULL DEFAULT '', published INTEGER NOT NULL DEFAULT 0,
  revision TEXT, lease TEXT, error TEXT, width INTEGER, height INTEGER,
  tile_count INTEGER, derived_bytes INTEGER,
  created_at TEXT NOT NULL, updated_at TEXT NOT NULL
);
CREATE INDEX photos_state ON photos(state, updated_at);
CREATE INDEX photos_album ON photos(album_id);
