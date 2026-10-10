ALTER TABLE albums ADD COLUMN equipment_json TEXT;
ALTER TABLE photos ADD COLUMN equipment_json TEXT;
UPDATE photos SET metadata_state='queued' WHERE state='ready' AND metadata_state IN ('pending','ready','failed');
