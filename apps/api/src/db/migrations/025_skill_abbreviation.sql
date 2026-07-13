-- Migration 025: skill abbreviation (Feature 037).
-- Max 3 characters; duplicates allowed. Backfill fixed codes + algorithm results.

ALTER TABLE skills ADD COLUMN IF NOT EXISTS abbreviation TEXT;

UPDATE skills SET abbreviation = 'BCN' WHERE LOWER(name) = 'ball control';
UPDATE skills SET abbreviation = 'FIT' WHERE LOWER(name) = 'fitness';
UPDATE skills SET abbreviation = 'AWR' WHERE LOWER(name) = 'game awareness';
UPDATE skills SET abbreviation = 'PAS' WHERE LOWER(name) = 'passing';
UPDATE skills SET abbreviation = 'SPD' WHERE LOWER(name) = 'speed';

UPDATE skills SET abbreviation = 'ACC' WHERE LOWER(name) = 'acceleration' AND (abbreviation IS NULL OR abbreviation = '');
UPDATE skills SET abbreviation = 'ACN' WHERE LOWER(name) = 'aerial control' AND (abbreviation IS NULL OR abbreviation = '');
UPDATE skills SET abbreviation = 'AGL' WHERE LOWER(name) = 'agility' AND (abbreviation IS NULL OR abbreviation = '');
UPDATE skills SET abbreviation = 'CMP' WHERE LOWER(name) = 'composure' AND (abbreviation IS NULL OR abbreviation = '');
UPDATE skills SET abbreviation = 'CRT' WHERE LOWER(name) = 'creativity' AND (abbreviation IS NULL OR abbreviation = '');
UPDATE skills SET abbreviation = 'CRS' WHERE LOWER(name) = 'crossing' AND (abbreviation IS NULL OR abbreviation = '');
UPDATE skills SET abbreviation = 'DAW' WHERE LOWER(name) = 'defensive awareness' AND (abbreviation IS NULL OR abbreviation = '');
UPDATE skills SET abbreviation = 'DCN' WHERE LOWER(name) = 'defensive contribution' AND (abbreviation IS NULL OR abbreviation = '');
UPDATE skills SET abbreviation = 'DRB' WHERE LOWER(name) = 'dribbling' AND (abbreviation IS NULL OR abbreviation = '');
UPDATE skills SET abbreviation = 'FNS' WHERE LOWER(name) = 'finishing' AND (abbreviation IS NULL OR abbreviation = '');
UPDATE skills SET abbreviation = 'HND' WHERE LOWER(name) = 'handling' AND (abbreviation IS NULL OR abbreviation = '');
UPDATE skills SET abbreviation = 'HDN' WHERE LOWER(name) = 'heading' AND (abbreviation IS NULL OR abbreviation = '');
UPDATE skills SET abbreviation = 'HST' WHERE LOWER(name) = 'high stamina' AND (abbreviation IS NULL OR abbreviation = '');
UPDATE skills SET abbreviation = 'INT' WHERE LOWER(name) = 'interceptions' AND (abbreviation IS NULL OR abbreviation = '');
UPDATE skills SET abbreviation = 'LUP' WHERE LOWER(name) = 'link-up play' AND (abbreviation IS NULL OR abbreviation = '');
UPDATE skills SET abbreviation = 'LSH' WHERE LOWER(name) = 'long shots' AND (abbreviation IS NULL OR abbreviation = '');
UPDATE skills SET abbreviation = 'MRK' WHERE LOWER(name) = 'marking' AND (abbreviation IS NULL OR abbreviation = '');
UPDATE skills SET abbreviation = 'OBM' WHERE LOWER(name) = 'off-ball movement' AND (abbreviation IS NULL OR abbreviation = '');
UPDATE skills SET abbreviation = 'PAC' WHERE LOWER(name) = 'pace' AND (abbreviation IS NULL OR abbreviation = '');
UPDATE skills SET abbreviation = 'PST' WHERE LOWER(name) = 'positioning' AND (abbreviation IS NULL OR abbreviation = '');
UPDATE skills SET abbreviation = 'RFL' WHERE LOWER(name) = 'reflexes' AND (abbreviation IS NULL OR abbreviation = '');
UPDATE skills SET abbreviation = 'SST' WHERE LOWER(name) = 'shot stopping' AND (abbreviation IS NULL OR abbreviation = '');
UPDATE skills SET abbreviation = 'STM' WHERE LOWER(name) = 'stamina' AND (abbreviation IS NULL OR abbreviation = '');
UPDATE skills SET abbreviation = 'STR' WHERE LOWER(name) = 'strength' AND (abbreviation IS NULL OR abbreviation = '');
UPDATE skills SET abbreviation = 'TCK' WHERE LOWER(name) = 'tackling' AND (abbreviation IS NULL OR abbreviation = '');
UPDATE skills SET abbreviation = 'VSN' WHERE LOWER(name) = 'vision' AND (abbreviation IS NULL OR abbreviation = '');

-- Any remaining rows: placeholder from first 3 letters of name (uppercased).
UPDATE skills
SET abbreviation = UPPER(LEFT(REGEXP_REPLACE(name, '[^A-Za-z0-9]', '', 'g'), 3))
WHERE abbreviation IS NULL OR BTRIM(abbreviation) = '';

ALTER TABLE skills
  ALTER COLUMN abbreviation SET NOT NULL;

ALTER TABLE skills DROP CONSTRAINT IF EXISTS skills_abbreviation_len_check;
ALTER TABLE skills
  ADD CONSTRAINT skills_abbreviation_len_check
  CHECK (char_length(abbreviation) >= 1 AND char_length(abbreviation) <= 3);
