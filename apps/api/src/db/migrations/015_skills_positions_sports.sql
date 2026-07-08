-- Migration 015: add sports, positions, skills, position_skills + seed.
--
-- Introduces a SystemAdmin-managed skill catalog and a sport/position taxonomy
-- with per-position M:N skill assignments. Mirrors the clubs + coach_clubs
-- shape from migration 012: same status CHECK, same created_at/updated_at
-- pattern, same ON DELETE RESTRICT for the M:N join (deleting a skill/position
-- with assignments is blocked; admin must remove assignments first).
--
-- Idempotent: a re-run is a no-op thanks to IF NOT EXISTS on table/index
-- creation and ON CONFLICT DO NOTHING on every seed INSERT. The seed uses
-- natural keys (sport.name, position.name, skill.name) plus the explicit
-- position_id lookup to wire position_skills.
--
-- The seed loads the Soccer catalog: 1 sport, 13 positions (incl. "Any
-- Position" wildcard), 29 skills, 65 per-position assignments.

CREATE TABLE IF NOT EXISTS sports (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sports_name ON sports(name);
CREATE INDEX IF NOT EXISTS idx_sports_status_name ON sports(status, name);

CREATE TABLE IF NOT EXISTS positions (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  sport_id TEXT NOT NULL REFERENCES sports(id) ON DELETE RESTRICT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (sport_id, name)
);

CREATE INDEX IF NOT EXISTS idx_positions_sport_id ON positions(sport_id);
CREATE INDEX IF NOT EXISTS idx_positions_status_name ON positions(status, name);

CREATE TABLE IF NOT EXISTS skills (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_skills_name ON skills(name);
CREATE INDEX IF NOT EXISTS idx_skills_status_name ON skills(status, name);

CREATE TABLE IF NOT EXISTS position_skills (
  position_id TEXT NOT NULL REFERENCES positions(id) ON DELETE RESTRICT,
  skill_id TEXT NOT NULL REFERENCES skills(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (position_id, skill_id)
);

CREATE INDEX IF NOT EXISTS idx_position_skills_skill_id ON position_skills(skill_id);

-- ---------------------------------------------------------------------------
-- Seed: Soccer sport + 13 positions + 29 skills + 65 position_skills rows.
-- ---------------------------------------------------------------------------

INSERT INTO sports (id, name, status)
VALUES ('sport_soccer', 'Soccer', 'active')
ON CONFLICT (name) DO NOTHING;

INSERT INTO positions (id, name, sport_id, status)
VALUES
  ('pos_any',     'Any Position',                 'sport_soccer', 'active'),
  ('pos_gk',      'GK \u2013 Goalkeeper',           'sport_soccer', 'active'),
  ('pos_rb_lb',   'RB / LB \u2013 Full-Back',       'sport_soccer', 'active'),
  ('pos_rwb_lwb', 'RWB / LWB \u2013 Wing-Back',     'sport_soccer', 'active'),
  ('pos_cb',      'CB \u2013 Centre-Back',          'sport_soccer', 'active'),
  ('pos_cdm',     'CDM \u2013 Defensive Midfielder', 'sport_soccer', 'active'),
  ('pos_cm',      'CM \u2013 Central Midfielder',    'sport_soccer', 'active'),
  ('pos_cam',     'CAM \u2013 Attacking Midfielder','sport_soccer', 'active'),
  ('pos_rm_lm',   'RM / LM \u2013 Side Midfielder',  'sport_soccer', 'active'),
  ('pos_rw_lw',   'RW / LW \u2013 Winger',           'sport_soccer', 'active'),
  ('pos_rf_lf',   'RF / LF \u2013 Wide Forward',     'sport_soccer', 'active'),
  ('pos_cf',      'CF \u2013 Centre Forward',        'sport_soccer', 'active'),
  ('pos_st',      'ST \u2013 Striker',               'sport_soccer', 'active')
ON CONFLICT (sport_id, name) DO NOTHING;

INSERT INTO skills (id, name, status)
VALUES
  ('s_acceleration',          'Acceleration',          'active'),
  ('s_aerial_control',        'Aerial control',        'active'),
  ('s_agility',               'Agility',               'active'),
  ('s_ball_control',          'Ball Control',          'active'),
  ('s_composure',             'Composure',             'active'),
  ('s_creativity',            'Creativity',            'active'),
  ('s_crossing',              'Crossing',              'active'),
  ('s_defensive_awareness',   'Defensive awareness',   'active'),
  ('s_defensive_contribution','Defensive contribution','active'),
  ('s_dribbling',             'Dribbling',             'active'),
  ('s_finishing',             'Finishing',             'active'),
  ('s_fitness',               'Fitness',               'active'),
  ('s_game_awareness',        'Game Awareness',        'active'),
  ('s_handling',              'Handling',              'active'),
  ('s_heading',               'Heading',               'active'),
  ('s_high_stamina',          'High stamina',          'active'),
  ('s_interceptions',         'Interceptions',         'active'),
  ('s_link_up_play',          'Link-up play',          'active'),
  ('s_long_shots',            'Long shots',            'active'),
  ('s_marking',               'Marking',               'active'),
  ('s_off_ball_movement',     'Off-ball movement',     'active'),
  ('s_pace',                  'Pace',                  'active'),
  ('s_passing',               'Passing',               'active'),
  ('s_positioning',           'Positioning',           'active'),
  ('s_reflexes',              'Reflexes',              'active'),
  ('s_shot_stopping',         'Shot stopping',         'active'),
  ('s_speed',                 'Speed',                 'active'),
  ('s_stamina',               'Stamina',               'active'),
  ('s_strength',              'Strength',              'active'),
  ('s_tackling',              'Tackling',              'active'),
  ('s_vision',                'Vision',                'active')
ON CONFLICT (name) DO NOTHING;

-- Per-position assignments (composite PK = (position_id, skill_id)).
INSERT INTO position_skills (position_id, skill_id)
VALUES
  -- Any Position: Ball Control, Passing, Game Awareness, Fitness, Speed
  ('pos_any', 's_ball_control'),    ('pos_any', 's_passing'),
  ('pos_any', 's_game_awareness'),  ('pos_any', 's_fitness'),
  ('pos_any', 's_speed'),
  -- GK – Goalkeeper: Shot stopping, Reflexes, Handling, Positioning, Aerial control
  ('pos_gk', 's_shot_stopping'),    ('pos_gk', 's_reflexes'),
  ('pos_gk', 's_handling'),         ('pos_gk', 's_positioning'),
  ('pos_gk', 's_aerial_control'),
  -- RB / LB – Full-Back: Tackling, Marking, Pace, Crossing, Stamina
  ('pos_rb_lb', 's_tackling'),      ('pos_rb_lb', 's_marking'),
  ('pos_rb_lb', 's_pace'),          ('pos_rb_lb', 's_crossing'),
  ('pos_rb_lb', 's_stamina'),
  -- RWB / LWB – Wing-Back: High stamina, Pace, Crossing, Defensive awareness, Dribbling
  ('pos_rwb_lwb', 's_high_stamina'),('pos_rwb_lwb', 's_pace'),
  ('pos_rwb_lwb', 's_crossing'),    ('pos_rwb_lwb', 's_defensive_awareness'),
  ('pos_rwb_lwb', 's_dribbling'),
  -- CB – Centre-Back: Strength, Heading, Tackling, Interceptions, Composure
  ('pos_cb', 's_strength'),         ('pos_cb', 's_heading'),
  ('pos_cb', 's_tackling'),         ('pos_cb', 's_interceptions'),
  ('pos_cb', 's_composure'),
  -- CDM – Defensive Midfielder: Positioning, Interceptions, Tackling, Passing, Vision
  ('pos_cdm', 's_positioning'),     ('pos_cdm', 's_interceptions'),
  ('pos_cdm', 's_tackling'),        ('pos_cdm', 's_passing'),
  ('pos_cdm', 's_vision'),
  -- CM – Central Midfielder: Passing, Ball control, Vision, Stamina, Defensive contribution
  ('pos_cm', 's_passing'),          ('pos_cm', 's_ball_control'),
  ('pos_cm', 's_vision'),           ('pos_cm', 's_stamina'),
  ('pos_cm', 's_defensive_contribution'),
  -- CAM – Attacking Midfielder: Creativity, Vision, Dribbling, Passing, Long shots
  ('pos_cam', 's_creativity'),      ('pos_cam', 's_vision'),
  ('pos_cam', 's_dribbling'),       ('pos_cam', 's_passing'),
  ('pos_cam', 's_long_shots'),
  -- RM / LM – Side Midfielder: Crossing, Pace, Off-ball movement, Dribbling, Passing
  ('pos_rm_lm', 's_crossing'),      ('pos_rm_lm', 's_pace'),
  ('pos_rm_lm', 's_off_ball_movement'), ('pos_rm_lm', 's_dribbling'),
  ('pos_rm_lm', 's_passing'),
  -- RW / LW – Winger: Acceleration, Dribbling, Crossing, Agility, Finishing
  ('pos_rw_lw', 's_acceleration'),   ('pos_rw_lw', 's_dribbling'),
  ('pos_rw_lw', 's_crossing'),      ('pos_rw_lw', 's_agility'),
  ('pos_rw_lw', 's_finishing'),
  -- RF / LF – Wide Forward: Dribbling, Finishing, Pace, Ball control, Creativity
  ('pos_rf_lf', 's_dribbling'),     ('pos_rf_lf', 's_finishing'),
  ('pos_rf_lf', 's_pace'),          ('pos_rf_lf', 's_ball_control'),
  ('pos_rf_lf', 's_creativity'),
  -- CF – Centre Forward: Vision, Creativity, Ball control, Finishing, Link-up play
  ('pos_cf', 's_vision'),           ('pos_cf', 's_creativity'),
  ('pos_cf', 's_ball_control'),     ('pos_cf', 's_finishing'),
  ('pos_cf', 's_link_up_play'),
  -- ST – Striker: Finishing, Positioning, Strength, Heading, Ball control
  ('pos_st', 's_finishing'),        ('pos_st', 's_positioning'),
  ('pos_st', 's_strength'),         ('pos_st', 's_heading'),
  ('pos_st', 's_ball_control')
ON CONFLICT (position_id, skill_id) DO NOTHING;