-- Reset player_stats rows that were fabricated by a since-fixed bug in
-- scripts/serve-mockup.js: syncDefaultDashboardStats() used to overwrite
-- EVERY player's stats on every server restart, including real/non-demo
-- players, with one of three fixed "archetype" profiles (keyed only by
-- trend) borrowed from the four named reference players (Lionel Messi,
-- Cristiano Ronaldo, Neymar Jr, Kylian Mbappe). A brand-new player with
-- zero matches could end up showing Cristiano Ronaldo's exact "Pace was
-- strong, timing can improve." summary and a 540-minute season.
--
-- This migration targets only rows that exactly match one of the three
-- fabricated archetype signatures below and belong to a player outside the
-- four named profiles -- not a blanket reset of every non-named player's
-- stats -- so it never touches genuinely different data a player may
-- legitimately accrue in the future. It is safe to run more than once: a
-- row that has already been reset (or was never fabricated) no longer
-- matches a signature and is left untouched.

UPDATE player_stats ps
SET
  growth_status = NULL,
  current_level = NULL,
  fitness = NULL,
  skill_progress = NULL,
  total_minutes = 0,
  appearances = 0,
  recent_avg = 'N/A',
  average_score = NULL,
  last_match_score = NULL,
  last_match_summary = NULL,
  clip_submitted_count = 0,
  clip_assessed_count = 0,
  clip_pending_count = 0,
  missing_data_message = 'Performance metrics are not available yet.',
  current_level_change_label = NULL,
  current_level_change_trend = NULL,
  fitness_change_label = NULL,
  fitness_change_trend = NULL,
  skill_progress_change_label = NULL,
  skill_progress_change_trend = NULL,
  updated_at = NOW()
FROM players p
WHERE p.id = ps.player_id
  AND p.normalized_name NOT IN ('lionel messi', 'cristiano ronaldo', 'neymar jr', 'kylian mbappe')
  AND (
    -- "improving" archetype (borrowed from Lionel Messi's profile)
    (
      ps.growth_status = 'on_track' AND ps.current_level = '92%' AND ps.fitness = '87%' AND ps.skill_progress = '94%'
      AND ps.total_minutes = 2340 AND ps.appearances = 26 AND ps.recent_avg = '90''' AND ps.average_score = 8.8
      AND ps.last_match_score = 8.5 AND ps.last_match_summary = 'Confident execution under pressure.'
      AND ps.clip_submitted_count = 4 AND ps.clip_assessed_count = 3 AND ps.clip_pending_count = 1
    )
    OR
    -- "declining" archetype (borrowed from Neymar Jr's profile)
    (
      ps.growth_status = 'at_risk' AND ps.current_level = '81%' AND ps.fitness = '79%' AND ps.skill_progress = '86%'
      AND ps.total_minutes = 420 AND ps.appearances = 12 AND ps.recent_avg = '70''' AND ps.average_score IS NULL
      AND ps.last_match_score IS NULL AND ps.last_match_summary IS NULL
      AND ps.clip_submitted_count = 2 AND ps.clip_assessed_count = 0 AND ps.clip_pending_count = 2
    )
    OR
    -- "plateau" archetype (borrowed from Cristiano Ronaldo's profile)
    (
      ps.growth_status = 'watch' AND ps.current_level = '87%' AND ps.fitness = '87%' AND ps.skill_progress = '86%'
      AND ps.total_minutes = 540 AND ps.appearances = 8 AND ps.recent_avg = '72''' AND ps.average_score = 7.1
      AND ps.last_match_score = 7.1 AND ps.last_match_summary = 'Pace was strong, timing can improve.'
      AND ps.clip_submitted_count = 3 AND ps.clip_assessed_count = 2 AND ps.clip_pending_count = 1
    )
  );
