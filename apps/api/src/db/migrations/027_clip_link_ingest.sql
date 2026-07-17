-- Feature: S4 video link ingest + find-player window (backlog 018).

ALTER TABLE clips
  ADD COLUMN IF NOT EXISTS source_url TEXT,
  ADD COLUMN IF NOT EXISTS source_start_ms INTEGER,
  ADD COLUMN IF NOT EXISTS source_duration_ms INTEGER,
  ADD COLUMN IF NOT EXISTS find_player BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS find_player_matched_ms INTEGER;

INSERT INTO processing_config (key, value, description)
VALUES (
  'ytdlp_path',
  'yt-dlp',
  'Path to yt-dlp binary for YouTube/hosted video downloads'
)
ON CONFLICT (key) DO NOTHING;
