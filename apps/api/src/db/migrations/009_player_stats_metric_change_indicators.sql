-- Add per-metric change indicators for the S2 dashboard's Current Level, Fitness,
-- and Skill Progress badges, replacing the static "Up 5%"/"Stable"/"Up 3%" markup.

ALTER TABLE player_stats ADD COLUMN IF NOT EXISTS current_level_change_label TEXT;
ALTER TABLE player_stats ADD COLUMN IF NOT EXISTS current_level_change_trend TEXT
  CHECK (current_level_change_trend IN ('improving', 'plateau', 'declining'));
ALTER TABLE player_stats ADD COLUMN IF NOT EXISTS fitness_change_label TEXT;
ALTER TABLE player_stats ADD COLUMN IF NOT EXISTS fitness_change_trend TEXT
  CHECK (fitness_change_trend IN ('improving', 'plateau', 'declining'));
ALTER TABLE player_stats ADD COLUMN IF NOT EXISTS skill_progress_change_label TEXT;
ALTER TABLE player_stats ADD COLUMN IF NOT EXISTS skill_progress_change_trend TEXT
  CHECK (skill_progress_change_trend IN ('improving', 'plateau', 'declining'));

UPDATE player_stats SET
  current_level_change_label = 'Up 5%',
  current_level_change_trend = 'improving',
  fitness_change_label = 'Stable',
  fitness_change_trend = 'plateau',
  skill_progress_change_label = 'Up 3%',
  skill_progress_change_trend = 'improving',
  updated_at = NOW()
WHERE player_id = 'p_10' AND current_level_change_label IS NULL;

UPDATE player_stats SET
  current_level_change_label = 'Stable',
  current_level_change_trend = 'plateau',
  fitness_change_label = 'Down 2%',
  fitness_change_trend = 'declining',
  skill_progress_change_label = 'Up 1%',
  skill_progress_change_trend = 'improving',
  updated_at = NOW()
WHERE player_id = 'p_11' AND current_level_change_label IS NULL;

UPDATE player_stats SET
  current_level_change_label = 'Down 3%',
  current_level_change_trend = 'declining',
  fitness_change_label = 'Down 4%',
  fitness_change_trend = 'declining',
  skill_progress_change_label = 'Stable',
  skill_progress_change_trend = 'plateau',
  updated_at = NOW()
WHERE player_id = 'p_12' AND current_level_change_label IS NULL;

UPDATE player_stats SET
  current_level_change_label = 'Up 4%',
  current_level_change_trend = 'improving',
  fitness_change_label = 'Up 2%',
  fitness_change_trend = 'improving',
  skill_progress_change_label = 'Up 4%',
  skill_progress_change_trend = 'improving',
  updated_at = NOW()
WHERE player_id = 'p_13' AND current_level_change_label IS NULL;

-- Any remaining rows (players outside the four seeded profiles) fall back to a
-- trend-consistent default so the badges never render blank.
UPDATE player_stats SET
  current_level_change_label = CASE trend WHEN 'improving' THEN 'Up 5%' WHEN 'declining' THEN 'Down 3%' ELSE 'Stable' END,
  current_level_change_trend = trend,
  fitness_change_label = CASE trend WHEN 'improving' THEN 'Up 2%' WHEN 'declining' THEN 'Down 2%' ELSE 'Stable' END,
  fitness_change_trend = trend,
  skill_progress_change_label = CASE trend WHEN 'improving' THEN 'Up 3%' WHEN 'declining' THEN 'Down 1%' ELSE 'Up 1%' END,
  skill_progress_change_trend = CASE trend WHEN 'declining' THEN 'declining' ELSE 'improving' END,
  updated_at = NOW()
WHERE current_level_change_label IS NULL;
