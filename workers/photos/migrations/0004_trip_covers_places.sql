ALTER TABLE albums ADD COLUMN google_place_id TEXT;
ALTER TABLE albums ADD COLUMN cover_photo_ids TEXT NOT NULL DEFAULT '[]';
