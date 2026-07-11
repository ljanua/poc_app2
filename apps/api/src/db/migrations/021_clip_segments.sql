-- Feature 025: durable segment files with retrievable path per segment.

CREATE TABLE IF NOT EXISTS clip_segments (
  id TEXT PRIMARY KEY,
  clip_id TEXT NOT NULL REFERENCES clips(id) ON DELETE CASCADE,
  segment_index INT NOT NULL,
  path TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (clip_id, segment_index)
);

CREATE INDEX IF NOT EXISTS idx_clip_segments_clip_id ON clip_segments(clip_id);
