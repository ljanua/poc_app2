-- Feature 018: S4 video upload + async LLM assessment pipeline.
-- Extends clips for video storage, new status lifecycle, and processing config.

CREATE TABLE IF NOT EXISTS processing_config (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  description TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO processing_config (key, value, description)
VALUES (
  'max_parallel_video_processes',
  '1',
  'Maximum number of clip assessments that may run concurrently'
)
ON CONFLICT (key) DO NOTHING;

INSERT INTO processing_config (key, value, description)
VALUES (
  'ollama_base_url',
  'http://macmini.lan:11434',
  'Ollama server base URL for video segment assessment'
)
ON CONFLICT (key) DO NOTHING;

INSERT INTO processing_config (key, value, description)
VALUES (
  'ollama_video_model',
  'gemma4:12b-mlx',
  'Ollama model used to assess video segments'
)
ON CONFLICT (key) DO NOTHING;

ALTER TABLE clips
  ADD COLUMN IF NOT EXISTS video_storage_path TEXT,
  ADD COLUMN IF NOT EXISTS original_filename TEXT,
  ADD COLUMN IF NOT EXISTS mime_type TEXT,
  ADD COLUMN IF NOT EXISTS file_size_bytes BIGINT,
  ADD COLUMN IF NOT EXISTS skill_focus JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS skill_ratings JSONB,
  ADD COLUMN IF NOT EXISTS processing_started_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS processing_completed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS error_message TEXT;

-- Migrate legacy statuses before replacing the CHECK constraint.
ALTER TABLE clips DROP CONSTRAINT IF EXISTS clips_status_check;

UPDATE clips SET status = 'submitted' WHERE status = 'pending';
UPDATE clips SET status = 'complete' WHERE status = 'assessed';

ALTER TABLE clips
  ADD CONSTRAINT clips_status_check
  CHECK (status IN ('submitted', 'in_progress', 'complete', 'failed'));

CREATE INDEX IF NOT EXISTS idx_clips_status_submitted
  ON clips(created_at)
  WHERE status = 'submitted';
