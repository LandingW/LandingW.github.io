CREATE TABLE photo_folders (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  created_at TEXT NOT NULL
);
ALTER TABLE albums ADD COLUMN deleted_at TEXT;
ALTER TABLE albums ADD COLUMN is_library INTEGER NOT NULL DEFAULT 0;
ALTER TABLE photos ADD COLUMN folder_id TEXT REFERENCES photo_folders(id);
ALTER TABLE photos ADD COLUMN deleted_at TEXT;
ALTER TABLE photos ADD COLUMN purging INTEGER NOT NULL DEFAULT 0;
CREATE TABLE album_photos (
  album_id TEXT NOT NULL REFERENCES albums(id),
  photo_id TEXT NOT NULL REFERENCES photos(id),
  position INTEGER NOT NULL DEFAULT 0,
  published INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (album_id, photo_id)
);
CREATE INDEX album_photos_photo ON album_photos(photo_id);
CREATE INDEX photos_folder ON photos(folder_id, deleted_at);
INSERT INTO photo_folders(id,name,created_at) SELECT id,title,created_at FROM albums;
UPDATE photos SET folder_id=album_id;
INSERT INTO album_photos(album_id,photo_id,position,published)
  SELECT album_id,id,ROW_NUMBER() OVER (PARTITION BY album_id ORDER BY created_at,id)-1,published
  FROM photos WHERE state!='aborted';
INSERT INTO albums(id,title,is_library,created_at)
  VALUES('photo-library','照片库',1,strftime('%Y-%m-%dT%H:%M:%fZ','now'));
