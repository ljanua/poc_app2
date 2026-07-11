-- Feature 026: backfill players.birth_year from assigned team's age_group.
-- Digits only (e.g. U17 -> 17, 18+ -> 18). Overwrites existing birth_year.
-- Does not modify birth_month. Skips teams with no digits in age_group.

UPDATE players p
SET birth_year = GREATEST(
      1960,
      LEAST(
        EXTRACT(YEAR FROM NOW())::SMALLINT,
        (EXTRACT(YEAR FROM NOW())::INT - regexp_replace(t.age_group, '[^0-9]', '', 'g')::INT)
      )
    )::SMALLINT,
    updated_at = NOW()
FROM player_team_assignments a
JOIN teams t ON t.id = a.team_id
WHERE a.player_id = p.id
  AND regexp_replace(t.age_group, '[^0-9]', '', 'g') <> ''
  AND regexp_replace(t.age_group, '[^0-9]', '', 'g') ~ '^[0-9]+$';
