-- Add nullable avatar_url column to players table.

ALTER TABLE players ADD COLUMN IF NOT EXISTS player_avatar_url TEXT;
