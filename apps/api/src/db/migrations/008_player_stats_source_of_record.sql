-- Add canonical dashboard summary data for S2 player profiles.

CREATE TABLE IF NOT EXISTS player_stats (
  player_id TEXT PRIMARY KEY REFERENCES players(id) ON DELETE CASCADE,
  growth_status TEXT,
  current_level TEXT,
  fitness TEXT,
  skill_progress TEXT,
  total_minutes INTEGER NOT NULL DEFAULT 0,
  appearances INTEGER NOT NULL DEFAULT 0,
  recent_avg TEXT,
  average_score NUMERIC(4,2),
  trend TEXT NOT NULL CHECK (trend IN ('improving', 'plateau', 'declining')),
  last_match_score NUMERIC(4,2),
  last_match_summary TEXT,
  clip_submitted_count INTEGER NOT NULL DEFAULT 0,
  clip_assessed_count INTEGER NOT NULL DEFAULT 0,
  clip_pending_count INTEGER NOT NULL DEFAULT 0,
  missing_data_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_player_stats_trend ON player_stats(trend);

INSERT INTO player_stats (
  player_id,
  growth_status,
  current_level,
  fitness,
  skill_progress,
  total_minutes,
  appearances,
  recent_avg,
  average_score,
  trend,
  last_match_score,
  last_match_summary,
  clip_submitted_count,
  clip_assessed_count,
  clip_pending_count,
  missing_data_message
)
VALUES
  ('p_10', 'on_track', '92%', '87%', '94%', 540, 26, '90''', 8.80, 'improving', 8.50, 'Confident execution under pressure.', 4, 3, 1, NULL),
  ('p_11', 'watch', '81%', '79%', '86%', 420, 18, '70''', 7.10, 'plateau', 7.10, 'Pace was strong, timing can improve.', 3, 2, 1, NULL),
  ('p_12', 'at_risk', '87%', '83%', '90%', 0, 0, 'N/A', NULL, 'declining', NULL, NULL, 1, 0, 1, 'Performance metrics are not available yet.'),
  ('p_13', 'on_track', '94%', '91%', '95%', 1980, 24, '88''', 8.50, 'improving', 8.90, 'Strong finishing and recovery runs.', 2, 1, 1, NULL)
ON CONFLICT (player_id) DO UPDATE SET
  growth_status = EXCLUDED.growth_status,
  current_level = EXCLUDED.current_level,
  fitness = EXCLUDED.fitness,
  skill_progress = EXCLUDED.skill_progress,
  total_minutes = EXCLUDED.total_minutes,
  appearances = EXCLUDED.appearances,
  recent_avg = EXCLUDED.recent_avg,
  average_score = EXCLUDED.average_score,
  trend = EXCLUDED.trend,
  last_match_score = EXCLUDED.last_match_score,
  last_match_summary = EXCLUDED.last_match_summary,
  clip_submitted_count = EXCLUDED.clip_submitted_count,
  clip_assessed_count = EXCLUDED.clip_assessed_count,
  clip_pending_count = EXCLUDED.clip_pending_count,
  missing_data_message = EXCLUDED.missing_data_message,
  updated_at = NOW();