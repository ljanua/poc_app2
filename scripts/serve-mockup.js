const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { URL } = require('node:url');
const { Pool } = require('pg');

require('dotenv').config({ path: path.join(process.cwd(), '.env') });

const host = process.env.MOCKUP_HOST || '0.0.0.0';
const port = Number(process.env.MOCKUP_PORT || 5500);
const root = path.join(process.cwd(), 'docs', 'ux', 'mockup');
const apiPrefix = '/api/v1';
const databaseUrl = process.env.DATABASE_URL || '';
const seedDatabase = process.env.MOCKUP_DB_SEED !== 'false';

const pool = databaseUrl
  ? new Pool({
      connectionString: databaseUrl
    })
  : null;

const mimeTypes = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon'
};

function send(res, status, body, contentType) {
  res.writeHead(status, { 'Content-Type': contentType || 'text/plain; charset=utf-8' });
  res.end(body);
}

function sendJson(res, status, payload) {
  send(res, status, JSON.stringify(payload), 'application/json; charset=utf-8');
}

function normalizeLookup(value) {
  return String(value || '').trim().replace(/\s+/g, ' ');
}

function normalizeComparable(value) {
  return normalizeLookup(value).toLowerCase();
}

function toTitleCase(value) {
  return normalizeLookup(value)
    .split(' ')
    .filter(Boolean)
    .map((token) => token.charAt(0).toUpperCase() + token.slice(1).toLowerCase())
    .join(' ');
}

function toPlayerPayload(row) {
  return {
    id: row.id,
    name: row.name,
    normalizedName: row.normalizedName,
    teamName: row.teamName,
    position: row.position,
    trend: row.trend,
    updated: 'Updated just now'
  };
}

function mapTrendToGrowthStatus(trend) {
  if (trend === 'improving') {
    return 'on_track';
  }

  if (trend === 'declining') {
    return 'at_risk';
  }

  return 'watch';
}

// Derives the three Development Progress badge indicators (Current Level,
// Fitness, Skill Progress) from a player's overall trend. Used as the
// fallback for any player without a specific seeded profile below.
function getDefaultMetricChangeIndicators(trend) {
  if (trend === 'improving') {
    return {
      currentLevelChange: { label: 'Up 5%', trend: 'improving' },
      fitnessChange: { label: 'Up 2%', trend: 'improving' },
      skillProgressChange: { label: 'Up 3%', trend: 'improving' }
    };
  }

  if (trend === 'declining') {
    return {
      currentLevelChange: { label: 'Down 3%', trend: 'declining' },
      fitnessChange: { label: 'Down 2%', trend: 'declining' },
      skillProgressChange: { label: 'Down 1%', trend: 'declining' }
    };
  }

  return {
    currentLevelChange: { label: 'Stable', trend: 'plateau' },
    fitnessChange: { label: 'Stable', trend: 'plateau' },
    skillProgressChange: { label: 'Up 1%', trend: 'improving' }
  };
}

// Pre-existing defect fix (unrelated to this plan's scope, but blocked
// verification of it): none of the branches below previously set `trend` on
// the returned stats object, so upsertPlayerStats always wrote a NULL trend
// and violated player_stats' NOT NULL constraint once a player outside the
// four named seed profiles was synced.
function normalizeTrendValue(trend) {
  return trend === 'improving' || trend === 'declining' ? trend : 'plateau';
}

function buildDefaultDashboardStats(trend) {
  const normalizedTrend = normalizeTrendValue(trend);

  if (normalizedTrend === 'improving') {
    return {
      growthStatus: 'on_track',
      currentLevel: '92%',
      fitness: '87%',
      skillProgress: '94%',
      totalMinutes: 2340,
      appearances: 26,
      recentAvg: "90'",
      averageScore: 8.8,
      trend: normalizedTrend,
      lastMatchScore: 8.5,
      lastMatchSummary: 'Confident execution under pressure.',
      clipSubmittedCount: 4,
      clipAssessedCount: 3,
      clipPendingCount: 1,
      missingDataMessage: null,
      ...getDefaultMetricChangeIndicators(normalizedTrend)
    };
  }

  if (normalizedTrend === 'declining') {
    return {
      growthStatus: 'at_risk',
      currentLevel: '81%',
      fitness: '79%',
      skillProgress: '86%',
      totalMinutes: 420,
      appearances: 12,
      recentAvg: "70'",
      averageScore: null,
      trend: normalizedTrend,
      lastMatchScore: null,
      lastMatchSummary: null,
      clipSubmittedCount: 2,
      clipAssessedCount: 0,
      clipPendingCount: 2,
      missingDataMessage: 'Performance metrics are not available yet.',
      ...getDefaultMetricChangeIndicators(normalizedTrend)
    };
  }

  return {
    growthStatus: 'watch',
    currentLevel: '87%',
    fitness: '87%',
    skillProgress: '86%',
    totalMinutes: 540,
    appearances: 8,
    recentAvg: "72'",
    averageScore: 7.1,
    trend: normalizedTrend,
    lastMatchScore: 7.1,
    lastMatchSummary: 'Pace was strong, timing can improve.',
    clipSubmittedCount: 3,
    clipAssessedCount: 2,
    clipPendingCount: 1,
    missingDataMessage: null,
    ...getDefaultMetricChangeIndicators(normalizedTrend)
  };
}

function buildNewPlayerDashboardStats(trend) {
  const normalizedTrend = normalizeTrendValue(trend);

  return {
    growthStatus: mapTrendToGrowthStatus(normalizedTrend),
    currentLevel: normalizedTrend === 'declining' ? '81%' : normalizedTrend === 'improving' ? '92%' : '87%',
    fitness: normalizedTrend === 'declining' ? '79%' : '87%',
    skillProgress: normalizedTrend === 'improving' ? '94%' : '86%',
    totalMinutes: 0,
    appearances: 0,
    recentAvg: 'N/A',
    averageScore: null,
    trend: normalizedTrend,
    lastMatchScore: null,
    lastMatchSummary: null,
    clipSubmittedCount: 0,
    clipAssessedCount: 0,
    clipPendingCount: 0,
    missingDataMessage: 'Performance metrics are not available yet.',
    ...getDefaultMetricChangeIndicators(normalizedTrend)
  };
}

function getSeedDashboardStats(normalizedName, trend) {
  const normalizedTrend = normalizeTrendValue(trend);

  if (normalizedName === 'lionel messi') {
    return {
      growthStatus: 'on_track',
      currentLevel: '92%',
      fitness: '87%',
      skillProgress: '94%',
      totalMinutes: 540,
      appearances: 26,
      recentAvg: "90'",
      averageScore: 8.8,
      trend: normalizedTrend,
      lastMatchScore: 8.5,
      lastMatchSummary: 'Confident execution under pressure.',
      clipSubmittedCount: 4,
      clipAssessedCount: 3,
      clipPendingCount: 1,
      missingDataMessage: null,
      currentLevelChange: { label: 'Up 5%', trend: 'improving' },
      fitnessChange: { label: 'Stable', trend: 'plateau' },
      skillProgressChange: { label: 'Up 3%', trend: 'improving' }
    };
  }

  if (normalizedName === 'cristiano ronaldo') {
    return {
      growthStatus: 'watch',
      currentLevel: '81%',
      fitness: '79%',
      skillProgress: '86%',
      totalMinutes: 420,
      appearances: 18,
      recentAvg: "70'",
      averageScore: 7.1,
      trend: normalizedTrend,
      lastMatchScore: 7.1,
      lastMatchSummary: 'Pace was strong, timing can improve.',
      clipSubmittedCount: 3,
      clipAssessedCount: 2,
      clipPendingCount: 1,
      missingDataMessage: null,
      currentLevelChange: { label: 'Stable', trend: 'plateau' },
      fitnessChange: { label: 'Down 2%', trend: 'declining' },
      skillProgressChange: { label: 'Up 1%', trend: 'improving' }
    };
  }

  if (normalizedName === 'neymar jr') {
    return {
      growthStatus: 'at_risk',
      currentLevel: '87%',
      fitness: '83%',
      skillProgress: '90%',
      totalMinutes: 0,
      appearances: 0,
      recentAvg: 'N/A',
      averageScore: null,
      trend: normalizedTrend,
      lastMatchScore: null,
      lastMatchSummary: null,
      clipSubmittedCount: 1,
      clipAssessedCount: 0,
      clipPendingCount: 1,
      missingDataMessage: 'Performance metrics are not available yet.',
      currentLevelChange: { label: 'Down 3%', trend: 'declining' },
      fitnessChange: { label: 'Down 4%', trend: 'declining' },
      skillProgressChange: { label: 'Stable', trend: 'plateau' }
    };
  }

  if (normalizedName === 'kylian mbappe') {
    return {
      growthStatus: 'on_track',
      currentLevel: '94%',
      fitness: '91%',
      skillProgress: '95%',
      totalMinutes: 1980,
      appearances: 24,
      recentAvg: "88'",
      averageScore: 8.5,
      trend: normalizedTrend,
      lastMatchScore: 8.9,
      lastMatchSummary: 'Strong finishing and recovery runs.',
      clipSubmittedCount: 2,
      clipAssessedCount: 1,
      clipPendingCount: 1,
      missingDataMessage: null,
      currentLevelChange: { label: 'Up 4%', trend: 'improving' },
      fitnessChange: { label: 'Up 2%', trend: 'improving' },
      skillProgressChange: { label: 'Up 4%', trend: 'improving' }
    };
  }

  return buildDefaultDashboardStats(trend);
}

function toMetricChangeIndicator(label, trendValue, fallbackTrend) {
  return {
    label: label || 'N/A',
    trend: trendValue || fallbackTrend || 'plateau'
  };
}

function toDashboardPayload(row) {
  const averageScore = row.averageScore === null || row.averageScore === undefined ? 'N/A' : Number(row.averageScore).toFixed(1);
  const lastMatchScore = row.lastMatchScore === null || row.lastMatchScore === undefined ? 'N/A' : Number(row.lastMatchScore).toFixed(1);
  const currentLevelChange = toMetricChangeIndicator(row.currentLevelChangeLabel, row.currentLevelChangeTrend, row.trend);
  const fitnessChange = toMetricChangeIndicator(row.fitnessChangeLabel, row.fitnessChangeTrend, row.trend);
  const skillProgressChange = toMetricChangeIndicator(row.skillProgressChangeLabel, row.skillProgressChangeTrend, row.trend);

  return {
    player: {
      id: row.id,
      name: row.name,
      normalizedName: row.normalizedName,
      teamName: row.teamName,
      position: row.position,
      trend: row.trend,
      updated: 'Updated just now'
    },
    stats: {
      growthStatus: row.growthStatus || mapTrendToGrowthStatus(row.trend),
      currentLevel: row.currentLevel || 'N/A',
      fitness: row.fitness || 'N/A',
      skillProgress: row.skillProgress || 'N/A',
      totalMinutes: Number(row.totalMinutes || 0),
      appearances: Number(row.appearances || 0),
      recentAvg: row.recentAvg || 'N/A',
      averageScore: row.averageScore === null || row.averageScore === undefined ? null : Number(row.averageScore),
      trend: row.trend,
      lastMatchScore: row.lastMatchScore === null || row.lastMatchScore === undefined ? null : Number(row.lastMatchScore),
      lastMatchSummary: row.lastMatchSummary || null,
      clipSubmittedCount: Number(row.clipSubmittedCount || 0),
      clipAssessedCount: Number(row.clipAssessedCount || 0),
      clipPendingCount: Number(row.clipPendingCount || 0),
      missingDataMessage: row.missingDataMessage || null,
      currentLevelChange,
      fitnessChange,
      skillProgressChange
    },
    metrics: {
      currentLevel: row.currentLevel || 'N/A',
      fitness: row.fitness || 'N/A',
      skillProgress: row.skillProgress || 'N/A',
      currentLevelChange,
      fitnessChange,
      skillProgressChange
    },
    matchTime: {
      totalMinutes: Number(row.totalMinutes || 0),
      appearances: Number(row.appearances || 0),
      recentAvg: row.recentAvg || 'N/A'
    },
    performance: {
      averageScore,
      trend: row.trend || 'plateau',
      lastMatchScore,
      lastMatchSummary: row.lastMatchSummary || null,
      missingDataMessage: row.missingDataMessage || null
    },
    clipStats: {
      submitted: Number(row.clipSubmittedCount || 0),
      assessed: Number(row.clipAssessedCount || 0),
      pending: Number(row.clipPendingCount || 0)
    }
  };
}

async function upsertPlayerStats(executor, playerId, stats) {
  await executor.query(
    `
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
        missing_data_message,
        current_level_change_label,
        current_level_change_trend,
        fitness_change_label,
        fitness_change_trend,
        skill_progress_change_label,
        skill_progress_change_trend,
        updated_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, NOW())
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
        current_level_change_label = EXCLUDED.current_level_change_label,
        current_level_change_trend = EXCLUDED.current_level_change_trend,
        fitness_change_label = EXCLUDED.fitness_change_label,
        fitness_change_trend = EXCLUDED.fitness_change_trend,
        skill_progress_change_label = EXCLUDED.skill_progress_change_label,
        skill_progress_change_trend = EXCLUDED.skill_progress_change_trend,
        updated_at = NOW()
    `,
    [
      playerId,
      stats.growthStatus,
      stats.currentLevel,
      stats.fitness,
      stats.skillProgress,
      stats.totalMinutes,
      stats.appearances,
      stats.recentAvg,
      stats.averageScore,
      stats.trend,
      stats.lastMatchScore,
      stats.lastMatchSummary,
      stats.clipSubmittedCount,
      stats.clipAssessedCount,
      stats.clipPendingCount,
      stats.missingDataMessage,
      stats.currentLevelChange ? stats.currentLevelChange.label : null,
      stats.currentLevelChange ? stats.currentLevelChange.trend : null,
      stats.fitnessChange ? stats.fitnessChange.label : null,
      stats.fitnessChange ? stats.fitnessChange.trend : null,
      stats.skillProgressChange ? stats.skillProgressChange.label : null,
      stats.skillProgressChange ? stats.skillProgressChange.trend : null
    ]
  );
}

async function syncDefaultDashboardStats(executor) {
  const result = await executor.query(`SELECT id, name, normalized_name AS "normalizedName", trend FROM players ORDER BY name ASC`);
  for (const player of result.rows) {
    await upsertPlayerStats(executor, player.id, getSeedDashboardStats(player.normalizedName, player.trend));
  }
}

function toUserPayload(row) {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    role: row.role,
    status: row.status,
    lastLogin: row.lastLogin || row.last_login_label || row.lastLoginLabel || null,
    password: row.password || row.password_hash || row.passwordHash || ''
  };
}

function toTeamPayload(row) {
  return {
    id: row.id,
    name: row.name,
    ageGroup: row.ageGroup || row.age_group,
    leadCoach: row.leadCoach || row.lead_coach,
    leadCoachEmail: row.leadCoachEmail || row.lead_coach_email || null,
    leadCoachUserId: row.leadCoachUserId || row.lead_coach_user_id || null,
    playerCount: Number(row.playerCount || 0)
  };
}

function appError(status, code, message) {
  return { status, code, message };
}

function resolveTarget(urlPath) {
  if (urlPath === '/' || urlPath === '') {
    return path.join(root, 'index.html');
  }

  const cleanPath = decodeURIComponent(urlPath.split('?')[0]);
  const normalized = cleanPath.replace(/^\/+/, '');

  if (!path.extname(normalized)) {
    const htmlCandidate = path.join(root, `${normalized}.html`);
    if (fs.existsSync(htmlCandidate) && fs.statSync(htmlCandidate).isFile()) {
      return htmlCandidate;
    }
  }

  const filePath = path.join(root, normalized);
  if (fs.existsSync(filePath) && fs.statSync(filePath).isDirectory()) {
    return path.join(filePath, 'index.html');
  }

  return filePath;
}

function isInsideRoot(filePath) {
  const rel = path.relative(root, filePath);
  return rel && !rel.startsWith('..') && !path.isAbsolute(rel);
}

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (chunk) => chunks.push(chunk));
    req.on('end', () => {
      if (!chunks.length) {
        resolve({});
        return;
      }

      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')));
      } catch (error) {
        reject(error);
      }
    });
    req.on('error', reject);
  });
}

async function ensureDatabase() {
  if (!pool) {
    return;
  }

  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      role TEXT NOT NULL CHECK (role IN ('SystemAdmin', 'Coach')),
      status TEXT NOT NULL DEFAULT 'active',
      password_hash TEXT,
      last_login_label TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      deactivated_at TIMESTAMPTZ
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS teams (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      age_group TEXT NOT NULL,
      lead_coach_user_id TEXT NOT NULL REFERENCES users(id),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS players (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      normalized_name TEXT NOT NULL UNIQUE,
      position TEXT NOT NULL DEFAULT 'Position not set',
      trend TEXT NOT NULL DEFAULT 'plateau',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS player_team_assignments (
      player_id TEXT PRIMARY KEY REFERENCES players(id) ON DELETE CASCADE,
      team_id TEXT NOT NULL REFERENCES teams(id),
      assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await pool.query(`CREATE INDEX IF NOT EXISTS idx_players_normalized_name ON players(normalized_name);`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_player_team_assignments_team_id ON player_team_assignments(team_id);`);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS clips (
      id TEXT PRIMARY KEY,
      player_id TEXT NOT NULL REFERENCES players(id) ON DELETE CASCADE,
      situation TEXT NOT NULL,
      status TEXT NOT NULL CHECK (status IN ('pending', 'assessed')),
      score NUMERIC(4,2),
      summary TEXT,
      submitted_at_label TEXT,
      skill TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_clips_player_id ON clips(player_id);`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_clips_status ON clips(status);`);
  await pool.query(`
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
      current_level_change_label TEXT,
      current_level_change_trend TEXT CHECK (current_level_change_trend IN ('improving', 'plateau', 'declining')),
      fitness_change_label TEXT,
      fitness_change_trend TEXT CHECK (fitness_change_trend IN ('improving', 'plateau', 'declining')),
      skill_progress_change_label TEXT,
      skill_progress_change_trend TEXT CHECK (skill_progress_change_trend IN ('improving', 'plateau', 'declining')),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_player_stats_trend ON player_stats(trend);`);
  // Upgrade path for databases where player_stats already existed before these columns were added.
  await pool.query(`ALTER TABLE player_stats ADD COLUMN IF NOT EXISTS current_level_change_label TEXT;`);
  await pool.query(`ALTER TABLE player_stats ADD COLUMN IF NOT EXISTS current_level_change_trend TEXT CHECK (current_level_change_trend IN ('improving', 'plateau', 'declining'));`);
  await pool.query(`ALTER TABLE player_stats ADD COLUMN IF NOT EXISTS fitness_change_label TEXT;`);
  await pool.query(`ALTER TABLE player_stats ADD COLUMN IF NOT EXISTS fitness_change_trend TEXT CHECK (fitness_change_trend IN ('improving', 'plateau', 'declining'));`);
  await pool.query(`ALTER TABLE player_stats ADD COLUMN IF NOT EXISTS skill_progress_change_label TEXT;`);
  await pool.query(`ALTER TABLE player_stats ADD COLUMN IF NOT EXISTS skill_progress_change_trend TEXT CHECK (skill_progress_change_trend IN ('improving', 'plateau', 'declining'));`);

  if (seedDatabase) {
    await pool.query(`
      INSERT INTO users (id, name, email, role, status, password_hash, last_login_label)
      VALUES
        ('u_admin_maria', 'Maria Alves', 'maria@vantageiq.club', 'SystemAdmin', 'active', 'SecurePass123', 'Today, 08:31'),
        ('u_coach_joao', 'Joao Lima', 'joao@vantageiq.club', 'Coach', 'active', 'SecurePass123', 'Yesterday'),
        ('u_coach_ana', 'Ana Costa', 'ana@vantageiq.club', 'Coach', 'inactive', 'SecurePass123', '6 days ago')
      ON CONFLICT (id) DO NOTHING;
    `);

    await pool.query(`
      INSERT INTO teams (id, name, age_group, lead_coach_user_id)
      VALUES
        ('t_u17', 'U17 Elite', 'U17', 'u_coach_ana'),
        ('t_u19', 'U19 Prime', 'U19', 'u_coach_joao'),
        ('t_senior', 'Senior Squad', '18+', 'u_admin_maria')
      ON CONFLICT (id) DO NOTHING;
    `);

    await pool.query(`
      INSERT INTO players (id, name, normalized_name, position, trend)
      VALUES
        ('p_10', 'Lionel Messi', 'lionel messi', 'Forward - Left Wing', 'improving'),
        ('p_11', 'Cristiano Ronaldo', 'cristiano ronaldo', 'Forward - Center Forward', 'plateau'),
        ('p_12', 'Neymar Jr', 'neymar jr', 'Forward - Right Wing', 'declining'),
        ('p_13', 'Kylian Mbappe', 'kylian mbappe', 'Forward - Center Forward', 'improving')
      ON CONFLICT (id) DO NOTHING;
    `);

    await pool.query(`
      INSERT INTO player_team_assignments (player_id, team_id)
      VALUES
        ('p_10', 't_u19'),
        ('p_11', 't_senior'),
        ('p_12', 't_u17'),
        ('p_13', 't_senior')
      ON CONFLICT (player_id) DO NOTHING;
    `);

    await pool.query(`
      INSERT INTO clips (id, player_id, situation, status, score, summary, submitted_at_label, skill)
      VALUES
        ('c_1', 'p_10', 'Penalty kick attempt, 3rd minute', 'assessed', 4.2, 'Confident execution under pressure.', '2 hours ago', 'Decision-making'),
        ('c_2', 'p_11', 'Counter-attack, left wing run', 'assessed', 3.8, 'Pace was strong, timing can improve.', '5 hours ago', 'Pace & Agility'),
        ('c_3', 'p_12', 'One-on-one with goalkeeper', 'assessed', 4.5, 'Excellent control and composure.', '1 day ago', 'Technical Skill'),
        ('c_4', 'p_13', 'Sprint and finish, 45th minute', 'pending', NULL, '', 'Submitted 1 hour ago', 'Pace & Agility')
      ON CONFLICT (id) DO NOTHING;
    `);
  }

  await syncDefaultDashboardStats(pool);
}

async function listPlayers(teamName, query) {
  const values = [];
  const predicates = [];

  if (teamName && teamName !== 'all') {
    values.push(teamName);
    predicates.push(`t.name = $${values.length}`);
  }

  if (query) {
    values.push(`%${query}%`);
    predicates.push(`(LOWER(p.name) LIKE LOWER($${values.length}) OR LOWER(p.position) LIKE LOWER($${values.length}))`);
  }

  const whereSql = predicates.length ? `WHERE ${predicates.join(' AND ')}` : '';

  const result = await pool.query(
    `
      SELECT
        p.id,
        p.name,
        p.normalized_name AS "normalizedName",
        t.name AS "teamName",
        p.position,
        p.trend
      FROM players p
      JOIN player_team_assignments a ON a.player_id = p.id
      JOIN teams t ON t.id = a.team_id
      ${whereSql}
      ORDER BY p.name ASC
    `,
    values
  );

  return result.rows.map(toPlayerPayload);
}

async function findTeamByName(teamName) {
  const result = await pool.query(`SELECT id, name FROM teams WHERE LOWER(name) = LOWER($1) LIMIT 1`, [teamName]);
  return result.rows[0] || null;
}

async function findPlayerById(playerId, executor = pool) {
  const result = await executor.query(
    `
      SELECT
        p.id,
        p.name,
        p.normalized_name AS "normalizedName",
        t.name AS "teamName",
        p.position,
        p.trend
      FROM players p
      JOIN player_team_assignments a ON a.player_id = p.id
      JOIN teams t ON t.id = a.team_id
      WHERE p.id = $1
      LIMIT 1
    `,
    [playerId]
  );
  return result.rows[0] ? toPlayerPayload(result.rows[0]) : null;
}

async function handlePlayersApi(req, res, requestUrl) {
  console.log('API request', req.method, requestUrl.pathname);

  if (!pool) {
    sendJson(res, 503, appError(503, 'service_unavailable', 'DATABASE_URL is not configured for backend persistence.'));
    return;
  }

  if (req.method === 'GET' && requestUrl.pathname === `${apiPrefix}/health`) {
    sendJson(res, 200, { status: 'ok', mode: 'database' });
    return;
  }

  if (req.method === 'GET' && requestUrl.pathname === `${apiPrefix}/players/dashboard`) {
    const playerName = normalizeLookup(requestUrl.searchParams.get('playerName') || requestUrl.searchParams.get('player') || '');
    const actorEmail = String(requestUrl.searchParams.get('actorEmail') || '').trim().toLowerCase();

    const actorResult = await pool.query(`SELECT id, name, email, role, status FROM users WHERE LOWER(email) = LOWER($1) LIMIT 1`, [actorEmail]);
    const actor = actorResult.rows[0] || null;
    if (!actor || actor.role !== 'Coach' || actor.status !== 'active') {
      sendJson(res, 403, appError(403, 'forbidden', 'You do not have permission to perform this action.'));
      return;
    }

    const dashboardRows = await pool.query(
      `
        SELECT
          p.id,
          p.name,
          p.normalized_name AS "normalizedName",
          t.name AS "teamName",
          p.position,
          p.trend,
          ps.growth_status AS "growthStatus",
          ps.current_level AS "currentLevel",
          ps.fitness,
          ps.skill_progress AS "skillProgress",
          ps.total_minutes AS "totalMinutes",
          ps.appearances,
          ps.recent_avg AS "recentAvg",
          ps.average_score AS "averageScore",
          ps.last_match_score AS "lastMatchScore",
          ps.last_match_summary AS "lastMatchSummary",
          ps.clip_submitted_count AS "clipSubmittedCount",
          ps.clip_assessed_count AS "clipAssessedCount",
          ps.clip_pending_count AS "clipPendingCount",
          ps.missing_data_message AS "missingDataMessage",
          ps.current_level_change_label AS "currentLevelChangeLabel",
          ps.current_level_change_trend AS "currentLevelChangeTrend",
          ps.fitness_change_label AS "fitnessChangeLabel",
          ps.fitness_change_trend AS "fitnessChangeTrend",
          ps.skill_progress_change_label AS "skillProgressChangeLabel",
          ps.skill_progress_change_trend AS "skillProgressChangeTrend"
        FROM players p
        JOIN player_team_assignments a ON a.player_id = p.id
        JOIN teams t ON t.id = a.team_id
        JOIN users coach ON coach.id = t.lead_coach_user_id
        LEFT JOIN player_stats ps ON ps.player_id = p.id
        WHERE coach.id = $2
          AND ($1 = '' OR LOWER(p.name) = LOWER($1) OR LOWER(p.normalized_name) = LOWER($1) OR p.id = $1)
        ORDER BY p.name ASC
        LIMIT 1
      `,
      [playerName, actor.id]
    );

    if (!dashboardRows.rows[0]) {
      sendJson(res, 404, appError(404, 'not_found', 'The selected player was not found anymore. Refresh and try again.'));
      return;
    }

    sendJson(res, 200, { data: toDashboardPayload(dashboardRows.rows[0]) });
    return;
  }

  if (req.method === 'GET' && requestUrl.pathname === `${apiPrefix}/teams`) {
    const teamRows = await pool.query(`
      SELECT
        t.id,
        t.name,
        t.age_group AS "ageGroup",
        t.lead_coach_user_id AS "leadCoachUserId",
        u.name AS "leadCoach",
        u.email AS "leadCoachEmail",
        COUNT(a.player_id) AS "playerCount"
      FROM teams t
      LEFT JOIN users u ON u.id = t.lead_coach_user_id
      LEFT JOIN player_team_assignments a ON a.team_id = t.id
      GROUP BY t.id, t.name, t.age_group, t.lead_coach_user_id, u.name, u.email
      ORDER BY t.name ASC
    `);

    sendJson(res, 200, { data: teamRows.rows.map(toTeamPayload) });
    return;
  }

  if (req.method === 'POST' && requestUrl.pathname === `${apiPrefix}/teams`) {
    const payload = await readJsonBody(req);
    const actorEmail = String(payload.actorEmail || '').trim().toLowerCase();
    const actorRole = String(payload.actorRole || '').trim();
    const teamName = toTitleCase(payload.name);
    const ageGroup = normalizeLookup(payload.ageGroup);

    let actorUser = null;
    if (actorEmail) {
      const actorResult = await pool.query(`SELECT id, name, email, role, status FROM users WHERE LOWER(email) = LOWER($1) LIMIT 1`, [actorEmail]);
      actorUser = actorResult.rows[0] || null;
    }

    const effectiveRole = actorUser ? actorUser.role : actorRole;
    if (!['SystemAdmin', 'Coach'].includes(effectiveRole) || !actorUser || actorUser.status !== 'active') {
      sendJson(res, 403, appError(403, 'forbidden', 'You do not have permission to perform this action.'));
      return;
    }

    if (!teamName || teamName.length < 2 || !ageGroup) {
      sendJson(res, 400, appError(400, 'validation_error', 'Please review the form fields and try again.'));
      return;
    }

    const duplicate = await pool.query(`SELECT id FROM teams WHERE LOWER(name) = LOWER($1) LIMIT 1`, [teamName]);
    if (duplicate.rows[0]) {
      sendJson(res, 409, appError(409, 'conflict', 'A user with the same identifier already exists.'));
      return;
    }

    let leadCoachUserId = actorUser.id;
    if (effectiveRole === 'SystemAdmin') {
      const selectedCoachEmail = String(payload.coachEmail || '').trim().toLowerCase();
      if (!selectedCoachEmail) {
        sendJson(res, 400, appError(400, 'validation_error', 'Please review the form fields and try again.'));
        return;
      }

      const selectedCoach = await pool.query(`SELECT id, name, email, role, status FROM users WHERE LOWER(email) = LOWER($1) AND role = 'Coach' AND status = 'active' LIMIT 1`, [selectedCoachEmail]);
      if (!selectedCoach.rows[0]) {
        sendJson(res, 400, appError(400, 'validation_error', 'Please review the form fields and try again.'));
        return;
      }

      leadCoachUserId = selectedCoach.rows[0].id;
    }

    const teamId = `t_${Date.now()}_${Math.floor(Math.random() * 10000)}`;
    await pool.query(
      `INSERT INTO teams (id, name, age_group, lead_coach_user_id) VALUES ($1, $2, $3, $4)`,
      [teamId, teamName, ageGroup, leadCoachUserId]
    );

    const created = await pool.query(`
      SELECT
        t.id,
        t.name,
        t.age_group AS "ageGroup",
        t.lead_coach_user_id AS "leadCoachUserId",
        u.name AS "leadCoach",
        u.email AS "leadCoachEmail",
        COUNT(a.player_id) AS "playerCount"
      FROM teams t
      LEFT JOIN users u ON u.id = t.lead_coach_user_id
      LEFT JOIN player_team_assignments a ON a.team_id = t.id
      WHERE t.id = $1
      GROUP BY t.id, t.name, t.age_group, t.lead_coach_user_id, u.name, u.email
      LIMIT 1
    `, [teamId]);

    sendJson(res, 201, { data: toTeamPayload(created.rows[0]) });
    return;
  }

  if (req.method === 'POST' && requestUrl.pathname === `${apiPrefix}/teams/coach`) {
    const payload = await readJsonBody(req);
    const actorEmail = String(payload.actorEmail || '').trim().toLowerCase();
    const actorRole = String(payload.actorRole || '').trim();
    const teamName = normalizeLookup(payload.teamName);
    const coachEmail = String(payload.coachEmail || '').trim().toLowerCase();

    let actorUser = null;
    if (actorEmail) {
      const actorResult = await pool.query(`SELECT id, name, email, role, status FROM users WHERE LOWER(email) = LOWER($1) LIMIT 1`, [actorEmail]);
      actorUser = actorResult.rows[0] || null;
    }

    const effectiveRole = actorUser ? actorUser.role : actorRole;
    if (!['SystemAdmin', 'Coach'].includes(effectiveRole) || !actorUser || actorUser.status !== 'active') {
      sendJson(res, 403, appError(403, 'forbidden', 'You do not have permission to perform this action.'));
      return;
    }

    if (!teamName || !coachEmail) {
      sendJson(res, 400, appError(400, 'validation_error', 'Please review the form fields and try again.'));
      return;
    }

    const coach = await pool.query(`SELECT id, name, email, role, status FROM users WHERE LOWER(email) = LOWER($1) AND role = 'Coach' AND status = 'active' LIMIT 1`, [coachEmail]);
    if (!coach.rows[0]) {
      sendJson(res, 400, appError(400, 'validation_error', 'Please review the form fields and try again.'));
      return;
    }

    const team = await pool.query(`SELECT id, name, age_group AS "ageGroup", lead_coach_user_id AS "leadCoachUserId" FROM teams WHERE LOWER(name) = LOWER($1) LIMIT 1`, [teamName]);
    if (!team.rows[0]) {
      sendJson(res, 404, appError(404, 'not_found', 'The selected team was not found anymore. Refresh and try again.'));
      return;
    }

    await pool.query(`UPDATE teams SET lead_coach_user_id = $1, updated_at = NOW() WHERE id = $2`, [coach.rows[0].id, team.rows[0].id]);

    const updated = await pool.query(`
      SELECT
        t.id,
        t.name,
        t.age_group AS "ageGroup",
        t.lead_coach_user_id AS "leadCoachUserId",
        u.name AS "leadCoach",
        u.email AS "leadCoachEmail",
        COUNT(a.player_id) AS "playerCount"
      FROM teams t
      LEFT JOIN users u ON u.id = t.lead_coach_user_id
      LEFT JOIN player_team_assignments a ON a.team_id = t.id
      WHERE t.id = $1
      GROUP BY t.id, t.name, t.age_group, t.lead_coach_user_id, u.name, u.email
      LIMIT 1
    `, [team.rows[0].id]);

    sendJson(res, 200, { data: toTeamPayload(updated.rows[0]) });
    return;
  }

  if (req.method === 'GET' && requestUrl.pathname === `${apiPrefix}/users`) {
    const requestedEmail = (requestUrl.searchParams.get('email') || '').trim().toLowerCase();
    const userRows = await pool.query(`
      SELECT
        id,
        name,
        email,
        role,
        status,
        password_hash AS "passwordHash",
        last_login_label AS "lastLogin"
      FROM users
      ${requestedEmail ? `WHERE LOWER(email) = LOWER($1)` : ''}
      ORDER BY name ASC
    `, requestedEmail ? [requestedEmail] : []);

    sendJson(res, 200, { data: userRows.rows.map(toUserPayload) });
    return;
  }

  if (req.method === 'POST' && requestUrl.pathname === `${apiPrefix}/users`) {
    const payload = await readJsonBody(req);
    const actorRole = String(payload.actorRole || '').trim();
    if (actorRole !== 'SystemAdmin') {
      sendJson(res, 403, appError(403, 'forbidden', 'You do not have permission to perform this action.'));
      return;
    }

    const email = String(payload.email || '').trim().toLowerCase();
    const name = normalizeLookup(payload.name);
    const role = String(payload.role || '').trim();
    const password = String(payload.password || '').trim();
    const hasNumber = /\d/.test(password);

    if (!name || !email.includes('@') || !['SystemAdmin', 'Coach'].includes(role) || password.length < 10 || !hasNumber) {
      sendJson(res, 400, appError(400, 'validation_error', 'Please review the form fields and try again.'));
      return;
    }

    const existing = await pool.query(`SELECT id FROM users WHERE LOWER(email) = LOWER($1) LIMIT 1`, [email]);
    if (existing.rows[0]) {
      sendJson(res, 409, appError(409, 'conflict', 'A user with the same identifier already exists.'));
      return;
    }

    const userId = `u_${Date.now()}_${Math.floor(Math.random() * 10000)}`;
    await pool.query(`
      INSERT INTO users (id, name, email, role, status, password_hash, last_login_label)
      VALUES ($1, $2, $3, $4, 'active', $5, 'Just now')
    `, [userId, name, email, role, password]);

    const created = await pool.query(`SELECT id, name, email, role, status, password_hash AS "passwordHash", last_login_label AS "lastLogin" FROM users WHERE id = $1 LIMIT 1`, [userId]);
    sendJson(res, 201, { data: toUserPayload(created.rows[0]) });
    return;
  }

  if (req.method === 'POST' && requestUrl.pathname.match(/^\/api\/v1\/users\/([^/]+)\/role$/)) {
    const match = requestUrl.pathname.match(/^\/api\/v1\/users\/([^/]+)\/role$/);
    const email = decodeURIComponent(match[1]);
    const payload = await readJsonBody(req);
    const actorRole = String(payload.actorRole || '').trim();
    if (actorRole !== 'SystemAdmin') {
      sendJson(res, 403, appError(403, 'forbidden', 'You do not have permission to perform this action.'));
      return;
    }

    const role = String(payload.role || '').trim();
    if (!['SystemAdmin', 'Coach'].includes(role)) {
      sendJson(res, 400, appError(400, 'validation_error', 'Please review the form fields and try again.'));
      return;
    }

    const updated = await pool.query(`UPDATE users SET role = $1, updated_at = NOW() WHERE LOWER(email) = LOWER($2) RETURNING id, name, email, role, status, password_hash AS "passwordHash", last_login_label AS "lastLogin"`, [role, email]);
    if (!updated.rows[0]) {
      sendJson(res, 404, appError(404, 'not_found', 'The selected user was not found anymore. Refresh and try again.'));
      return;
    }

    sendJson(res, 200, { data: toUserPayload(updated.rows[0]) });
    return;
  }

  if (req.method === 'POST' && requestUrl.pathname.match(/^\/api\/v1\/users\/([^/]+)\/password$/)) {
    const match = requestUrl.pathname.match(/^\/api\/v1\/users\/([^/]+)\/password$/);
    const email = decodeURIComponent(match[1]);
    const payload = await readJsonBody(req);
    const actorRole = String(payload.actorRole || '').trim();
    if (actorRole !== 'SystemAdmin') {
      sendJson(res, 403, appError(403, 'forbidden', 'You do not have permission to perform this action.'));
      return;
    }

    const password = String(payload.password || '').trim();
    const confirmPassword = String(payload.confirmPassword || '').trim();
    const hasNumber = /\d/.test(password);

    if (password.length < 10 || !hasNumber || password !== confirmPassword) {
      sendJson(res, 400, appError(400, 'validation_error', 'Please review the form fields and try again.'));
      return;
    }

    const updated = await pool.query(`UPDATE users SET password_hash = $1, updated_at = NOW() WHERE LOWER(email) = LOWER($2) RETURNING id, name, email, role, status, password_hash AS "passwordHash", last_login_label AS "lastLogin"`, [password, email]);
    if (!updated.rows[0]) {
      sendJson(res, 404, appError(404, 'not_found', 'The selected user was not found anymore. Refresh and try again.'));
      return;
    }

    sendJson(res, 200, { data: toUserPayload(updated.rows[0]) });
    return;
  }

  if (req.method === 'POST' && requestUrl.pathname.match(/^\/api\/v1\/users\/([^/]+)\/deactivate$/)) {
    const match = requestUrl.pathname.match(/^\/api\/v1\/users\/([^/]+)\/deactivate$/);
    const email = decodeURIComponent(match[1]);
    const payload = await readJsonBody(req);
    const actorRole = String(payload.actorRole || '').trim();
    if (actorRole !== 'SystemAdmin') {
      sendJson(res, 403, appError(403, 'forbidden', 'You do not have permission to perform this action.'));
      return;
    }

    const updated = await pool.query(`UPDATE users SET status = 'inactive', updated_at = NOW() WHERE LOWER(email) = LOWER($1) RETURNING id, name, email, role, status, password_hash AS "passwordHash", last_login_label AS "lastLogin"`, [email]);
    if (!updated.rows[0]) {
      sendJson(res, 404, appError(404, 'not_found', 'The selected user was not found anymore. Refresh and try again.'));
      return;
    }

    sendJson(res, 200, { data: toUserPayload(updated.rows[0]) });
    return;
  }

  if (req.method === 'POST' && requestUrl.pathname.match(/^\/api\/v1\/users\/([^/]+)\/reactivate$/)) {
    const match = requestUrl.pathname.match(/^\/api\/v1\/users\/([^/]+)\/reactivate$/);
    const email = decodeURIComponent(match[1]);
    const payload = await readJsonBody(req);
    const actorRole = String(payload.actorRole || '').trim();
    if (actorRole !== 'SystemAdmin') {
      sendJson(res, 403, appError(403, 'forbidden', 'You do not have permission to perform this action.'));
      return;
    }

    const updated = await pool.query(`UPDATE users SET status = 'active', updated_at = NOW() WHERE LOWER(email) = LOWER($1) RETURNING id, name, email, role, status, password_hash AS "passwordHash", last_login_label AS "lastLogin"`, [email]);
    if (!updated.rows[0]) {
      sendJson(res, 404, appError(404, 'not_found', 'The selected user was not found anymore. Refresh and try again.'));
      return;
    }

    sendJson(res, 200, { data: toUserPayload(updated.rows[0]) });
    return;
  }

  if (req.method === 'POST' && requestUrl.pathname === `${apiPrefix}/auth/login`) {
    const payload = await readJsonBody(req);
    const email = String(payload.email || '').trim().toLowerCase();
    const password = String(payload.password || '').trim();
    const row = await pool.query(`SELECT id, name, email, role, status, password_hash AS "passwordHash", last_login_label AS "lastLogin" FROM users WHERE LOWER(email) = LOWER($1) LIMIT 1`, [email]);

    if (!row.rows[0] || row.rows[0].status !== 'active' || row.rows[0].passwordHash !== password) {
      sendJson(res, 403, appError(403, 'forbidden', 'You do not have permission to perform this action.'));
      return;
    }

    await pool.query(`UPDATE users SET last_login_label = $1, updated_at = NOW() WHERE id = $2`, ['Just now', row.rows[0].id]);
    const user = toUserPayload({ ...row.rows[0], lastLogin: 'Just now' });
    sendJson(res, 200, { token: 'jwt-' + user.role.toLowerCase(), role: user.role, user });
    return;
  }

  if (req.method === 'GET' && requestUrl.pathname === `${apiPrefix}/clips`) {
    const teamName = normalizeLookup(requestUrl.searchParams.get('teamName') || 'all');
    const status = normalizeLookup(requestUrl.searchParams.get('status') || 'all');
    const query = `
      SELECT
        c.id,
        c.player_id AS "playerId",
        c.situation,
        c.status,
        c.score,
        c.summary,
        c.submitted_at_label AS "submittedAt",
        c.skill,
        p.name AS "playerName",
        t.name AS "teamName"
      FROM clips c
      JOIN players p ON p.id = c.player_id
      LEFT JOIN player_team_assignments a ON a.player_id = p.id
      LEFT JOIN teams t ON t.id = a.team_id
      ${teamName !== 'all' ? `WHERE LOWER(t.name) = LOWER($1)` : ''}
      ${status !== 'all' ? `${teamName !== 'all' ? 'AND' : 'WHERE'} LOWER(c.status) = LOWER($${teamName !== 'all' ? 2 : 1})` : ''}
      ORDER BY c.created_at DESC
    `;
    const values = teamName !== 'all' ? [teamName] : [];
    if (status !== 'all') {
      values.push(status);
    }
    const clipRows = await pool.query(query, values);
    sendJson(res, 200, { data: clipRows.rows });
    return;
  }

  if (req.method === 'POST' && requestUrl.pathname === `${apiPrefix}/clips`) {
    const payload = await readJsonBody(req);
    const playerName = normalizeLookup(payload.playerName);
    const situation = normalizeLookup(payload.situation);
    const skill = normalizeLookup(payload.skill || 'General');

    if (!playerName || !situation) {
      sendJson(res, 400, appError(400, 'validation_error', 'Please review the form fields and try again.'));
      return;
    }

    const player = await pool.query(`SELECT id FROM players WHERE LOWER(name) = LOWER($1) LIMIT 1`, [playerName]);
    if (!player.rows[0]) {
      sendJson(res, 404, appError(404, 'not_found', 'The selected player was not found anymore. Refresh and try again.'));
      return;
    }

    const clipId = `c_${Date.now()}_${Math.floor(Math.random() * 10000)}`;
    await pool.query(`
      INSERT INTO clips (id, player_id, situation, status, score, summary, submitted_at_label, skill)
      VALUES ($1, $2, $3, 'pending', NULL, '', 'Submitted just now', $4)
    `, [clipId, player.rows[0].id, situation, skill]);

    const created = await pool.query(`
      SELECT
        c.id,
        c.player_id AS "playerId",
        c.situation,
        c.status,
        c.score,
        c.summary,
        c.submitted_at_label AS "submittedAt",
        c.skill,
        p.name AS "playerName",
        t.name AS "teamName"
      FROM clips c
      JOIN players p ON p.id = c.player_id
      LEFT JOIN player_team_assignments a ON a.player_id = p.id
      LEFT JOIN teams t ON t.id = a.team_id
      WHERE c.id = $1
      LIMIT 1
    `, [clipId]);

    sendJson(res, 202, { data: created.rows[0] });
    return;
  }

  if (req.method === 'GET' && requestUrl.pathname === `${apiPrefix}/players`) {
    const teamName = requestUrl.searchParams.get('teamName') || 'all';
    const query = normalizeComparable(requestUrl.searchParams.get('query') || '');
    const rows = await listPlayers(teamName, query);
    sendJson(res, 200, { data: rows });
    return;
  }

  if (req.method === 'POST' && requestUrl.pathname === `${apiPrefix}/players/preview-create`) {
    const payload = await readJsonBody(req);
    const normalizedName = toTitleCase(payload.name);
    const teamName = normalizeLookup(payload.teamName);
    const comparable = normalizeComparable(payload.name);
    const validChars = /^[A-Za-z' -]+$/;

    if (!teamName || teamName === 'all') {
      sendJson(res, 400, appError(400, 'validation_error', 'Pick a team before adding players.'));
      return;
    }

    if (!normalizedName || normalizedName.length < 2 || normalizedName.length > 60 || !validChars.test(normalizedName)) {
      sendJson(res, 400, appError(400, 'validation_error', 'Player name must be 2-60 chars and use letters, spaces, apostrophe, or hyphen.'));
      return;
    }

    const duplicate = await pool.query(
      `
        SELECT
          p.id,
          p.name,
          p.normalized_name AS "normalizedName",
          t.name AS "teamName",
          p.position,
          p.trend
        FROM players p
        JOIN player_team_assignments a ON a.player_id = p.id
        JOIN teams t ON t.id = a.team_id
        WHERE p.normalized_name = $1
        LIMIT 1
      `,
      [comparable]
    );

    sendJson(res, 200, {
      data: {
        normalizedName,
        teamName,
        duplicatePlayer: duplicate.rows[0] ? toPlayerPayload(duplicate.rows[0]) : null
      }
    });
    return;
  }

  if (req.method === 'POST' && requestUrl.pathname === `${apiPrefix}/players`) {
    const payload = await readJsonBody(req);
    const normalizedName = toTitleCase(payload.name);
    const teamName = normalizeLookup(payload.teamName);
    const confirmCreate = Boolean(payload.confirmCreate);
    const comparable = normalizeComparable(payload.name);
    const validChars = /^[A-Za-z' -]+$/;

    if (!teamName || teamName === 'all') {
      sendJson(res, 400, appError(400, 'validation_error', 'Pick a team before adding players.'));
      return;
    }

    if (!normalizedName || normalizedName.length < 2 || normalizedName.length > 60 || !validChars.test(normalizedName)) {
      sendJson(res, 400, appError(400, 'validation_error', 'Player name must be 2-60 chars and use letters, spaces, apostrophe, or hyphen.'));
      return;
    }

    const team = await findTeamByName(teamName);
    if (!team) {
      sendJson(res, 400, appError(400, 'validation_error', 'Please review the form fields and try again.'));
      return;
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const existingResult = await client.query(
        `
          SELECT
            p.id,
            p.name,
            p.normalized_name AS "normalizedName",
            t.name AS "teamName",
            p.position,
            p.trend,
            a.team_id AS "teamId"
          FROM players p
          JOIN player_team_assignments a ON a.player_id = p.id
          JOIN teams t ON t.id = a.team_id
          WHERE p.normalized_name = $1
          LIMIT 1
        `,
        [comparable]
      );

      const existing = existingResult.rows[0] || null;
      if (existing) {
        if (existing.teamId === team.id) {
          await client.query('COMMIT');
          sendJson(res, 200, {
            status: 200,
            code: 'ok',
            moved: false,
            player: toPlayerPayload(existing),
            message: 'Player is already assigned to this team.'
          });
          return;
        }

        await client.query(
          `
            UPDATE player_team_assignments
            SET team_id = $1, updated_at = NOW()
            WHERE player_id = $2
          `,
          [team.id, existing.id]
        );
        await client.query(`UPDATE players SET updated_at = NOW() WHERE id = $1`, [existing.id]);

        const movedPlayer = await findPlayerById(existing.id, client);
        await client.query('COMMIT');
        sendJson(res, 200, {
          status: 200,
          code: 'ok',
          moved: true,
          player: movedPlayer,
          message: `${movedPlayer.name} moved to ${teamName}.`
        });
        return;
      }

      if (!confirmCreate) {
        await client.query('ROLLBACK');
        sendJson(res, 400, appError(400, 'validation_error', 'Explicit confirmation is required to create this player.'));
        return;
      }

      const playerId = `p_${Date.now()}_${Math.floor(Math.random() * 10000)}`;
      await client.query(
        `
          INSERT INTO players (id, name, normalized_name, position, trend)
          VALUES ($1, $2, $3, 'Position not set', 'plateau')
        `,
        [playerId, normalizedName, comparable]
      );
      await client.query(
        `
          INSERT INTO player_team_assignments (player_id, team_id)
          VALUES ($1, $2)
        `,
        [playerId, team.id]
      );
      await upsertPlayerStats(client, playerId, buildNewPlayerDashboardStats('plateau'));

      const created = await findPlayerById(playerId, client);
      await client.query('COMMIT');
      sendJson(res, 201, {
        status: 201,
        code: 'created',
        player: created,
        message: `${created.name} created and assigned to ${teamName}.`
      });
      return;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  const assignMatch = requestUrl.pathname.match(/^\/api\/v1\/players\/([^/]+)\/assign$/);
  if (req.method === 'POST' && assignMatch) {
    const playerId = assignMatch[1];
    const payload = await readJsonBody(req);
    const teamName = normalizeLookup(payload.teamName);

    if (!teamName || teamName === 'all') {
      sendJson(res, 400, appError(400, 'validation_error', 'Pick a team before adding players.'));
      return;
    }

    const team = await findTeamByName(teamName);
    if (!team) {
      sendJson(res, 400, appError(400, 'validation_error', 'Please review the form fields and try again.'));
      return;
    }

    const current = await pool.query(
      `
        SELECT
          p.id,
          p.name,
          p.normalized_name AS "normalizedName",
          t.name AS "teamName",
          p.position,
          p.trend,
          a.team_id AS "teamId"
        FROM players p
        JOIN player_team_assignments a ON a.player_id = p.id
        JOIN teams t ON t.id = a.team_id
        WHERE p.id = $1
        LIMIT 1
      `,
      [playerId]
    );

    if (!current.rows[0]) {
      sendJson(res, 404, appError(404, 'not_found', 'The selected player was not found anymore. Refresh and try again.'));
      return;
    }

    const existing = current.rows[0];
    if (existing.teamId === team.id) {
      sendJson(res, 200, {
        status: 200,
        code: 'ok',
        moved: false,
        player: toPlayerPayload(existing),
        message: 'Player is already assigned to this team.'
      });
      return;
    }

    await pool.query(
      `
        UPDATE player_team_assignments
        SET team_id = $1, updated_at = NOW()
        WHERE player_id = $2
      `,
      [team.id, playerId]
    );
    await pool.query(`UPDATE players SET updated_at = NOW() WHERE id = $1`, [playerId]);

    const updated = await findPlayerById(playerId);
    sendJson(res, 200, {
      status: 200,
      code: 'ok',
      moved: true,
      player: updated,
      message: `${updated.name} moved to ${teamName}.`
    });
    return;
  }

  const playerMatch = requestUrl.pathname.match(/^\/api\/v1\/players\/([^/]+)$/);
  if (req.method === 'GET' && playerMatch) {
    const found = await findPlayerById(playerMatch[1]);
    if (!found) {
      sendJson(res, 404, appError(404, 'not_found', 'The selected player was not found anymore. Refresh and try again.'));
      return;
    }

    sendJson(res, 200, { data: found });
    return;
  }

  sendJson(res, 404, appError(404, 'not_found', 'Not Found'));
}

if (!fs.existsSync(root)) {
  console.error(`Mockup root missing: ${root}`);
  process.exit(1);
}

const server = http.createServer(async (req, res) => {
  try {
    const requestUrl = new URL(req.url || '/', `http://${host}:${port}`);
    if (requestUrl.pathname.startsWith(apiPrefix)) {
      await handlePlayersApi(req, res, requestUrl);
      return;
    }

    const target = resolveTarget(requestUrl.pathname || '/');

    if (!isInsideRoot(target) && target !== path.join(root, 'index.html')) {
      send(res, 403, 'Forbidden');
      return;
    }

    fs.readFile(target, (err, data) => {
      if (err) {
        send(res, 404, 'Not Found');
        return;
      }

      const ext = path.extname(target).toLowerCase();
      send(res, 200, data, mimeTypes[ext] || 'application/octet-stream');
    });
  } catch (error) {
    console.error('Mockup server error:', error);
    sendJson(res, 500, appError(500, 'unknown', 'Internal Server Error'));
  }
});

ensureDatabase()
  .then(() => {
    server.listen(port, host, () => {
      console.log(`Mockup server running at http://${host}:${port}`);
      console.log('Supported routes: /, /S0-login, /S1-player-list, /S2-player-dashboard, /S3-team-management, /S4-video-capture, /S6-assessment-list, /S7-admin-user-management, /api/v1/players');
      if (!databaseUrl) {
        console.log('Database mode disabled: set DATABASE_URL to enable persistent /api/v1 players writes.');
      }
    });
  })
  .catch((error) => {
    console.error('Failed to initialize database schema:', error);
    process.exit(1);
  });
