const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { URL } = require('node:url');
const { Pool } = require('pg');
const { startVideoProcessingQueue } = require('./video-processing/queue');
const { createClipUpload, toClipResponse, listSegmentsForClips } = require('./video-processing/clip-upload');
const { resolveClipMediaPath, resolveClipThumbnailPath, streamVideoFile, streamJpegFile } = require('./video-processing/clip-media');
const { backfillPlayerSkillRatingsFromClips } = require('./video-processing/sync-player-skill-ratings-from-clip');
const { logEvent, getLogPath } = require('./logging/structured-logger');
const { generateShareToken, hashShareToken } = require('./share-token');
const { suggestSkillAbbreviation, normalizeSkillAbbreviation, validateSkillAbbreviation } = require('./skills/suggest-abbreviation');
const crypto = require('node:crypto');

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
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store'
  });
  res.end(JSON.stringify(payload));
}

function logStructured(functionality, userId, details) {
  logEvent({
    functionality,
    userId: userId != null && userId !== '' ? userId : undefined,
    details: details || {}
  });
}

async function resolveUserIdByEmail(email) {
  const normalized = String(email || '').trim().toLowerCase();
  if (!normalized || !pool) {
    return null;
  }
  try {
    const result = await pool.query(
      `SELECT id FROM users WHERE LOWER(email) = LOWER($1) LIMIT 1`,
      [normalized]
    );
    return result.rows[0] ? result.rows[0].id : null;
  } catch {
    return null;
  }
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
  const birthMonth = row.birthMonth != null ? row.birthMonth : null;
  const birthYear = row.birthYear != null ? row.birthYear : null;
  return {
    id: row.id,
    name: row.name,
    normalizedName: row.normalizedName,
    avatarUrl: row.avatarUrl || null,
    teamName: row.teamName,
    position: row.position,
    trend: row.trend,
    birthMonth,
    birthYear,
    age: computeAge(birthMonth, birthYear),
    updated: 'Updated just now',
    anySkillRatings: Array.isArray(row.anySkillRatings) ? row.anySkillRatings : undefined,
    skillRatingsById: row.skillRatingsById && typeof row.skillRatingsById === 'object'
      ? row.skillRatingsById
      : undefined
  };
}

// Feature 040: ratings for every skill linked to any position of the player's team sport.
async function listSportSkillRatingsByPlayerIds(playerIds) {
  const ids = (playerIds || []).map((id) => String(id)).filter(Boolean);
  const byPlayer = new Map();
  ids.forEach((id) => { byPlayer.set(id, {}); });
  if (!ids.length) {
    return byPlayer;
  }

  const result = await pool.query(
    `
      SELECT
        pl.id AS "playerId",
        s.id AS "skillId",
        psr.rating AS "rating"
      FROM players pl
      JOIN player_team_assignments a ON a.player_id = pl.id
      JOIN teams t ON t.id = a.team_id
      JOIN positions pos ON pos.sport_id = t.sport_id
      JOIN position_skills ps ON ps.position_id = pos.id
      JOIN skills s ON s.id = ps.skill_id
      LEFT JOIN player_skill_ratings psr
        ON psr.player_id = pl.id AND psr.skill_id = s.id
      WHERE pl.id = ANY($1::text[])
      GROUP BY pl.id, s.id, psr.rating
    `,
    [ids]
  );

  result.rows.forEach((row) => {
    const key = String(row.playerId);
    const map = byPlayer.get(key) || {};
    map[String(row.skillId)] = row.rating === null || row.rating === undefined
      ? null
      : Number(row.rating);
    byPlayer.set(key, map);
  });
  return byPlayer;
}

// Feature 038: batch Any-position skill ratings (+ abbreviations) for roster cards.
async function listAnySkillRatingsByPlayerIds(playerIds) {
  const ids = (playerIds || []).map((id) => String(id)).filter(Boolean);
  const byPlayer = new Map();
  ids.forEach((id) => { byPlayer.set(id, []); });
  if (!ids.length) {
    return byPlayer;
  }

  const result = await pool.query(
    `
      SELECT
        pl.id AS "playerId",
        s.id AS "skillId",
        s.name AS "skillName",
        COALESCE(
          NULLIF(BTRIM(s.abbreviation), ''),
          UPPER(LEFT(REGEXP_REPLACE(s.name, '[^A-Za-z0-9]', '', 'g'), 3))
        ) AS "abbreviation",
        psr.rating AS "rating"
      FROM players pl
      JOIN player_team_assignments a ON a.player_id = pl.id
      JOIN teams t ON t.id = a.team_id
      JOIN positions any_pos
        ON any_pos.sport_id = t.sport_id AND LOWER(any_pos.name) = 'any position'
      JOIN position_skills ps ON ps.position_id = any_pos.id
      JOIN skills s ON s.id = ps.skill_id
      LEFT JOIN player_skill_ratings psr
        ON psr.player_id = pl.id AND psr.skill_id = s.id
      WHERE pl.id = ANY($1::text[])
      ORDER BY pl.id ASC, s.name ASC
    `,
    [ids]
  );

  result.rows.forEach((row) => {
    const key = String(row.playerId);
    const list = byPlayer.get(key) || [];
    list.push({
      skillId: row.skillId,
      skillName: row.skillName,
      abbreviation: String(row.abbreviation || '').toUpperCase().slice(0, 3),
      rating: row.rating === null || row.rating === undefined ? null : Number(row.rating)
    });
    byPlayer.set(key, list);
  });
  return byPlayer;
}

// Derives birth year from a team age-group label (e.g. U17, 18+) by stripping
// non-digits and subtracting from the current calendar year. Returns null when
// no digits remain or the result is outside 1960–currentYear.
function birthYearFromAgeGroup(ageGroup, now) {
  const digits = String(ageGroup == null ? '' : ageGroup).replace(/\D/g, '');
  if (!digits) {
    return null;
  }
  const ageNumber = Number.parseInt(digits, 10);
  if (!Number.isInteger(ageNumber) || ageNumber <= 0) {
    return null;
  }
  const currentYear = (now instanceof Date ? now : new Date()).getFullYear();
  const year = currentYear - ageNumber;
  if (year < 1960 || year > currentYear) {
    return null;
  }
  return year;
}

// Derives a player's age from birth month/year. Pure function so the mockup
// client and the server stay in sync. Year-only (month null) assumes Jan 1.
// Returns null when year is missing -- the S2 dashboard omits "Age" then.
function computeAge(birthMonth, birthYear, now) {
  if (birthYear == null) {
    return null;
  }
  const reference = now instanceof Date ? now : new Date();
  const year = Number(birthYear);
  if (!Number.isInteger(year)) {
    return null;
  }
  let month;
  if (birthMonth == null || birthMonth === '') {
    month = 1;
  } else {
    month = Number(birthMonth);
    if (!Number.isInteger(month) || month < 1 || month > 12) {
      return null;
    }
  }
  // JavaScript Date months are 0-indexed; normalize before comparing.
  const referenceMonth = reference.getMonth() + 1;
  let age = reference.getFullYear() - year;
  if (referenceMonth < month) {
    age -= 1;
  }
  return age >= 0 ? age : null;
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

// The genuine "no stats recorded yet" shape. Used both when a player is
// first created and when syncDefaultDashboardStats backfills a missing row
// for an existing player -- never fabricated archetype numbers borrowed
// from another player.
function buildNewPlayerDashboardStats(trend) {
  const normalizedTrend = normalizeTrendValue(trend);

  return {
    growthStatus: null,
    currentLevel: null,
    fitness: null,
    skillProgress: null,
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
    currentLevelChange: null,
    fitnessChange: null,
    skillProgressChange: null
  };
}

// The four demo/reference profiles that intentionally carry curated,
// hand-picked stats. Every other player must never have their stats
// overwritten with data borrowed from one of these profiles.
const NAMED_REFERENCE_PROFILES = new Set(['lionel messi', 'cristiano ronaldo', 'neymar jr', 'kylian mbappe']);

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

// Returns null when there is genuinely no recorded change for this metric
// (both DB columns are null together, by construction) rather than
// papering over the gap with a placeholder value.
function toMetricChangeIndicator(label, trendValue) {
  if (label === null || label === undefined) {
    return null;
  }
  return {
    label,
    trend: trendValue || 'plateau'
  };
}

function toDashboardPayload(row, skillRatings) {
  const averageScore = row.averageScore === null || row.averageScore === undefined ? 'N/A' : Number(row.averageScore).toFixed(1);
  const lastMatchScore = row.lastMatchScore === null || row.lastMatchScore === undefined ? 'N/A' : Number(row.lastMatchScore).toFixed(1);
  const currentLevelChange = toMetricChangeIndicator(row.currentLevelChangeLabel, row.currentLevelChangeTrend);
  const fitnessChange = toMetricChangeIndicator(row.fitnessChangeLabel, row.fitnessChangeTrend);
  const skillProgressChange = toMetricChangeIndicator(row.skillProgressChangeLabel, row.skillProgressChangeTrend);

  return {
    player: {
      id: row.id,
      name: row.name,
      normalizedName: row.normalizedName,
      avatarUrl: row.avatarUrl || null,
      teamName: row.teamName,
      position: row.position,
      trend: row.trend,
      birthMonth: row.birthMonth != null ? row.birthMonth : null,
      birthYear: row.birthYear != null ? row.birthYear : null,
      age: computeAge(row.birthMonth, row.birthYear),
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
    skillRatings: Array.isArray(skillRatings) ? skillRatings : [],
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

const PLAYER_STATS_COLUMNS = [
  'player_id', 'growth_status', 'current_level', 'fitness', 'skill_progress',
  'total_minutes', 'appearances', 'recent_avg', 'average_score', 'trend',
  'last_match_score', 'last_match_summary', 'clip_submitted_count',
  'clip_assessed_count', 'clip_pending_count', 'missing_data_message',
  'current_level_change_label', 'current_level_change_trend',
  'fitness_change_label', 'fitness_change_trend',
  'skill_progress_change_label', 'skill_progress_change_trend'
];

function playerStatsInsertValues(playerId, stats) {
  return [
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
  ];
}

async function upsertPlayerStats(executor, playerId, stats) {
  const placeholders = PLAYER_STATS_COLUMNS.map((_, index) => `$${index + 1}`).join(', ');
  const updateAssignments = PLAYER_STATS_COLUMNS.slice(1)
    .map((column) => `${column} = EXCLUDED.${column}`)
    .join(',\n        ');

  await executor.query(
    `
      INSERT INTO player_stats (${PLAYER_STATS_COLUMNS.join(', ')}, updated_at)
      VALUES (${placeholders}, NOW())
      ON CONFLICT (player_id) DO UPDATE SET
        ${updateAssignments},
        updated_at = NOW()
    `,
    playerStatsInsertValues(playerId, stats)
  );
}

// Insert-only variant: never overwrites an existing row. Used for any
// player outside the named reference profiles, so a player's real (or
// legitimately empty) stats are never clobbered by a backfill.
async function ensurePlayerStatsRowExists(executor, playerId, stats) {
  const placeholders = PLAYER_STATS_COLUMNS.map((_, index) => `$${index + 1}`).join(', ');

  await executor.query(
    `
      INSERT INTO player_stats (${PLAYER_STATS_COLUMNS.join(', ')})
      VALUES (${placeholders})
      ON CONFLICT (player_id) DO NOTHING
    `,
    playerStatsInsertValues(playerId, stats)
  );
}

async function syncDefaultDashboardStats(executor) {
  const result = await executor.query(`SELECT id, name, normalized_name AS "normalizedName", trend FROM players ORDER BY name ASC`);
  for (const player of result.rows) {
    // Startup sync is insert-only for every player, so it never clobbers an
    // existing row. Named reference profiles still get their curated seed
    // stats, but only on first insert; once a coach edits any player (named
    // or not) via PATCH /players/{id}, those edits survive server restarts.
    const seedStats = NAMED_REFERENCE_PROFILES.has(player.normalizedName)
      ? getSeedDashboardStats(player.normalizedName, player.trend)
      : buildNewPlayerDashboardStats(player.trend);
    await ensurePlayerStatsRowExists(executor, player.id, seedStats);
  }
}

// One-time cleanup for rows already corrupted by the fabrication bug fixed
// above (see apps/api/src/db/migrations/010_reset_fabricated_player_stats.sql
// for the full rationale). Only resets rows that exactly match one of the
// three fabricated archetype signatures and belong to a non-named player --
// never a blanket reset -- so it is safe to run on every server start.
async function resetFabricatedPlayerStats(executor) {
  await executor.query(`
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
        (
          ps.growth_status = 'on_track' AND ps.current_level = '92%' AND ps.fitness = '87%' AND ps.skill_progress = '94%'
          AND ps.total_minutes = 2340 AND ps.appearances = 26 AND ps.recent_avg = '90''' AND ps.average_score = 8.8
          AND ps.last_match_score = 8.5 AND ps.last_match_summary = 'Confident execution under pressure.'
          AND ps.clip_submitted_count = 4 AND ps.clip_assessed_count = 3 AND ps.clip_pending_count = 1
        )
        OR
        (
          ps.growth_status = 'at_risk' AND ps.current_level = '81%' AND ps.fitness = '79%' AND ps.skill_progress = '86%'
          AND ps.total_minutes = 420 AND ps.appearances = 12 AND ps.recent_avg = '70''' AND ps.average_score IS NULL
          AND ps.last_match_score IS NULL AND ps.last_match_summary IS NULL
          AND ps.clip_submitted_count = 2 AND ps.clip_assessed_count = 0 AND ps.clip_pending_count = 2
        )
        OR
        (
          ps.growth_status = 'watch' AND ps.current_level = '87%' AND ps.fitness = '87%' AND ps.skill_progress = '86%'
          AND ps.total_minutes = 540 AND ps.appearances = 8 AND ps.recent_avg = '72''' AND ps.average_score = 7.1
          AND ps.last_match_score = 7.1 AND ps.last_match_summary = 'Pace was strong, timing can improve.'
          AND ps.clip_submitted_count = 3 AND ps.clip_assessed_count = 2 AND ps.clip_pending_count = 1
        )
      )
  `);
}

function toUserPayload(row) {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    role: row.role,
    status: row.status,
    lastLogin: row.lastLogin || row.last_login_label || row.lastLoginLabel || null,
    password: row.password || row.password_hash || row.passwordHash || '',
    clubIds: Array.isArray(row.clubIds) ? row.clubIds : []
  };
}

function toClubPayload(row) {
  return {
    id: row.id,
    name: row.name,
    status: row.status || 'active',
    coachCount: row.coachCount === undefined || row.coachCount === null ? null : Number(row.coachCount),
    teamCount: row.teamCount === undefined || row.teamCount === null ? null : Number(row.teamCount)
  };
}

function toUserClubPayload(row) {
  return {
    userId: row.userId || row.user_id,
    clubId: row.clubId || row.club_id,
    clubName: row.clubName || row.club_name || null,
    status: row.status || 'active'
  };
}

function toSportPayload(row) {
  return {
    id: row.id,
    name: row.name,
    status: row.status || 'active',
    positionCount: row.positionCount === undefined || row.positionCount === null ? null : Number(row.positionCount)
  };
}

function toPositionPayload(row) {
  return {
    id: row.id,
    name: row.name,
    sportId: row.sportId || row.sport_id,
    status: row.status || 'active',
    skillCount: row.skillCount === undefined || row.skillCount === null ? null : Number(row.skillCount)
  };
}

function toSkillPayload(row) {
  return {
    id: row.id,
    name: row.name,
    abbreviation: row.abbreviation || suggestSkillAbbreviation(row.name),
    status: row.status || 'active',
    assignedPositionCount: row.assignedPositionCount === undefined || row.assignedPositionCount === null ? null : Number(row.assignedPositionCount)
  };
}

function toPositionSkillPayload(row) {
  return {
    positionId: row.positionId || row.position_id,
    skillId: row.skillId || row.skill_id,
    skillName: row.skillName || row.skill_name || null,
    status: row.status || 'active'
  };
}

function validateName(name, minLen, maxLen, fieldLabel) {
  const value = String(name || '').trim();
  if (value.length < minLen || value.length > maxLen) {
    return `${fieldLabel} name must be ${minLen}-${maxLen} characters.`;
  }
  return null;
}

async function findSportByName(name, client) {
  const runner = client || pool;
  const result = await runner.query(
    `SELECT id, name, status FROM sports WHERE LOWER(name) = LOWER($1) LIMIT 1`,
    [name]
  );
  return result.rows[0] || null;
}

async function findPositionByName(sportId, name, client) {
  const runner = client || pool;
  const result = await runner.query(
    `SELECT id, name, sport_id AS "sportId", status FROM positions WHERE sport_id = $1 AND LOWER(name) = LOWER($2) LIMIT 1`,
    [sportId, name]
  );
  return result.rows[0] || null;
}

async function findSkillByName(name, client) {
  const runner = client || pool;
  const result = await runner.query(
    `SELECT id, name, status FROM skills WHERE LOWER(name) = LOWER($1) LIMIT 1`,
    [name]
  );
  return result.rows[0] || null;
}

async function listSportsWithCounts(statusFilter, client) {
  const runner = client || pool;
  const params = [];
  let whereClause = '';
  if (statusFilter === 'active' || statusFilter === 'inactive') {
    whereClause = 'WHERE s.status = $1';
    params.push(statusFilter);
  }
  const result = await runner.query(
    `
      SELECT
        s.id,
        s.name,
        s.status,
        (SELECT COUNT(*) FROM positions p WHERE p.sport_id = s.id) AS "positionCount"
      FROM sports s
      ${whereClause}
      ORDER BY s.name ASC
    `,
    params
  );
  return result.rows.map(toSportPayload);
}

async function listPositionsWithCounts(sportId, statusFilter, client) {
  const runner = client || pool;
  const params = [];
  const whereParts = [];
  if (sportId) {
    params.push(sportId);
    whereParts.push(`p.sport_id = $${params.length}`);
  }
  if (statusFilter === 'active' || statusFilter === 'inactive') {
    params.push(statusFilter);
    whereParts.push(`p.status = $${params.length}`);
  }
  const whereClause = whereParts.length ? `WHERE ${whereParts.join(' AND ')}` : '';
  const result = await runner.query(
    `
      SELECT
        p.id,
        p.name,
        p.sport_id AS "sportId",
        p.status,
        (SELECT COUNT(*) FROM position_skills ps WHERE ps.position_id = p.id) AS "skillCount"
      FROM positions p
      ${whereClause}
      ORDER BY p.name ASC
    `,
    params
  );
  return result.rows.map(toPositionPayload);
}

async function listSkillsWithCounts(statusFilter, client) {
  const runner = client || pool;
  const params = [];
  let whereClause = '';
  if (statusFilter === 'active' || statusFilter === 'inactive') {
    whereClause = 'WHERE s.status = $1';
    params.push(statusFilter);
  }
  const result = await runner.query(
    `
      SELECT
        s.id,
        s.name,
        s.abbreviation,
        s.status,
        (SELECT COUNT(*) FROM position_skills ps WHERE ps.skill_id = s.id) AS "assignedPositionCount"
      FROM skills s
      ${whereClause}
      ORDER BY s.name ASC
    `,
    params
  );
  return result.rows.map(toSkillPayload);
}

async function listPositionSkills(positionId, client) {
  const runner = client || pool;
  const result = await runner.query(
    `
      SELECT
        ps.position_id AS "positionId",
        ps.skill_id AS "skillId",
        s.name AS "skillName",
        s.status
      FROM position_skills ps
      JOIN skills s ON s.id = ps.skill_id
      WHERE ps.position_id = $1
      ORDER BY s.name ASC
    `,
    [positionId]
  );
  return result.rows.map(toPositionSkillPayload);
}

// Returns Any Position skills for the player's sport, plus role-unique skills
// when the assigned position is resolvable and is not Any Position. Overlaps
// appear only under Any Position. Empty when the player has no team/sport.
async function listSkillsForPlayer(playerId, executor = pool) {
  const context = await executor.query(
    `
      SELECT
        pl.position AS "positionName",
        t.sport_id AS "sportId",
        any_pos.id AS "anyPositionId",
        any_pos.name AS "anyPositionName",
        role_pos.id AS "rolePositionId",
        role_pos.name AS "rolePositionName"
      FROM players pl
      JOIN player_team_assignments a ON a.player_id = pl.id
      JOIN teams t ON t.id = a.team_id
      LEFT JOIN positions any_pos
        ON any_pos.sport_id = t.sport_id AND LOWER(any_pos.name) = 'any position'
      LEFT JOIN positions role_pos
        ON role_pos.sport_id = t.sport_id
        AND LOWER(role_pos.name) = LOWER(pl.position)
        AND pl.position IS NOT NULL
        AND TRIM(pl.position) <> ''
        AND LOWER(pl.position) <> 'position not set'
      WHERE pl.id = $1
      LIMIT 1
    `,
    [playerId]
  );
  if (!context.rows[0] || !context.rows[0].anyPositionId) {
    return [];
  }

  const row = context.rows[0];
  const anyPositionId = row.anyPositionId;
  const rolePositionId = row.rolePositionId
    && String(row.rolePositionId) !== String(anyPositionId)
    ? row.rolePositionId
    : null;

  const result = await executor.query(
    `
      SELECT
        ps.skill_id AS "skillId",
        s.name AS "skillName",
        p.id AS "positionId",
        p.name AS "positionName",
        psr.rating AS "rating",
        CASE WHEN p.id = $2 THEN 0 ELSE 1 END AS "sectionOrder"
      FROM position_skills ps
      JOIN positions p ON p.id = ps.position_id
      JOIN skills s ON s.id = ps.skill_id
      LEFT JOIN player_skill_ratings psr ON psr.player_id = $1 AND psr.skill_id = ps.skill_id
      WHERE ps.position_id = $2
         OR (
           $3::text IS NOT NULL
           AND ps.position_id = $3
           AND NOT EXISTS (
             SELECT 1 FROM position_skills any_ps
             WHERE any_ps.position_id = $2 AND any_ps.skill_id = ps.skill_id
           )
         )
      ORDER BY "sectionOrder" ASC, s.name ASC
    `,
    [playerId, anyPositionId, rolePositionId]
  );

  return result.rows.map((entry) => ({
    skillId: entry.skillId,
    skillName: entry.skillName,
    positionId: entry.positionId,
    positionName: entry.positionName,
    rating: entry.rating === null || entry.rating === undefined ? null : Number(entry.rating)
  }));
}

async function resolvePositionIdForPlayer(executor, playerId, positionName) {
  if (!positionName || positionName === 'Position not set') {
    return null;
  }
  const result = await executor.query(
    `
      SELECT p.id
      FROM players pl
      JOIN player_team_assignments a ON a.player_id = pl.id
      JOIN teams t ON t.id = a.team_id
      JOIN positions p ON LOWER(p.name) = LOWER($2) AND p.sport_id = t.sport_id
      WHERE pl.id = $1
      LIMIT 1
    `,
    [playerId, positionName]
  );
  return result.rows[0] ? result.rows[0].id : null;
}

async function resolveAnyPositionIdForPlayer(executor, playerId) {
  const result = await executor.query(
    `
      SELECT any_pos.id
      FROM players pl
      JOIN player_team_assignments a ON a.player_id = pl.id
      JOIN teams t ON t.id = a.team_id
      JOIN positions any_pos
        ON any_pos.sport_id = t.sport_id AND LOWER(any_pos.name) = 'any position'
      WHERE pl.id = $1
      LIMIT 1
    `,
    [playerId]
  );
  return result.rows[0] ? result.rows[0].id : null;
}

// Preserve-Any + swap-role: keep ratings for the sport's Any Position skills,
// delete other ratings, then insert NULL rows for new role-unique skills.
async function replaceSkillRatingsForPosition(client, playerId, newPositionId) {
  const anyPositionId = await resolveAnyPositionIdForPlayer(client, playerId);

  if (!anyPositionId) {
    await client.query('DELETE FROM player_skill_ratings WHERE player_id = $1', [playerId]);
    if (!newPositionId) {
      return;
    }
    await client.query(
      `
        INSERT INTO player_skill_ratings (player_id, skill_id, rating)
        SELECT $1, ps.skill_id, NULL
        FROM position_skills ps
        WHERE ps.position_id = $2
        ON CONFLICT (player_id, skill_id) DO NOTHING
      `,
      [playerId, newPositionId]
    );
    return;
  }

  await client.query(
    `
      DELETE FROM player_skill_ratings psr
      WHERE psr.player_id = $1
        AND NOT EXISTS (
          SELECT 1 FROM position_skills any_ps
          WHERE any_ps.position_id = $2 AND any_ps.skill_id = psr.skill_id
        )
    `,
    [playerId, anyPositionId]
  );

  if (!newPositionId || String(newPositionId) === String(anyPositionId)) {
    return;
  }

  await client.query(
    `
      INSERT INTO player_skill_ratings (player_id, skill_id, rating)
      SELECT $1, ps.skill_id, NULL
      FROM position_skills ps
      WHERE ps.position_id = $3
        AND NOT EXISTS (
          SELECT 1 FROM position_skills any_ps
          WHERE any_ps.position_id = $2 AND any_ps.skill_id = ps.skill_id
        )
      ON CONFLICT (player_id, skill_id) DO NOTHING
    `,
    [playerId, anyPositionId, newPositionId]
  );
}

function parseUpdateSkillRatingsPayload(payload) {
  if (!payload || !Array.isArray(payload.ratings)) {
    return { error: 'ratings must be an array of { skillId, rating } objects.' };
  }
  const ratings = [];
  for (const entry of payload.ratings) {
    if (!entry || typeof entry !== 'object') {
      return { error: 'Each rating entry must be an object with skillId and rating.' };
    }
    const skillId = String(entry.skillId || '').trim();
    if (!skillId) {
      return { error: 'Each rating entry requires a non-empty skillId.' };
    }
    if (entry.rating === null || entry.rating === undefined || entry.rating === '') {
      ratings.push({ skillId, rating: null });
      continue;
    }
    if (typeof entry.rating === 'number' && !Number.isInteger(entry.rating)) {
      return { error: 'Skill rating must be a whole number from 0 to 100, or null.' };
    }
    const rating = Number(entry.rating);
    if (!Number.isInteger(rating) || rating < 0 || rating > 100) {
      return { error: 'Skill rating must be a whole number from 0 to 100, or null.' };
    }
    ratings.push({ skillId, rating });
  }
  return { ratings };
}

function normalizeAuditScalar(value) {
  if (value === null || value === undefined) {
    return null;
  }
  return String(value);
}

function auditValuesEqual(oldValue, newValue) {
  return normalizeAuditScalar(oldValue) === normalizeAuditScalar(newValue);
}

async function insertPlayerDataAudit(executor, row) {
  if (!executor || !row || !row.playerId || !row.entity || !row.fieldKey) {
    return false;
  }
  if (auditValuesEqual(row.oldValue, row.newValue)) {
    return false;
  }
  const id = 'pda_' + crypto.randomBytes(8).toString('hex');
  await executor.query(
    `
      INSERT INTO player_data_audits (
        id, player_id, entity, field_key, skill_id, old_value, new_value,
        actor_user_id, actor_kind, source, clip_id
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
    `,
    [
      id,
      row.playerId,
      row.entity,
      row.fieldKey,
      row.skillId || null,
      normalizeAuditScalar(row.oldValue),
      normalizeAuditScalar(row.newValue),
      row.actorUserId || null,
      row.actorKind || 'user',
      row.source || 'coach_ui',
      row.clipId || null
    ]
  );
  return true;
}

async function upsertSkillRatings(client, playerId, ratings, auditMeta = null) {
  for (const entry of ratings) {
    const previous = await client.query(
      `SELECT rating FROM player_skill_ratings WHERE player_id = $1 AND skill_id = $2`,
      [playerId, entry.skillId]
    );
    const oldRating = previous.rows[0]
      ? (previous.rows[0].rating === null || previous.rows[0].rating === undefined
        ? null
        : Number(previous.rows[0].rating))
      : null;

    if (entry.rating === null) {
      await client.query(
        `DELETE FROM player_skill_ratings WHERE player_id = $1 AND skill_id = $2`,
        [playerId, entry.skillId]
      );
    } else {
      await client.query(
        `
          INSERT INTO player_skill_ratings (player_id, skill_id, rating, updated_at)
          VALUES ($1, $2, $3, NOW())
          ON CONFLICT (player_id, skill_id) DO UPDATE SET
            rating = EXCLUDED.rating,
            updated_at = NOW()
        `,
        [playerId, entry.skillId, entry.rating]
      );
    }

    if (auditMeta) {
      await insertPlayerDataAudit(client, {
        playerId,
        entity: 'skill_rating',
        fieldKey: 'rating',
        skillId: entry.skillId,
        oldValue: oldRating,
        newValue: entry.rating,
        actorUserId: auditMeta.actorUserId,
        actorKind: auditMeta.actorKind || 'user',
        source: auditMeta.source || 'coach_ui',
        clipId: auditMeta.clipId || null
      });
    }
  }
}

async function resolveSystemAdminActor(actorEmail) {
  const email = String(actorEmail || '').trim().toLowerCase();
  if (!email) {
    return null;
  }
  const result = await pool.query(
    `SELECT id, name, email, role, status FROM users WHERE LOWER(email) = LOWER($1) LIMIT 1`,
    [email]
  );
  return result.rows[0] || null;
}

function assertSystemAdminActor(actor) {
  if (!actor || actor.role !== 'SystemAdmin' || actor.status !== 'active') {
    return false;
  }
  return true;
}

function isClubScopedActor(actor) {
  return Boolean(
    actor &&
      actor.status === 'active' &&
      (actor.role === 'Coach' || actor.role === 'ClubAdmin')
  );
}

function isLeadScopedActor(actor) {
  return Boolean(actor && actor.status === 'active' && actor.role === 'Coach');
}

const ALL_ROLES = ['SystemAdmin', 'Coach', 'ClubAdmin'];
const TEAM_EDITOR_ROLES = ['SystemAdmin', 'Coach', 'ClubAdmin'];

function toTeamPayload(row) {
  return {
    id: row.id,
    name: row.name,
    ageGroup: row.ageGroup || row.age_group,
    leadCoach: row.leadCoach || row.lead_coach,
    leadCoachEmail: row.leadCoachEmail || row.lead_coach_email || null,
    leadCoachUserId: row.leadCoachUserId || row.lead_coach_user_id || null,
    clubId: row.clubId || row.club_id || null,
    clubName: row.clubName || row.club_name || null,
    sportId: row.sportId || row.sport_id || null,
    sportName: row.sportName || row.sport_name || null,
    status: row.status || 'active',
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
      role TEXT NOT NULL CHECK (role IN ('SystemAdmin', 'Coach', 'ClubAdmin')),
      status TEXT NOT NULL DEFAULT 'active',
      password_hash TEXT,
      last_login_label TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      deactivated_at TIMESTAMPTZ
    );
  `);

  // Existing DBs keep the old two-role CHECK; recreate like clips_status_check.
  await pool.query(`ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;`);
  await pool.query(`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1
        FROM information_schema.table_constraints
        WHERE constraint_schema = 'public'
          AND table_name = 'users'
          AND constraint_name = 'users_role_check'
      ) THEN
        ALTER TABLE users
          ADD CONSTRAINT users_role_check
          CHECK (role IN ('SystemAdmin', 'Coach', 'ClubAdmin'));
      END IF;
    END $$;
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

  // Migration 011 (player avatar URL): additive column retrofit for any
  // database that pre-dates this column. Idempotent because of IF NOT EXISTS.
  await pool.query(`ALTER TABLE players ADD COLUMN IF NOT EXISTS player_avatar_url TEXT;`);

  // Migration 017: birth month/year columns (idempotent).
  await pool.query(`
    ALTER TABLE players
      ADD COLUMN IF NOT EXISTS birth_month SMALLINT
        CHECK (birth_month IS NULL OR birth_month BETWEEN 1 AND 12)
  `);
  await pool.query(`
    ALTER TABLE players
      ADD COLUMN IF NOT EXISTS birth_year SMALLINT
        CHECK (
          birth_year IS NULL
          OR (birth_year BETWEEN 1960 AND EXTRACT(YEAR FROM NOW())::SMALLINT)
        )
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

  // Feature 026: overwrite birth_year from assigned team age_group digits.
  await pool.query(`
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
      AND regexp_replace(t.age_group, '[^0-9]', '', 'g') ~ '^[0-9]+$'
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS clips (
      id TEXT PRIMARY KEY,
      player_id TEXT NOT NULL REFERENCES players(id) ON DELETE CASCADE,
      situation TEXT NOT NULL,
      status TEXT NOT NULL CHECK (status IN ('submitted', 'in_progress', 'complete', 'failed')),
      score NUMERIC(4,2),
      summary TEXT,
      submitted_at_label TEXT,
      skill TEXT,
      video_storage_path TEXT,
      original_filename TEXT,
      mime_type TEXT,
      file_size_bytes BIGINT,
      skill_focus JSONB NOT NULL DEFAULT '[]'::jsonb,
      skill_ratings JSONB,
      processing_started_at TIMESTAMPTZ,
      processing_completed_at TIMESTAMPTZ,
      error_message TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
  await pool.query(`ALTER TABLE clips ADD COLUMN IF NOT EXISTS video_storage_path TEXT;`);
  await pool.query(`ALTER TABLE clips ADD COLUMN IF NOT EXISTS original_filename TEXT;`);
  await pool.query(`ALTER TABLE clips ADD COLUMN IF NOT EXISTS mime_type TEXT;`);
  await pool.query(`ALTER TABLE clips ADD COLUMN IF NOT EXISTS file_size_bytes BIGINT;`);
  await pool.query(`ALTER TABLE clips ADD COLUMN IF NOT EXISTS skill_focus JSONB NOT NULL DEFAULT '[]'::jsonb;`);
  await pool.query(`ALTER TABLE clips ADD COLUMN IF NOT EXISTS skill_ratings JSONB;`);
  await pool.query(`ALTER TABLE clips ADD COLUMN IF NOT EXISTS processing_started_at TIMESTAMPTZ;`);
  await pool.query(`ALTER TABLE clips ADD COLUMN IF NOT EXISTS processing_completed_at TIMESTAMPTZ;`);
  await pool.query(`ALTER TABLE clips ADD COLUMN IF NOT EXISTS error_message TEXT;`);
  await pool.query(`ALTER TABLE clips ADD COLUMN IF NOT EXISTS comments TEXT;`);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS clip_segments (
      id TEXT PRIMARY KEY,
      clip_id TEXT NOT NULL REFERENCES clips(id) ON DELETE CASCADE,
      segment_index INT NOT NULL,
      path TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (clip_id, segment_index)
    );
  `);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_clip_segments_clip_id ON clip_segments(clip_id);`);
  // Upgrade clip status lifecycle for databases created before feature 018.
  // CREATE TABLE IF NOT EXISTS does not replace an existing CHECK constraint.
  // Drop the legacy constraint before rewriting status values.
  await pool.query(`ALTER TABLE clips DROP CONSTRAINT IF EXISTS clips_status_check;`);
  await pool.query(`UPDATE clips SET status = 'submitted' WHERE status = 'pending';`);
  await pool.query(`UPDATE clips SET status = 'complete' WHERE status = 'assessed';`);
  await pool.query(`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1
        FROM information_schema.table_constraints
        WHERE constraint_schema = 'public'
          AND table_name = 'clips'
          AND constraint_name = 'clips_status_check'
      ) THEN
        ALTER TABLE clips
          ADD CONSTRAINT clips_status_check
          CHECK (status IN ('submitted', 'in_progress', 'complete', 'failed'));
      END IF;
    END $$;
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS processing_config (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      description TEXT,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
  await pool.query(`
    INSERT INTO processing_config (key, value, description)
    VALUES
      ('max_parallel_video_processes', '1', 'Maximum concurrent clip assessments'),
      ('ollama_base_url', 'http://macmini.lan:11434', 'Ollama server base URL'),
      ('ollama_video_model', 'gemma4:12b-mlx', 'Ollama model for clip assessment'),
      ('ffmpeg_path', '', 'Full path to ffmpeg binary; empty uses PATH or FFMPEG_PATH env')
    ON CONFLICT (key) DO NOTHING;
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

  // Feature 034: guest share links (token hash only; never expires until revoked).
  await pool.query(`
    CREATE TABLE IF NOT EXISTS player_share_links (
      id TEXT PRIMARY KEY,
      player_id TEXT NOT NULL REFERENCES players(id) ON DELETE CASCADE,
      token_hash TEXT NOT NULL UNIQUE,
      created_by_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      revoked_at TIMESTAMPTZ
    );
  `);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_player_share_links_player_id ON player_share_links(player_id);`);
  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_player_share_links_active
      ON player_share_links(player_id)
      WHERE revoked_at IS NULL;
  `);

  // Feature 036: append-only player profile / team / skill change history.
  await pool.query(`
    CREATE TABLE IF NOT EXISTS player_data_audits (
      id TEXT PRIMARY KEY,
      player_id TEXT NOT NULL REFERENCES players(id) ON DELETE CASCADE,
      entity TEXT NOT NULL CHECK (entity IN ('profile', 'team_assignment', 'skill_rating')),
      field_key TEXT NOT NULL,
      skill_id TEXT REFERENCES skills(id) ON DELETE SET NULL,
      old_value TEXT,
      new_value TEXT,
      actor_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
      actor_kind TEXT NOT NULL CHECK (actor_kind IN ('user', 'system')),
      source TEXT NOT NULL,
      clip_id TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_player_data_audits_player_created
      ON player_data_audits(player_id, created_at DESC);
  `);

  // Feature 037: skill abbreviation (additive; skills table comes from migrations/deploy).
  try {
    await pool.query(`ALTER TABLE skills ADD COLUMN IF NOT EXISTS abbreviation TEXT;`);
    const missingAbbr = await pool.query(
      `SELECT id, name FROM skills WHERE abbreviation IS NULL OR BTRIM(abbreviation) = ''`
    );
    for (const row of missingAbbr.rows) {
      const abbr = suggestSkillAbbreviation(row.name);
      if (!abbr) {
        continue;
      }
      await pool.query(`UPDATE skills SET abbreviation = $1 WHERE id = $2`, [abbr, row.id]);
    }
    await pool.query(`
      UPDATE skills
      SET abbreviation = UPPER(LEFT(REGEXP_REPLACE(name, '[^A-Za-z0-9]', '', 'g'), 3))
      WHERE abbreviation IS NULL OR BTRIM(abbreviation) = ''
    `);
    try {
      await pool.query(`ALTER TABLE skills ALTER COLUMN abbreviation SET NOT NULL`);
    } catch (_err) {
      // Ignore if table empty or already constrained.
    }
    await pool.query(`ALTER TABLE skills DROP CONSTRAINT IF EXISTS skills_abbreviation_len_check`);
    await pool.query(`
      ALTER TABLE skills
        ADD CONSTRAINT skills_abbreviation_len_check
        CHECK (char_length(abbreviation) >= 1 AND char_length(abbreviation) <= 3)
    `);
  } catch (error) {
    console.warn('skills abbreviation ensure skipped:', error.message || error);
  }

  if (seedDatabase) {
    await pool.query(`
      INSERT INTO users (id, name, email, role, status, password_hash, last_login_label)
      VALUES
        ('u_admin_maria', 'Maria Alves', 'maria@vantageiq.club', 'SystemAdmin', 'active', 'SecurePass123', 'Today, 08:31'),
        ('u_coach_joao', 'Joao Lima', 'joao@vantageiq.club', 'Coach', 'active', 'SecurePass123', 'Yesterday'),
        ('u_coach_ana', 'Ana Costa', 'ana@vantageiq.club', 'Coach', 'inactive', 'SecurePass123', '6 days ago'),
        ('u_clubadmin_rita', 'Rita Costa', 'rita@vantageiq.club', 'ClubAdmin', 'active', 'SecurePass123', 'Today')
      ON CONFLICT (id) DO NOTHING;
    `);

    try {
      await pool.query(`
        INSERT INTO coach_clubs (user_id, club_id)
        VALUES ('u_clubadmin_rita', 'c_default')
        ON CONFLICT (user_id, club_id) DO NOTHING;
      `);
    } catch (error) {
      console.warn('club admin coach_clubs seed skipped:', error.message || error);
    }

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
        ('c_1', 'p_10', 'Penalty kick attempt, 3rd minute', 'complete', 4.2, 'Confident execution under pressure.', '2 hours ago', 'Decision-making'),
        ('c_2', 'p_11', 'Counter-attack, left wing run', 'complete', 3.8, 'Pace was strong, timing can improve.', '5 hours ago', 'Pace & Agility'),
        ('c_3', 'p_12', 'One-on-one with goalkeeper', 'complete', 4.5, 'Excellent control and composure.', '1 day ago', 'Technical Skill'),
        ('c_4', 'p_13', 'Sprint and finish, 45th minute', 'submitted', NULL, '', 'Submitted 1 hour ago', 'Pace & Agility')
      ON CONFLICT (id) DO NOTHING;
    `);
  }

  await resetFabricatedPlayerStats(pool);
  await syncDefaultDashboardStats(pool);

  // Feature 031: sync profile skill ratings from complete/assessed clip JSON (ASC → latest wins).
  try {
    await backfillPlayerSkillRatingsFromClips(pool);
  } catch (error) {
    console.error('player skill ratings backfill failed:', error);
  }
}

async function listPlayers(teamName, query, actor, options) {
  const values = [];
  const predicates = [];
  const opts = options || {};
  const onlyMine = Boolean(opts.onlyMine);

  if (teamName && teamName !== 'all') {
    values.push(teamName);
    predicates.push(`t.name = $${values.length}`);
  }

  if (query) {
    values.push(`%${query}%`);
    predicates.push(`(LOWER(p.name) LIKE LOWER($${values.length}) OR LOWER(p.position) LIKE LOWER($${values.length}))`);
  }

  // Coach and ClubAdmin are always club-scoped via coach_clubs. onlyMine further
  // narrows to lead teams for Coach only. SystemAdmin / unknown: no scoping.
  if (isClubScopedActor(actor)) {
    values.push(actor.id);
    predicates.push(`t.club_id IN (SELECT club_id FROM coach_clubs WHERE user_id = $${values.length})`);
    if (onlyMine && isLeadScopedActor(actor)) {
      values.push(actor.id);
      predicates.push(`t.lead_coach_user_id = $${values.length}`);
    }
  }

  const whereSql = predicates.length ? `WHERE ${predicates.join(' AND ')}` : '';

  const result = await pool.query(
    `
      SELECT
        p.id,
        p.name,
        p.normalized_name AS "normalizedName",
        p.player_avatar_url AS "avatarUrl",
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

  const players = result.rows.map(toPlayerPayload);
  const playerIds = players.map((player) => player.id);
  const anyByPlayer = await listAnySkillRatingsByPlayerIds(playerIds);
  const sportByPlayer = await listSportSkillRatingsByPlayerIds(playerIds);
  return players.map((player) => Object.assign({}, player, {
    anySkillRatings: anyByPlayer.get(String(player.id)) || [],
    skillRatingsById: sportByPlayer.get(String(player.id)) || {}
  }));
}

// Resolves any active actor (Coach or SystemAdmin) by email. Returns null when
// the email is unknown or the user is inactive. Used by listPlayers to decide
// whether to apply coach scoping; SystemAdmin actors bypass scoping entirely.
async function resolveActorForPlayersList(actorEmail) {
  const email = String(actorEmail || '').trim().toLowerCase();
  if (!email) {
    return null;
  }
  const result = await pool.query(
    `SELECT id, role, status FROM users WHERE LOWER(email) = LOWER($1) LIMIT 1`,
    [email]
  );
  const actor = result.rows[0] || null;
  if (!actor || actor.status !== 'active') {
    return null;
  }
  return actor;
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
        p.player_avatar_url AS "avatarUrl",
        t.name AS "teamName",
        p.position,
        p.trend,
        p.birth_month AS "birthMonth",
        p.birth_year AS "birthYear"
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

// Resolves the active Coach actor for an incoming request. Returns null when
// the email is unknown, inactive, or not a Coach -- callers map that to 403.
async function resolveCoachActor(actorEmail) {
  return resolveClubEditorActor(actorEmail);
}

async function resolveClubEditorActor(actorEmail) {
  const email = String(actorEmail || '').trim().toLowerCase();
  if (!email) {
    return null;
  }
  const result = await pool.query(
    `SELECT id, name, email, role, status FROM users WHERE LOWER(email) = LOWER($1) LIMIT 1`,
    [email]
  );
  const actor = result.rows[0] || null;
  if (!isClubScopedActor(actor)) {
    return null;
  }
  return actor;
}

async function resolveActorUserByEmail(actorEmail) {
  const email = String(actorEmail || '').trim().toLowerCase();
  if (!email) {
    return null;
  }
  const result = await pool.query(
    `SELECT id, name, email, role, status FROM users WHERE LOWER(email) = LOWER($1) LIMIT 1`,
    [email]
  );
  return result.rows[0] || null;
}

async function listActorClubIds(userId) {
  const result = await pool.query(
    `SELECT club_id FROM coach_clubs WHERE user_id = $1`,
    [userId]
  );
  return result.rows.map((row) => row.club_id);
}

async function usersShareClub(actorId, targetUserId) {
  const result = await pool.query(
    `
      SELECT 1
      FROM coach_clubs a
      INNER JOIN coach_clubs b ON b.club_id = a.club_id
      WHERE a.user_id = $1 AND b.user_id = $2
      LIMIT 1
    `,
    [actorId, targetUserId]
  );
  return Boolean(result.rows[0]);
}

async function resolveUserAdminActor(payload) {
  const email = String((payload && payload.actorEmail) || '').trim().toLowerCase();
  const actor = await resolveActorUserByEmail(email);
  if (assertSystemAdminActor(actor)) {
    return { actor, isSystemAdmin: true };
  }
  if (actor && actor.role === 'ClubAdmin' && actor.status === 'active') {
    return { actor, isSystemAdmin: false };
  }
  return { actor: null, isSystemAdmin: false };
}

async function clubAdminMayManageUser(actor, targetUser) {
  if (!actor || !targetUser || targetUser.role !== 'Coach') {
    return false;
  }
  return usersShareClub(actor.id, targetUser.id);
}

const PLAYER_PROFILE_SELECT = `
        p.id,
        p.name,
        p.normalized_name AS "normalizedName",
        p.player_avatar_url AS "avatarUrl",
        t.name AS "teamName",
        p.position,
        p.trend,
        p.birth_month AS "birthMonth",
        p.birth_year AS "birthYear",
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
`;

// Loads a single player + stats row scoped to a team led by the given coach.
// Mirrors the dashboard query's join/scoping so GET profile and PATCH share
// the same "belongs to this coach" guard. Returns null when the player is not
// on any team led by the coach (callers map that to 404).
async function findPlayerProfileForCoach(playerId, coachId, executor = pool) {
  const result = await executor.query(
    `
      SELECT ${PLAYER_PROFILE_SELECT}
      FROM players p
      JOIN player_team_assignments a ON a.player_id = p.id
      JOIN teams t ON t.id = a.team_id
      JOIN users coach ON coach.id = t.lead_coach_user_id
      LEFT JOIN player_stats ps ON ps.player_id = p.id
      WHERE p.id = $1 AND coach.id = $2
      LIMIT 1
    `,
    [playerId, coachId]
  );
  return result.rows[0] || null;
}

// ClubAdmin: any player on a team in the actor's coach_clubs set.
async function findPlayerProfileInActorClubs(playerId, actorId, executor = pool) {
  const result = await executor.query(
    `
      SELECT ${PLAYER_PROFILE_SELECT}
      FROM players p
      JOIN player_team_assignments a ON a.player_id = p.id
      JOIN teams t ON t.id = a.team_id
      LEFT JOIN player_stats ps ON ps.player_id = p.id
      WHERE p.id = $1
        AND t.club_id IN (SELECT club_id FROM coach_clubs WHERE user_id = $2)
      LIMIT 1
    `,
    [playerId, actorId]
  );
  return result.rows[0] || null;
}

async function findPlayerProfileForEditor(playerId, actor, executor = pool) {
  if (!actor) {
    return null;
  }
  if (actor.role === 'ClubAdmin') {
    return findPlayerProfileInActorClubs(playerId, actor.id, executor);
  }
  if (actor.role === 'Coach') {
    return findPlayerProfileForCoach(playerId, actor.id, executor);
  }
  return null;
}

const DASHBOARD_PLAYER_SELECT = `
        p.id,
        p.name,
        p.normalized_name AS "normalizedName",
        p.player_avatar_url AS "avatarUrl",
        t.name AS "teamName",
        p.position,
        p.trend,
        p.birth_month AS "birthMonth",
        p.birth_year AS "birthYear",
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
`;

async function findPlayerDashboardByLookup(playerLookup, executor = pool) {
  const lookup = normalizeLookup(playerLookup || '');
  const result = await executor.query(
    `
      SELECT ${DASHBOARD_PLAYER_SELECT}
      FROM players p
      JOIN player_team_assignments a ON a.player_id = p.id
      JOIN teams t ON t.id = a.team_id
      LEFT JOIN player_stats ps ON ps.player_id = p.id
      WHERE ($1 = '' OR LOWER(p.name) = LOWER($1) OR LOWER(p.normalized_name) = LOWER($1) OR p.id = $1)
      ORDER BY p.name ASC
      LIMIT 1
    `,
    [lookup]
  );
  return result.rows[0] || null;
}

async function findPlayerDashboardById(playerId, executor = pool) {
  const result = await executor.query(
    `
      SELECT ${DASHBOARD_PLAYER_SELECT}
      FROM players p
      JOIN player_team_assignments a ON a.player_id = p.id
      JOIN teams t ON t.id = a.team_id
      LEFT JOIN player_stats ps ON ps.player_id = p.id
      WHERE p.id = $1
      LIMIT 1
    `,
    [playerId]
  );
  return result.rows[0] || null;
}

async function resolveShareEditorForPlayer(actorEmail, playerId) {
  const email = String(actorEmail || '').trim().toLowerCase();
  if (!email || !playerId) {
    return null;
  }
  const actorResult = await pool.query(
    `SELECT id, name, email, role, status FROM users WHERE LOWER(email) = LOWER($1) LIMIT 1`,
    [email]
  );
  const actor = actorResult.rows[0] || null;
  if (!actor || actor.status !== 'active') {
    return null;
  }
  if (actor.role === 'SystemAdmin') {
    const row = await findPlayerDashboardById(playerId);
    if (!row) {
      return null;
    }
    return { actor, player: row };
  }
  if (isClubScopedActor(actor)) {
    const row = await findPlayerProfileForEditor(playerId, actor);
    if (!row) {
      return null;
    }
    return { actor, player: row };
  }
  return null;
}

/** Coach (scoped) or SystemAdmin may read player change history. */
async function resolvePlayerHistoryViewer(actorEmail, playerId) {
  return resolveShareEditorForPlayer(actorEmail, playerId);
}

async function findActiveShareByToken(rawToken) {
  const token = String(rawToken || '').trim();
  if (!token) {
    return null;
  }
  const tokenHash = hashShareToken(token);
  const result = await pool.query(
    `
      SELECT id, player_id AS "playerId", created_by_user_id AS "createdByUserId", created_at AS "createdAt"
      FROM player_share_links
      WHERE token_hash = $1 AND revoked_at IS NULL
      LIMIT 1
    `,
    [tokenHash]
  );
  return result.rows[0] || null;
}

function shareNotFoundResponse() {
  return appError(404, 'not_found', 'This share link is not available.');
}

function buildGuestSharePageUrl(rawToken) {
  return './S2-player-dashboard.html?share=' + encodeURIComponent(String(rawToken || ''));
}

const TREND_VALUES = new Set(['improving', 'plateau', 'declining']);
const GROWTH_STATUS_VALUES = new Set(['on_track', 'watch', 'at_risk']);

// Coerces a payload value into a nullable trimmed string. Empty strings and
// nullish values collapse to null so optional columns stay NULL rather than ''.
function toNullableString(value) {
  if (value === null || value === undefined) {
    return null;
  }
  const text = String(value).trim();
  return text.length ? text : null;
}

// Coerces a payload value into a non-negative integer, or returns NaN when the
// value is present but not a valid count (so callers can reject it).
function toCountValue(value, fallback) {
  if (value === null || value === undefined || value === '') {
    return fallback;
  }
  const num = Number(value);
  if (!Number.isFinite(num) || num < 0) {
    return NaN;
  }
  return Math.floor(num);
}

// Coerces a payload value into a nullable finite number (scores). Empty/nullish
// collapses to null; a present-but-invalid value returns NaN for rejection.
function toNullableNumber(value) {
  if (value === null || value === undefined || value === '') {
    return null;
  }
  const num = Number(value);
  return Number.isFinite(num) ? num : NaN;
}

// Parses an incoming metric-change indicator. Accepts null/omitted (returns
// null) or an object with a non-empty label and valid trend. Returns the
// string 'invalid' when the shape is present but malformed.
function parseMetricChange(value) {
  if (value === null || value === undefined) {
    return null;
  }
  if (typeof value !== 'object') {
    return 'invalid';
  }
  const label = toNullableString(value.label);
  if (label === null) {
    return null;
  }
  const trend = String(value.trend || '').trim();
  if (!TREND_VALUES.has(trend)) {
    return 'invalid';
  }
  return { label, trend };
}

// Validates and normalizes optional birthMonth/birthYear from a player
// create/update payload. Year-only is allowed; month-only is rejected.
// Returns:
//   - { birthMonth: null, birthYear: null } when both blank.
//   - { birthMonth: null, birthYear } when year-only is valid.
//   - { birthMonth: 1-12, birthYear } when both are valid.
//   - { error: '...' } on month-only or invalid values.
function parseBirthFields(payload, now) {
  if (payload == null || typeof payload !== 'object') {
    return { birthMonth: null, birthYear: null };
  }

  const monthRaw = payload.birthMonth;
  const yearRaw = payload.birthYear;

  const monthBlank = monthRaw == null || monthRaw === '';
  const yearBlank = yearRaw == null || yearRaw === '';
  if (monthBlank && yearBlank) {
    return { birthMonth: null, birthYear: null };
  }
  if (!monthBlank && yearBlank) {
    return { error: 'Birth month cannot be set without a birth year.' };
  }

  const year = Number(yearRaw);
  if (!Number.isInteger(year)) {
    return { error: 'Birth year must be a whole number.' };
  }
  const currentYear = (now instanceof Date ? now : new Date()).getFullYear();
  if (year < 1960 || year > currentYear) {
    return { error: 'Birth year must be between 1960 and ' + currentYear + '.' };
  }

  if (monthBlank) {
    return { birthMonth: null, birthYear: year };
  }

  const month = Number(monthRaw);
  if (!Number.isInteger(month) || month < 1 || month > 12) {
    return { error: 'Birth month must be a whole number from 1 (January) to 12 (December).' };
  }

  return { birthMonth: month, birthYear: year };
}

// Validates and normalizes a PATCH /players/{id} body into the identity and
// stats shapes the persistence helpers expect. Returns { error } (a message)
// on the first validation failure, otherwise { identity, stats }.
function parseUpdateProfilePayload(payload) {
  const validChars = /^[A-Za-z' -]+$/;
  const name = toTitleCase(payload.name);
  if (!name || name.length < 2 || name.length > 60 || !validChars.test(name)) {
    return { error: 'Player name must be 2-60 chars and use letters, spaces, apostrophe, or hyphen.' };
  }

  const teamName = normalizeLookup(payload.teamName);
  if (!teamName || teamName.toLowerCase() === 'all') {
    return { error: 'Pick a team before saving.' };
  }

  const trend = String(payload.trend || '').trim();
  if (!TREND_VALUES.has(trend)) {
    return { error: 'Trend must be one of improving, plateau, or declining.' };
  }

  const position = toNullableString(payload.position) || 'Position not set';

  const birth = parseBirthFields(payload);
  if (birth.error) {
    return { error: birth.error };
  }

  const growthStatus = toNullableString(payload.growthStatus);
  if (growthStatus !== null && !GROWTH_STATUS_VALUES.has(growthStatus)) {
    return { error: 'Growth status must be on_track, watch, at_risk, or empty.' };
  }

  const totalMinutes = toCountValue(payload.totalMinutes, 0);
  const appearances = toCountValue(payload.appearances, 0);
  const clipSubmittedCount = toCountValue(payload.clipSubmittedCount, 0);
  const clipAssessedCount = toCountValue(payload.clipAssessedCount, 0);
  const clipPendingCount = toCountValue(payload.clipPendingCount, 0);
  if ([totalMinutes, appearances, clipSubmittedCount, clipAssessedCount, clipPendingCount].some((value) => Number.isNaN(value))) {
    return { error: 'Minutes, appearances, and clip counts must be non-negative whole numbers.' };
  }

  const averageScore = toNullableNumber(payload.averageScore);
  const lastMatchScore = toNullableNumber(payload.lastMatchScore);
  if (Number.isNaN(averageScore) || Number.isNaN(lastMatchScore)) {
    return { error: 'Scores must be numeric or left blank.' };
  }

  const currentLevelChange = parseMetricChange(payload.currentLevelChange);
  const fitnessChange = parseMetricChange(payload.fitnessChange);
  const skillProgressChange = parseMetricChange(payload.skillProgressChange);
  if ([currentLevelChange, fitnessChange, skillProgressChange].includes('invalid')) {
    return { error: 'Each metric change needs a label and a valid trend, or leave it blank.' };
  }

  const currentLevel = toNullableString(payload.currentLevel);
  const fitness = toNullableString(payload.fitness);
  const skillProgress = toNullableString(payload.skillProgress);
  const hasRating = [currentLevel, fitness, skillProgress].some(function (v) { return v !== null; });

  const avatarUrl = (payload && payload.avatarUrl !== undefined) ? String(payload.avatarUrl || '').trim() || null : null;

  return {
    identity: {
      name,
      normalizedName: normalizeComparable(name),
      teamName,
      position,
      trend,
      avatarUrl,
      birthMonth: birth.birthMonth,
      birthYear: birth.birthYear
    },
    stats: {
      growthStatus,
      currentLevel,
      fitness,
      skillProgress,
      totalMinutes,
      appearances,
      recentAvg: toNullableString(payload.recentAvg) || 'N/A',
      averageScore,
      trend,
      lastMatchScore,
      lastMatchSummary: toNullableString(payload.lastMatchSummary),
      clipSubmittedCount,
      clipAssessedCount,
      clipPendingCount,
      missingDataMessage: hasRating ? null : 'Performance metrics are not available yet.',
      currentLevelChange,
      fitnessChange,
      skillProgressChange
    }
  };
}

async function handlePlayersApi(req, res, requestUrl) {
  const logPath = String(requestUrl.pathname || '').replace(
    new RegExp(`^${apiPrefix}/share/[^/]+`),
    `${apiPrefix}/share/<token>`
  );
  console.log('API request', req.method, logPath);

  const mutatingMethods = new Set(['POST', 'PATCH', 'PUT', 'DELETE']);
  if (mutatingMethods.has(req.method) && requestUrl.pathname !== `${apiPrefix}/auth/login`) {
    const queryActorEmail = String(requestUrl.searchParams.get('actorEmail') || '').trim();
    const queryUserId = queryActorEmail ? await resolveUserIdByEmail(queryActorEmail) : null;
    logStructured(`api.${req.method.toLowerCase()}${requestUrl.pathname}`, queryUserId, {
      method: req.method,
      path: requestUrl.pathname
    });
  }

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
    const isSystemAdmin = assertSystemAdminActor(actor);
    const isClubEditor = isClubScopedActor(actor);
    if (!isSystemAdmin && !isClubEditor) {
      sendJson(res, 403, appError(403, 'forbidden', 'You do not have permission to perform this action.'));
      return;
    }

    let dashboardRow = null;
    if (isSystemAdmin) {
      dashboardRow = await findPlayerDashboardByLookup(playerName);
    } else if (actor.role === 'ClubAdmin') {
      const dashboardRows = await pool.query(
        `
          SELECT ${DASHBOARD_PLAYER_SELECT}
          FROM players p
          JOIN player_team_assignments a ON a.player_id = p.id
          JOIN teams t ON t.id = a.team_id
          LEFT JOIN player_stats ps ON ps.player_id = p.id
          WHERE t.club_id IN (SELECT club_id FROM coach_clubs WHERE user_id = $2)
            AND ($1 = '' OR LOWER(p.name) = LOWER($1) OR LOWER(p.normalized_name) = LOWER($1) OR p.id = $1)
          ORDER BY p.name ASC
          LIMIT 1
        `,
        [playerName, actor.id]
      );
      dashboardRow = dashboardRows.rows[0] || null;
    } else {
      const dashboardRows = await pool.query(
        `
          SELECT ${DASHBOARD_PLAYER_SELECT}
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
      dashboardRow = dashboardRows.rows[0] || null;
    }

    if (!dashboardRow) {
      sendJson(res, 404, appError(404, 'not_found', 'The selected player was not found anymore. Refresh and try again.'));
      return;
    }

    const skillRatings = await listSkillsForPlayer(dashboardRow.id);
    sendJson(res, 200, { data: toDashboardPayload(dashboardRow, skillRatings) });
    return;
  }

  const playerShareMatch = requestUrl.pathname.match(new RegExp(`^${apiPrefix}/players/([^/]+)/share$`));
  if (playerShareMatch && (req.method === 'GET' || req.method === 'POST' || req.method === 'DELETE')) {
    const playerId = decodeURIComponent(playerShareMatch[1] || '');
    let actorEmail = String(requestUrl.searchParams.get('actorEmail') || '').trim().toLowerCase();
    if (!actorEmail && (req.method === 'POST' || req.method === 'DELETE')) {
      try {
        const payload = await readJsonBody(req);
        actorEmail = String((payload && payload.actorEmail) || '').trim().toLowerCase();
      } catch {
        actorEmail = '';
      }
    }

    const editor = await resolveShareEditorForPlayer(actorEmail, playerId);
    if (!editor) {
      // Distinguish missing player vs forbidden when actor is valid but out of scope.
      const actorResult = await pool.query(
        `SELECT id, role, status FROM users WHERE LOWER(email) = LOWER($1) LIMIT 1`,
        [actorEmail]
      );
      const actor = actorResult.rows[0] || null;
      if (!actor || actor.status !== 'active' || (actor.role !== 'Coach' && actor.role !== 'SystemAdmin')) {
        sendJson(res, 403, appError(403, 'forbidden', 'You do not have permission to perform this action.'));
        return;
      }
      const anyPlayer = await findPlayerDashboardById(playerId);
      if (!anyPlayer) {
        sendJson(res, 404, appError(404, 'not_found', 'The selected player was not found anymore. Refresh and try again.'));
        return;
      }
      sendJson(res, 403, appError(403, 'forbidden', 'You do not have permission to perform this action.'));
      return;
    }

    if (req.method === 'GET') {
      const active = await pool.query(
        `
          SELECT id, created_at AS "createdAt"
          FROM player_share_links
          WHERE player_id = $1 AND revoked_at IS NULL
          ORDER BY created_at DESC
          LIMIT 1
        `,
        [playerId]
      );
      sendJson(res, 200, {
        data: {
          active: Boolean(active.rows[0]),
          shareId: active.rows[0] ? active.rows[0].id : null,
          createdAt: active.rows[0] ? active.rows[0].createdAt : null
        }
      });
      return;
    }

    if (req.method === 'DELETE') {
      const revoked = await pool.query(
        `
          UPDATE player_share_links
          SET revoked_at = NOW()
          WHERE player_id = $1 AND revoked_at IS NULL
          RETURNING id
        `,
        [playerId]
      );
      logStructured('share.revoke', editor.actor.id, {
        playerId,
        revokedCount: revoked.rowCount
      });
      sendJson(res, 200, { data: { revoked: revoked.rowCount > 0 } });
      return;
    }

    // POST — replace-on-create
    const rawToken = generateShareToken();
    const tokenHash = hashShareToken(rawToken);
    const shareId = 'psl_' + crypto.randomBytes(8).toString('hex');

    await pool.query(
      `
        UPDATE player_share_links
        SET revoked_at = NOW()
        WHERE player_id = $1 AND revoked_at IS NULL
      `,
      [playerId]
    );
    await pool.query(
      `
        INSERT INTO player_share_links (id, player_id, token_hash, created_by_user_id)
        VALUES ($1, $2, $3, $4)
      `,
      [shareId, playerId, tokenHash, editor.actor.id]
    );

    const url = buildGuestSharePageUrl(rawToken);
    logStructured('share.create', editor.actor.id, {
      playerId,
      shareId
    });
    sendJson(res, 200, {
      data: {
        shareId,
        playerId,
        token: rawToken,
        url
      }
    });
    return;
  }

  const shareDashboardMatch = requestUrl.pathname.match(new RegExp(`^${apiPrefix}/share/([^/]+)/dashboard$`));
  if (req.method === 'GET' && shareDashboardMatch) {
    const rawToken = decodeURIComponent(shareDashboardMatch[1] || '');
    const share = await findActiveShareByToken(rawToken);
    if (!share) {
      sendJson(res, 404, shareNotFoundResponse());
      return;
    }
    const dashboardRow = await findPlayerDashboardById(share.playerId);
    if (!dashboardRow) {
      sendJson(res, 404, shareNotFoundResponse());
      return;
    }
    const skillRatings = await listSkillsForPlayer(dashboardRow.id);
    sendJson(res, 200, { data: toDashboardPayload(dashboardRow, skillRatings) });
    return;
  }

  const shareClipsMatch = requestUrl.pathname.match(new RegExp(`^${apiPrefix}/share/([^/]+)/clips$`));
  if (req.method === 'GET' && shareClipsMatch) {
    const rawToken = decodeURIComponent(shareClipsMatch[1] || '');
    const share = await findActiveShareByToken(rawToken);
    if (!share) {
      sendJson(res, 404, shareNotFoundResponse());
      return;
    }
    const clipRows = await pool.query(
      `
        SELECT
          c.id,
          c.player_id AS "playerId",
          c.situation,
          c.status,
          c.score,
          c.summary,
          c.comments,
          c.submitted_at_label AS "submittedAt",
          c.skill,
          c.skill_focus AS "skillFocus",
          c.skill_ratings AS "skillRatings",
          c.error_message AS "errorMessage",
          c.video_storage_path AS "videoStoragePath",
          c.video_storage_path AS "path",
          p.name AS "playerName",
          t.name AS "teamName"
        FROM clips c
        JOIN players p ON p.id = c.player_id
        LEFT JOIN player_team_assignments a ON a.player_id = p.id
        LEFT JOIN teams t ON t.id = a.team_id
        WHERE c.player_id = $1
        ORDER BY c.created_at DESC
      `,
      [share.playerId]
    );
    const segmentsByClip = await listSegmentsForClips(
      pool,
      clipRows.rows.map((row) => row.id)
    );
    sendJson(res, 200, {
      data: clipRows.rows.map((row) => toClipResponse(row, segmentsByClip.get(row.id) || []))
    });
    return;
  }

  const shareClipMediaMatch = requestUrl.pathname.match(
    new RegExp(`^${apiPrefix}/share/([^/]+)/clips/([^/]+)/media$`)
  );
  if (req.method === 'GET' && shareClipMediaMatch) {
    const rawToken = decodeURIComponent(shareClipMediaMatch[1] || '');
    const clipId = decodeURIComponent(shareClipMediaMatch[2] || '');
    const share = await findActiveShareByToken(rawToken);
    if (!share) {
      sendJson(res, 404, shareNotFoundResponse());
      return;
    }
    const clipOwner = await pool.query(
      `SELECT player_id AS "playerId" FROM clips WHERE id = $1 LIMIT 1`,
      [clipId]
    );
    if (!clipOwner.rows[0] || String(clipOwner.rows[0].playerId) !== String(share.playerId)) {
      sendJson(res, 404, shareNotFoundResponse());
      return;
    }
    const source = String(requestUrl.searchParams.get('source') || 'first').trim().toLowerCase();
    const resolved = await resolveClipMediaPath(pool, clipId, source);
    if (resolved.status !== 200 || !resolved.filePath) {
      sendJson(res, resolved.status || 404, appError(
        resolved.status || 404,
        resolved.code || 'not_found',
        resolved.message || 'No video file is available for this clip.'
      ));
      return;
    }
    streamVideoFile(req, res, resolved.filePath);
    return;
  }

  const shareClipThumbMatch = requestUrl.pathname.match(
    new RegExp(`^${apiPrefix}/share/([^/]+)/clips/([^/]+)/thumbnail$`)
  );
  if (req.method === 'GET' && shareClipThumbMatch) {
    const rawToken = decodeURIComponent(shareClipThumbMatch[1] || '');
    const clipId = decodeURIComponent(shareClipThumbMatch[2] || '');
    const share = await findActiveShareByToken(rawToken);
    if (!share) {
      sendJson(res, 404, shareNotFoundResponse());
      return;
    }
    const clipOwner = await pool.query(
      `SELECT player_id AS "playerId" FROM clips WHERE id = $1 LIMIT 1`,
      [clipId]
    );
    if (!clipOwner.rows[0] || String(clipOwner.rows[0].playerId) !== String(share.playerId)) {
      sendJson(res, 404, shareNotFoundResponse());
      return;
    }
    const resolved = await resolveClipThumbnailPath(pool, clipId);
    if (resolved.status !== 200 || !resolved.filePath) {
      sendJson(res, resolved.status || 404, appError(
        resolved.status || 404,
        resolved.code || 'not_found',
        resolved.message || 'No thumbnail is available for this clip.'
      ));
      return;
    }
    streamJpegFile(res, resolved.filePath);
    return;
  }

  if (req.method === 'GET' && requestUrl.pathname === `${apiPrefix}/teams`) {
    const clubId = String(requestUrl.searchParams.get('clubId') || '').trim();
    const actorEmail = String(requestUrl.searchParams.get('actorEmail') || '').trim().toLowerCase();
    const statusFilter = String(requestUrl.searchParams.get('status') || 'active').trim().toLowerCase();

    let actor = null;
    if (actorEmail) {
      const actorResult = await pool.query(
        `SELECT id, role, status FROM users WHERE LOWER(email) = LOWER($1) LIMIT 1`,
        [actorEmail]
      );
      actor = actorResult.rows[0] || null;
    }

    const where = [];
    const params = [];
    if (clubId) {
      params.push(clubId);
      where.push(`t.club_id = $${params.length}`);
    }
    if (statusFilter !== 'all' && (statusFilter === 'active' || statusFilter === 'inactive')) {
      params.push(statusFilter);
      where.push(`t.status = $${params.length}`);
    }
    if (actorEmail) {
      if (isClubScopedActor(actor)) {
        params.push(actor.id);
        where.push(
          `t.club_id IN (SELECT club_id FROM coach_clubs WHERE user_id = $${params.length})`
        );
      } else if (!actor || actor.role !== 'SystemAdmin') {
        // actorEmail supplied but the user is unknown, inactive, or not club-scoped.
        // Treat as "no teams visible" rather than leaking the unfiltered list.
        where.push('FALSE');
      }
    }

    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

    const teamRows = await pool.query(
      `
      SELECT
        t.id,
        t.name,
        t.age_group AS "ageGroup",
        t.lead_coach_user_id AS "leadCoachUserId",
        u.name AS "leadCoach",
        u.email AS "leadCoachEmail",
        c.id AS "clubId",
        c.name AS "clubName",
        s.id AS "sportId",
        s.name AS "sportName",
        t.status,
        COUNT(a.player_id) AS "playerCount"
      FROM teams t
      LEFT JOIN users u ON u.id = t.lead_coach_user_id
      LEFT JOIN clubs c ON c.id = t.club_id
      LEFT JOIN sports s ON s.id = t.sport_id
      LEFT JOIN player_team_assignments a ON a.team_id = t.id
      ${whereSql}
      GROUP BY t.id, t.name, t.age_group, t.lead_coach_user_id, u.name, u.email, c.id, c.name, s.id, s.name, t.status
      ORDER BY t.name ASC
      `,
      params
    );

    sendJson(res, 200, { data: teamRows.rows.map(toTeamPayload) });
    return;
  }

  if (req.method === 'GET' && requestUrl.pathname === `${apiPrefix}/clubs`) {
    const actorEmail = String(requestUrl.searchParams.get('actorEmail') || '').trim().toLowerCase();
    const statusFilterRaw = String(requestUrl.searchParams.get('status') || '').trim().toLowerCase();
    const statusFilter = ['active', 'inactive', 'all'].includes(statusFilterRaw) ? statusFilterRaw : 'active';

    let actor = null;
    if (actorEmail) {
      const actorResult = await pool.query(
        `SELECT id, role, status FROM users WHERE LOWER(email) = LOWER($1) LIMIT 1`,
        [actorEmail]
      );
      actor = actorResult.rows[0] || null;
    }

    let clubRows;
    const statusClause = statusFilter === 'all' ? '' : `AND c.status = '${statusFilter}'`;
    if (isClubScopedActor(actor)) {
      clubRows = await pool.query(
        `
          SELECT c.id, c.name, c.status,
            (SELECT COUNT(*)::int FROM coach_clubs cc2 WHERE cc2.club_id = c.id) AS "coachCount",
            (SELECT COUNT(*)::int FROM teams t WHERE t.club_id = c.id) AS "teamCount"
          FROM clubs c
          INNER JOIN coach_clubs cc ON cc.club_id = c.id
          WHERE cc.user_id = $1 ${statusClause}
          ORDER BY c.name ASC
          `,
        [actor.id]
      );
    } else if (actorEmail && !assertSystemAdminActor(actor)) {
      clubRows = { rows: [] };
    } else {
      clubRows = await pool.query(
        `
        SELECT c.id, c.name, c.status,
          (SELECT COUNT(*)::int FROM coach_clubs cc2 WHERE cc2.club_id = c.id) AS "coachCount",
          (SELECT COUNT(*)::int FROM teams t WHERE t.club_id = c.id) AS "teamCount"
        FROM clubs c
        ${statusFilter === 'all' ? '' : 'WHERE c.status = $1'}
        ORDER BY c.name ASC
        `,
        statusFilter === 'all' ? [] : [statusFilter]
      );
    }

    sendJson(res, 200, { data: clubRows.rows.map(toClubPayload) });
    return;
  }

  if (req.method === 'POST' && requestUrl.pathname === `${apiPrefix}/clubs`) {
    const payload = await readJsonBody(req);
    const actor = await resolveSystemAdminActor(payload.actorEmail);
    if (!assertSystemAdminActor(actor)) {
      sendJson(res, 403, appError(403, 'forbidden', 'You do not have permission to perform this action.'));
      return;
    }
    if (actor && actor.id) {
      logStructured('api.post.clubs.actor', actor.id, { path: requestUrl.pathname });
    }

    const name = normalizeLookup(payload.name);
    if (!name || name.length < 2 || name.length > 60) {
      sendJson(res, 400, appError(400, 'validation_error', 'Club name must be 2-60 characters.'));
      return;
    }

    const existing = await pool.query(`SELECT id FROM clubs WHERE LOWER(name) = LOWER($1) LIMIT 1`, [name]);
    if (existing.rows[0]) {
      sendJson(res, 409, appError(409, 'conflict', 'A club with this name already exists.'));
      return;
    }

    const clubId = `c_${Date.now().toString(36)}`;
    const inserted = await pool.query(
      `INSERT INTO clubs (id, name, status) VALUES ($1, $2, 'active') RETURNING id, name, status`,
      [clubId, name]
    );
    sendJson(res, 201, { data: toClubPayload({ ...inserted.rows[0], coachCount: 0, teamCount: 0 }) });
    return;
  }

  if (req.method === 'PATCH' && requestUrl.pathname.match(/^\/api\/v1\/clubs\/([^/]+)$/)) {
    const match = requestUrl.pathname.match(/^\/api\/v1\/clubs\/([^/]+)$/);
    const clubId = decodeURIComponent(match[1]);

    const payload = await readJsonBody(req);
    const actor = await resolveSystemAdminActor(payload.actorEmail);
    if (!assertSystemAdminActor(actor)) {
      sendJson(res, 403, appError(403, 'forbidden', 'You do not have permission to perform this action.'));
      return;
    }

    const name = normalizeLookup(payload.name);
    if (!name || name.length < 2 || name.length > 60) {
      sendJson(res, 400, appError(400, 'validation_error', 'Club name must be 2-60 characters.'));
      return;
    }

    const existing = await pool.query(`SELECT id FROM clubs WHERE id = $1 LIMIT 1`, [clubId]);
    if (!existing.rows[0]) {
      sendJson(res, 404, appError(404, 'not_found', 'The selected club was not found anymore. Refresh and try again.'));
      return;
    }

    const collision = await pool.query(`SELECT id FROM clubs WHERE LOWER(name) = LOWER($1) AND id <> $2 LIMIT 1`, [name, clubId]);
    if (collision.rows[0]) {
      sendJson(res, 409, appError(409, 'conflict', 'A club with this name already exists.'));
      return;
    }

    const updated = await pool.query(
      `UPDATE clubs SET name = $1, updated_at = NOW() WHERE id = $2 RETURNING id, name, status`,
      [name, clubId]
    );
    const counts = await pool.query(
      `SELECT
         (SELECT COUNT(*)::int FROM coach_clubs WHERE club_id = $1) AS "coachCount",
         (SELECT COUNT(*)::int FROM teams WHERE club_id = $1) AS "teamCount"`,
      [clubId]
    );
    sendJson(res, 200, { data: toClubPayload({ ...updated.rows[0], ...counts.rows[0] }) });
    return;
  }

  if (req.method === 'PATCH' && requestUrl.pathname.match(/^\/api\/v1\/clubs\/([^/]+)\/status$/)) {
    const match = requestUrl.pathname.match(/^\/api\/v1\/clubs\/([^/]+)\/status$/);
    const clubId = decodeURIComponent(match[1]);

    const payload = await readJsonBody(req);
    const actor = await resolveSystemAdminActor(payload.actorEmail);
    if (!assertSystemAdminActor(actor)) {
      sendJson(res, 403, appError(403, 'forbidden', 'You do not have permission to perform this action.'));
      return;
    }

    const status = String(payload.status || '').trim().toLowerCase();
    if (!['active', 'inactive'].includes(status)) {
      sendJson(res, 400, appError(400, 'validation_error', 'Status must be active or inactive.'));
      return;
    }

    const existing = await pool.query(`SELECT id FROM clubs WHERE id = $1 LIMIT 1`, [clubId]);
    if (!existing.rows[0]) {
      sendJson(res, 404, appError(404, 'not_found', 'The selected club was not found anymore. Refresh and try again.'));
      return;
    }

    const updated = await pool.query(
      `UPDATE clubs SET status = $1, updated_at = NOW() WHERE id = $2 RETURNING id, name, status`,
      [status, clubId]
    );
    const counts = await pool.query(
      `SELECT
         (SELECT COUNT(*)::int FROM coach_clubs WHERE club_id = $1) AS "coachCount",
         (SELECT COUNT(*)::int FROM teams WHERE club_id = $1) AS "teamCount"`,
      [clubId]
    );
    sendJson(res, 200, { data: toClubPayload({ ...updated.rows[0], ...counts.rows[0] }) });
    return;
  }

  if (req.method === 'POST' && requestUrl.pathname.match(/^\/api\/v1\/clubs\/([^/]+)\/coaches$/)) {
    const match = requestUrl.pathname.match(/^\/api\/v1\/clubs\/([^/]+)\/coaches$/);
    const clubId = decodeURIComponent(match[1]);

    const payload = await readJsonBody(req);
    const actor = await resolveSystemAdminActor(payload.actorEmail);
    if (!assertSystemAdminActor(actor)) {
      sendJson(res, 403, appError(403, 'forbidden', 'You do not have permission to perform this action.'));
      return;
    }

    const targetUserId = String(payload.userId || '').trim();
    if (!targetUserId) {
      sendJson(res, 400, appError(400, 'validation_error', 'A user must be selected.'));
      return;
    }

    const user = await pool.query(
      `SELECT id, name, email, role, status FROM users WHERE id = $1 LIMIT 1`,
      [targetUserId]
    );
    if (!user.rows[0]) {
      sendJson(res, 404, appError(404, 'not_found', 'The selected user was not found anymore. Refresh and try again.'));
      return;
    }
    if (user.rows[0].status !== 'active') {
      sendJson(res, 400, appError(400, 'validation_error', 'Inactive users cannot be assigned to a club.'));
      return;
    }

    const club = await pool.query(`SELECT id, name, status FROM clubs WHERE id = $1 LIMIT 1`, [clubId]);
    if (!club.rows[0]) {
      sendJson(res, 404, appError(404, 'not_found', 'The selected club was not found anymore. Refresh and try again.'));
      return;
    }
    if (club.rows[0].status !== 'active') {
      sendJson(res, 400, appError(400, 'validation_error', 'Inactive clubs cannot accept new members.'));
      return;
    }

    await pool.query(
      `INSERT INTO coach_clubs (user_id, club_id) VALUES ($1, $2) ON CONFLICT (user_id, club_id) DO NOTHING`,
      [targetUserId, clubId]
    );

    sendJson(res, 201, {
      data: {
        userId: targetUserId,
        clubId,
        clubName: club.rows[0].name,
        status: 'active'
      }
    });
    return;
  }

  if (req.method === 'POST' && requestUrl.pathname.match(/^\/api\/v1\/clubs\/([^/]+)\/teams$/)) {
    const match = requestUrl.pathname.match(/^\/api\/v1\/clubs\/([^/]+)\/teams$/);
    const clubId = decodeURIComponent(match[1]);

    const payload = await readJsonBody(req);
    const actor = await resolveSystemAdminActor(payload.actorEmail);
    if (!assertSystemAdminActor(actor)) {
      sendJson(res, 403, appError(403, 'forbidden', 'You do not have permission to perform this action.'));
      return;
    }

    const teamId = String(payload.teamId || '').trim();
    if (!teamId) {
      sendJson(res, 400, appError(400, 'validation_error', 'A team must be selected.'));
      return;
    }

    const team = await pool.query(
      `SELECT id, lead_coach_user_id, status FROM teams WHERE id = $1 LIMIT 1`,
      [teamId]
    );
    if (!team.rows[0]) {
      sendJson(res, 404, appError(404, 'not_found', 'The selected team was not found anymore. Refresh and try again.'));
      return;
    }
    const club = await pool.query(`SELECT id FROM clubs WHERE id = $1 LIMIT 1`, [clubId]);
    if (!club.rows[0]) {
      sendJson(res, 404, appError(404, 'not_found', 'The selected club was not found anymore. Refresh and try again.'));
      return;
    }

    if (team.rows[0].club_id === clubId) {
      sendJson(res, 400, appError(400, 'validation_error', 'The team is already in this club.'));
      return;
    }

    const coach = await pool.query(
      `SELECT id, name, email FROM users WHERE id = $1 LIMIT 1`,
      [team.rows[0].lead_coach_user_id]
    );
    const clubRow = await pool.query(`SELECT id, name FROM clubs WHERE id = $1 LIMIT 1`, [clubId]);

    await pool.query('BEGIN');
    try {
      await pool.query(
        `UPDATE teams SET club_id = $1, updated_at = NOW() WHERE id = $2`,
        [clubId, teamId]
      );
      if (coach.rows[0]) {
        await pool.query(
          `INSERT INTO coach_clubs (user_id, club_id) VALUES ($1, $2) ON CONFLICT (user_id, club_id) DO NOTHING`,
          [coach.rows[0].id, clubId]
        );
      }
      await pool.query('COMMIT');
    } catch (error) {
      await pool.query('ROLLBACK');
      sendJson(res, 500, appError(500, 'unknown', 'Could not move the team to the new club.'));
      return;
    }

    const refreshed = await pool.query(
      `SELECT t.id, t.name, t.age_group AS "ageGroup", u.name AS "leadCoach", u.email AS "leadCoachEmail",
              c.id AS "clubId", c.name AS "clubName",
              s.id AS "sportId", s.name AS "sportName",
              t.status,
              (SELECT COUNT(*)::int FROM player_team_assignments a WHERE a.team_id = t.id) AS "playerCount"
       FROM teams t
       LEFT JOIN users u ON u.id = t.lead_coach_user_id
       LEFT JOIN clubs c ON c.id = t.club_id
       LEFT JOIN sports s ON s.id = t.sport_id
       WHERE t.id = $1
       GROUP BY t.id, t.name, t.age_group, u.name, u.email, c.id, c.name, s.id, s.name, t.status`,
      [teamId]
    );
    sendJson(res, 200, { data: toTeamPayload(refreshed.rows[0]) });
    return;
  }

  if (req.method === 'GET' && requestUrl.pathname.match(/^\/api\/v1\/users\/([^/]+)\/clubs$/)) {
    const match = requestUrl.pathname.match(/^\/api\/v1\/users\/([^/]+)\/clubs$/);
    const userId = decodeURIComponent(match[1]);

    const actorEmail = String(requestUrl.searchParams.get('actorEmail') || '').trim().toLowerCase();
    const actor = await resolveSystemAdminActor(actorEmail);
    if (!assertSystemAdminActor(actor)) {
      sendJson(res, 403, appError(403, 'forbidden', 'You do not have permission to perform this action.'));
      return;
    }

    const user = await pool.query(`SELECT id FROM users WHERE id = $1 LIMIT 1`, [userId]);
    if (!user.rows[0]) {
      sendJson(res, 404, appError(404, 'not_found', 'The selected user was not found anymore. Refresh and try again.'));
      return;
    }

    const memberships = await pool.query(
      `SELECT cc.user_id AS "userId", cc.club_id AS "clubId", c.name AS "clubName", c.status
       FROM coach_clubs cc
       INNER JOIN clubs c ON c.id = cc.club_id
       WHERE cc.user_id = $1
       ORDER BY c.name ASC`,
      [userId]
    );
    sendJson(res, 200, { data: memberships.rows.map(toUserClubPayload) });
    return;
  }

  if (req.method === 'POST' && requestUrl.pathname.match(/^\/api\/v1\/users\/([^/]+)\/clubs$/)) {
    const match = requestUrl.pathname.match(/^\/api\/v1\/users\/([^/]+)\/clubs$/);
    const userId = decodeURIComponent(match[1]);

    const payload = await readJsonBody(req);
    const { actor, isSystemAdmin } = await resolveUserAdminActor(payload);
    if (!actor) {
      sendJson(res, 403, appError(403, 'forbidden', 'You do not have permission to perform this action.'));
      return;
    }

    const clubId = String(payload.clubId || '').trim();
    if (!clubId) {
      sendJson(res, 400, appError(400, 'validation_error', 'A club must be selected.'));
      return;
    }

    if (!isSystemAdmin) {
      const membership = await pool.query(
        `SELECT 1 FROM coach_clubs WHERE user_id = $1 AND club_id = $2 LIMIT 1`,
        [actor.id, clubId]
      );
      if (!membership.rows[0]) {
        sendJson(res, 403, appError(403, 'forbidden', 'You do not have permission to perform this action.'));
        return;
      }
    }

    const user = await pool.query(
      `SELECT id, name, email, role, status FROM users WHERE id = $1 LIMIT 1`,
      [userId]
    );
    if (!user.rows[0]) {
      sendJson(res, 404, appError(404, 'not_found', 'The selected user was not found anymore. Refresh and try again.'));
      return;
    }
    if (!isSystemAdmin && user.rows[0].role !== 'Coach') {
      sendJson(res, 403, appError(403, 'forbidden', 'You do not have permission to perform this action.'));
      return;
    }
    if (user.rows[0].status !== 'active') {
      sendJson(res, 400, appError(400, 'validation_error', 'Inactive users cannot be assigned to a club.'));
      return;
    }

    const club = await pool.query(`SELECT id, name, status FROM clubs WHERE id = $1 LIMIT 1`, [clubId]);
    if (!club.rows[0]) {
      sendJson(res, 404, appError(404, 'not_found', 'The selected club was not found anymore. Refresh and try again.'));
      return;
    }
    if (club.rows[0].status !== 'active') {
      sendJson(res, 400, appError(400, 'validation_error', 'Inactive clubs cannot accept new members.'));
      return;
    }

    const existing = await pool.query(
      `SELECT 1 FROM coach_clubs WHERE user_id = $1 AND club_id = $2 LIMIT 1`,
      [userId, clubId]
    );
    const alreadyMember = existing.rows.length > 0;
    if (!alreadyMember) {
      await pool.query(
        `INSERT INTO coach_clubs (user_id, club_id) VALUES ($1, $2) ON CONFLICT (user_id, club_id) DO NOTHING`,
        [userId, clubId]
      );
    }

    const status = alreadyMember ? 200 : 201;
    sendJson(res, status, {
      data: {
        userId,
        clubId,
        clubName: club.rows[0].name,
        status: 'active'
      }
    });
    return;
  }

  if (req.method === 'DELETE' && requestUrl.pathname.match(/^\/api\/v1\/users\/([^/]+)\/clubs\/([^/]+)$/)) {
    const match = requestUrl.pathname.match(/^\/api\/v1\/users\/([^/]+)\/clubs\/([^/]+)$/);
    const userId = decodeURIComponent(match[1]);
    const clubId = decodeURIComponent(match[2]);

    const actorEmail = String(requestUrl.searchParams.get('actorEmail') || '').trim().toLowerCase();
    const { actor, isSystemAdmin } = await resolveUserAdminActor({ actorEmail });
    if (!actor) {
      sendJson(res, 403, appError(403, 'forbidden', 'You do not have permission to perform this action.'));
      return;
    }
    if (!isSystemAdmin) {
      const membership = await pool.query(
        `SELECT 1 FROM coach_clubs WHERE user_id = $1 AND club_id = $2 LIMIT 1`,
        [actor.id, clubId]
      );
      if (!membership.rows[0]) {
        sendJson(res, 403, appError(403, 'forbidden', 'You do not have permission to perform this action.'));
        return;
      }
      const target = await pool.query(`SELECT id, role, status FROM users WHERE id = $1 LIMIT 1`, [userId]);
      if (!target.rows[0] || target.rows[0].role !== 'Coach') {
        sendJson(res, 403, appError(403, 'forbidden', 'You do not have permission to perform this action.'));
        return;
      }
    }

    const removed = await pool.query(
      `DELETE FROM coach_clubs WHERE user_id = $1 AND club_id = $2`,
      [userId, clubId]
    );
    if (removed.rowCount === 0) {
      sendJson(res, 404, appError(404, 'not_found', 'The user was not a member of this club.'));
      return;
    }
    sendJson(res, 204, '');
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
    if (!TEAM_EDITOR_ROLES.includes(effectiveRole) || !actorUser || actorUser.status !== 'active') {
      sendJson(res, 403, appError(403, 'forbidden', 'You do not have permission to perform this action.'));
      return;
    }
    logStructured('api.post.teams.actor', actorUser.id, { path: requestUrl.pathname, role: actorUser.role });

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
    if (effectiveRole === 'SystemAdmin' || effectiveRole === 'ClubAdmin') {
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

    let clubId = String(payload.clubId || '').trim();
    if (!clubId) {
      if (effectiveRole === 'Coach' || effectiveRole === 'ClubAdmin') {
        const defaultClub = await pool.query(
          `SELECT club_id FROM coach_clubs WHERE user_id = $1 ORDER BY created_at ASC LIMIT 1`,
          [actorUser.id]
        );
        clubId = defaultClub.rows[0] ? defaultClub.rows[0].club_id : '';
      }
      if (!clubId) {
        sendJson(res, 400, appError(400, 'validation_error', 'Please select a club for this team.'));
        return;
      }
    }

    const clubRow = await pool.query(`SELECT id FROM clubs WHERE id = $1 LIMIT 1`, [clubId]);
    if (!clubRow.rows[0]) {
      sendJson(res, 400, appError(400, 'validation_error', 'The selected club could not be found.'));
      return;
    }

    if (effectiveRole === 'ClubAdmin') {
      const membership = await pool.query(
        `SELECT 1 FROM coach_clubs WHERE user_id = $1 AND club_id = $2 LIMIT 1`,
        [actorUser.id, clubId]
      );
      if (!membership.rows[0]) {
        sendJson(res, 403, appError(403, 'forbidden_scope', 'Club Admins can only create teams in clubs they belong to.'));
        return;
      }
    }

    let sportId = String(payload.sportId || '').trim();
    if (!sportId) {
      sportId = 'sport_soccer';
    }
    const sportRow = await pool.query(
      `SELECT id FROM sports WHERE id = $1 AND status = 'active' LIMIT 1`,
      [sportId]
    );
    if (!sportRow.rows[0]) {
      sendJson(res, 400, appError(400, 'validation_error', 'The selected sport could not be found.'));
      return;
    }

    const teamId = `t_${Date.now()}_${Math.floor(Math.random() * 10000)}`;
    await pool.query(
      `INSERT INTO teams (id, name, age_group, lead_coach_user_id, club_id, sport_id) VALUES ($1, $2, $3, $4, $5, $6)`,
      [teamId, teamName, ageGroup, leadCoachUserId, clubId, sportId]
    );

    if (effectiveRole === 'SystemAdmin' || effectiveRole === 'ClubAdmin') {
      await pool.query(
        `INSERT INTO coach_clubs (user_id, club_id) VALUES ($1, $2) ON CONFLICT (user_id, club_id) DO NOTHING`,
        [leadCoachUserId, clubId]
      );
    }

    const created = await pool.query(`
      SELECT
        t.id,
        t.name,
        t.age_group AS "ageGroup",
        t.lead_coach_user_id AS "leadCoachUserId",
        u.name AS "leadCoach",
        u.email AS "leadCoachEmail",
        c.id AS "clubId",
        c.name AS "clubName",
        s.id AS "sportId",
        s.name AS "sportName",
        t.status,
        COUNT(a.player_id) AS "playerCount"
      FROM teams t
      LEFT JOIN users u ON u.id = t.lead_coach_user_id
      LEFT JOIN clubs c ON c.id = t.club_id
      LEFT JOIN sports s ON s.id = t.sport_id
      LEFT JOIN player_team_assignments a ON a.team_id = t.id
      WHERE t.id = $1
      GROUP BY t.id, t.name, t.age_group, t.lead_coach_user_id, u.name, u.email, c.id, c.name, s.id, s.name, t.status
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
    if (!TEAM_EDITOR_ROLES.includes(effectiveRole) || !actorUser || actorUser.status !== 'active') {
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

    await pool.query(
      `INSERT INTO coach_clubs (user_id, club_id)
       SELECT $1, t.club_id FROM teams t WHERE t.id = $2
       ON CONFLICT (user_id, club_id) DO NOTHING`,
      [coach.rows[0].id, team.rows[0].id]
    );

    const updated = await pool.query(`
      SELECT
        t.id,
        t.name,
        t.age_group AS "ageGroup",
        t.lead_coach_user_id AS "leadCoachUserId",
        u.name AS "leadCoach",
        u.email AS "leadCoachEmail",
        c.id AS "clubId",
        c.name AS "clubName",
        s.id AS "sportId",
        s.name AS "sportName",
        t.status,
        COUNT(a.player_id) AS "playerCount"
      FROM teams t
      LEFT JOIN users u ON u.id = t.lead_coach_user_id
      LEFT JOIN clubs c ON c.id = t.club_id
      LEFT JOIN sports s ON s.id = t.sport_id
      LEFT JOIN player_team_assignments a ON a.team_id = t.id
      WHERE t.id = $1
      GROUP BY t.id, t.name, t.age_group, t.lead_coach_user_id, u.name, u.email, c.id, c.name, s.id, s.name, t.status
      LIMIT 1
    `, [team.rows[0].id]);

    sendJson(res, 200, { data: toTeamPayload(updated.rows[0]) });
    return;
  }

  if (req.method === 'POST' && requestUrl.pathname.match(/^\/api\/v1\/teams\/([^/]+)\/update$/)) {
    const match = requestUrl.pathname.match(/^\/api\/v1\/teams\/([^/]+)\/update$/);
    const teamId = decodeURIComponent(match[1]);

    const payload = await readJsonBody(req);
    const actorEmail = String(payload.actorEmail || '').trim().toLowerCase();
    const actorRole = String(payload.actorRole || '').trim();
    const newCoachEmail = String(payload.coachEmail || '').trim().toLowerCase();
    const newClubId = String(payload.clubId || '').trim();
    const newStatus = String(payload.status || '').trim().toLowerCase();

    let actorUser = null;
    if (actorEmail) {
      const actorResult = await pool.query(
        `SELECT id, role, status FROM users WHERE LOWER(email) = LOWER($1) LIMIT 1`,
        [actorEmail]
      );
      actorUser = actorResult.rows[0] || null;
    }

    const effectiveRole = actorUser ? actorUser.role : actorRole;
    if (!TEAM_EDITOR_ROLES.includes(effectiveRole) || !actorUser || actorUser.status !== 'active') {
      sendJson(res, 403, appError(403, 'forbidden', 'You do not have permission to perform this action.'));
      return;
    }

    if (!newCoachEmail || !newClubId || !['active', 'inactive'].includes(newStatus)) {
      sendJson(res, 400, appError(400, 'validation_error', 'Please review the form fields and try again.'));
      return;
    }

    const newSportId = String(payload.sportId || '').trim() || 'sport_soccer';
    const sportRow = await pool.query(
      `SELECT id FROM sports WHERE id = $1 AND status = 'active' LIMIT 1`,
      [newSportId]
    );
    if (!sportRow.rows[0]) {
      sendJson(res, 400, appError(400, 'validation_error', 'The selected sport could not be found.'));
      return;
    }

    const existing = await pool.query(
      `SELECT id, name, age_group AS "ageGroup", club_id AS "clubId" FROM teams WHERE id = $1 LIMIT 1`,
      [teamId]
    );
    if (!existing.rows[0]) {
      sendJson(res, 404, appError(404, 'not_found', 'The selected team was not found anymore. Refresh and try again.'));
      return;
    }

    // Omitted name/ageGroup preserve current values (compat for callers mid-rollout).
    // A present key (including null) is validated; only true key omission preserves.
    const nameProvided = Object.prototype.hasOwnProperty.call(payload, 'name');
    const ageProvided = Object.prototype.hasOwnProperty.call(payload, 'ageGroup');
    let nextName = existing.rows[0].name;
    let nextAgeGroup = existing.rows[0].ageGroup;
    if (nameProvided) {
      nextName = toTitleCase(payload.name);
      if (!nextName || nextName.length < 2) {
        sendJson(res, 400, appError(400, 'validation_error', 'Please review the form fields and try again.'));
        return;
      }
    }
    if (ageProvided) {
      nextAgeGroup = normalizeLookup(payload.ageGroup);
      if (!nextAgeGroup) {
        sendJson(res, 400, appError(400, 'validation_error', 'Please review the form fields and try again.'));
        return;
      }
    }
    if (String(nextName).toLowerCase() !== String(existing.rows[0].name).toLowerCase()) {
      const duplicate = await pool.query(
        `SELECT id FROM teams WHERE LOWER(name) = LOWER($1) AND id <> $2 LIMIT 1`,
        [nextName, teamId]
      );
      if (duplicate.rows[0]) {
        sendJson(res, 409, appError(409, 'conflict', 'A team with this name already exists.'));
        return;
      }
    }

    // Club-scoped editors: team must stay within the actor's clubs.
    if (effectiveRole === 'Coach' || effectiveRole === 'ClubAdmin') {
      const scopeResult = await pool.query(
        `SELECT club_id FROM coach_clubs WHERE user_id = $1`,
        [actorUser.id]
      );
      const allowedClubIds = scopeResult.rows.map((row) => row.club_id);
      if (!allowedClubIds.includes(existing.rows[0].clubId) || !allowedClubIds.includes(newClubId)) {
        sendJson(res, 403, appError(403, 'forbidden_scope', 'You can only update teams in clubs you belong to.'));
        return;
      }
    }

    const club = await pool.query(`SELECT id FROM clubs WHERE id = $1 LIMIT 1`, [newClubId]);
    if (!club.rows[0]) {
      sendJson(res, 400, appError(400, 'validation_error', 'Please review the form fields and try again.'));
      return;
    }

    const coach = await pool.query(
      `SELECT id, name, email FROM users WHERE LOWER(email) = LOWER($1) AND role = 'Coach' AND status = 'active' LIMIT 1`,
      [newCoachEmail]
    );
    if (!coach.rows[0]) {
      sendJson(res, 400, appError(400, 'validation_error', 'Please review the form fields and try again.'));
      return;
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(
        `UPDATE teams
            SET name = $1,
                age_group = $2,
                lead_coach_user_id = $3,
                club_id = $4,
                status = $5,
                sport_id = $6,
                updated_at = NOW()
          WHERE id = $7`,
        [nextName, nextAgeGroup, coach.rows[0].id, newClubId, newStatus, newSportId, teamId]
      );
      await client.query(
        `INSERT INTO coach_clubs (user_id, club_id)
         SELECT $1, $2
         ON CONFLICT (user_id, club_id) DO NOTHING`,
        [coach.rows[0].id, newClubId]
      );
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      if (err && err.code === '23505') {
        sendJson(res, 409, appError(409, 'conflict', 'A team with this name already exists.'));
        return;
      }
      throw err;
    } finally {
      client.release();
    }

    const refreshed = await pool.query(
      `
      SELECT
        t.id,
        t.name,
        t.age_group AS "ageGroup",
        t.lead_coach_user_id AS "leadCoachUserId",
        u.name AS "leadCoach",
        u.email AS "leadCoachEmail",
        c.id AS "clubId",
        c.name AS "clubName",
        s.id AS "sportId",
        s.name AS "sportName",
        t.status,
        COUNT(a.player_id) AS "playerCount"
      FROM teams t
      LEFT JOIN users u ON u.id = t.lead_coach_user_id
      LEFT JOIN clubs c ON c.id = t.club_id
      LEFT JOIN sports s ON s.id = t.sport_id
      LEFT JOIN player_team_assignments a ON a.team_id = t.id
      WHERE t.id = $1
      GROUP BY t.id, t.name, t.age_group, t.lead_coach_user_id, u.name, u.email, c.id, c.name, s.id, s.name, t.status
      LIMIT 1
      `,
      [teamId]
    );

    sendJson(res, 200, { data: toTeamPayload(refreshed.rows[0]) });
    return;
  }

  if (req.method === 'GET' && requestUrl.pathname === `${apiPrefix}/users`) {
    const requestedEmail = (requestUrl.searchParams.get('email') || '').trim().toLowerCase();
    const actorEmail = (requestUrl.searchParams.get('actorEmail') || '').trim().toLowerCase();
    const actor = actorEmail ? await resolveActorUserByEmail(actorEmail) : null;

    let whereSql = '';
    const params = [];
    if (requestedEmail) {
      params.push(requestedEmail);
      whereSql = `WHERE LOWER(email) = LOWER($${params.length})`;
    }
    if (actor && actor.role === 'ClubAdmin' && actor.status === 'active') {
      params.push(actor.id);
      const clubFilter = `
        id IN (
          SELECT b.user_id FROM coach_clubs a
          INNER JOIN coach_clubs b ON b.club_id = a.club_id
          WHERE a.user_id = $${params.length}
        )
      `;
      whereSql = whereSql ? `${whereSql} AND ${clubFilter}` : `WHERE ${clubFilter}`;
    }

    const userRows = await pool.query(`
      SELECT
        id,
        name,
        email,
        role,
        status,
        password_hash AS "passwordHash",
        last_login_label AS "lastLogin",
        COALESCE(
          (SELECT array_agg(club_id ORDER BY club_id) FROM coach_clubs WHERE user_id = users.id),
          ARRAY[]::text[]
        ) AS "clubIds"
      FROM users
      ${whereSql}
      ORDER BY name ASC
    `, params);

    sendJson(res, 200, { data: userRows.rows.map(toUserPayload) });
    return;
  }

  if (req.method === 'POST' && requestUrl.pathname === `${apiPrefix}/users`) {
    const payload = await readJsonBody(req);
    const { actor, isSystemAdmin } = await resolveUserAdminActor(payload);
    if (!actor) {
      sendJson(res, 403, appError(403, 'forbidden', 'You do not have permission to perform this action.'));
      return;
    }

    const email = String(payload.email || '').trim().toLowerCase();
    const name = normalizeLookup(payload.name);
    const role = String(payload.role || '').trim();
    const password = String(payload.password || '').trim();
    const hasNumber = /\d/.test(password);
    const allowedRoles = isSystemAdmin ? ALL_ROLES : ['Coach'];

    if (!name || !email.includes('@') || !allowedRoles.includes(role) || password.length < 10 || !hasNumber) {
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

    if (!isSystemAdmin && role === 'Coach') {
      let clubId = String(payload.clubId || '').trim();
      if (!clubId) {
        const clubs = await listActorClubIds(actor.id);
        clubId = clubs[0] || '';
      }
      if (clubId) {
        const membership = await pool.query(
          `SELECT 1 FROM coach_clubs WHERE user_id = $1 AND club_id = $2 LIMIT 1`,
          [actor.id, clubId]
        );
        if (membership.rows[0]) {
          await pool.query(
            `INSERT INTO coach_clubs (user_id, club_id) VALUES ($1, $2) ON CONFLICT (user_id, club_id) DO NOTHING`,
            [userId, clubId]
          );
        }
      }
    }

    const created = await pool.query(`SELECT id, name, email, role, status, password_hash AS "passwordHash", last_login_label AS "lastLogin" FROM users WHERE id = $1 LIMIT 1`, [userId]);
    sendJson(res, 201, { data: toUserPayload(created.rows[0]) });
    return;
  }

  if (req.method === 'POST' && requestUrl.pathname.match(/^\/api\/v1\/users\/([^/]+)\/role$/)) {
    const match = requestUrl.pathname.match(/^\/api\/v1\/users\/([^/]+)\/role$/);
    const email = decodeURIComponent(match[1]);
    const payload = await readJsonBody(req);
    const { actor, isSystemAdmin } = await resolveUserAdminActor(payload);
    if (!actor) {
      sendJson(res, 403, appError(403, 'forbidden', 'You do not have permission to perform this action.'));
      return;
    }

    const role = String(payload.role || '').trim();
    const allowedRoles = isSystemAdmin ? ALL_ROLES : ['Coach'];
    if (!allowedRoles.includes(role)) {
      sendJson(res, 400, appError(400, 'validation_error', 'Please review the form fields and try again.'));
      return;
    }

    const target = await pool.query(
      `SELECT id, name, email, role, status FROM users WHERE LOWER(email) = LOWER($1) LIMIT 1`,
      [email]
    );
    if (!target.rows[0]) {
      sendJson(res, 404, appError(404, 'not_found', 'The selected user was not found anymore. Refresh and try again.'));
      return;
    }
    if (!isSystemAdmin && !(await clubAdminMayManageUser(actor, target.rows[0]))) {
      sendJson(res, 403, appError(403, 'forbidden', 'You do not have permission to perform this action.'));
      return;
    }

    const updated = await pool.query(`UPDATE users SET role = $1, updated_at = NOW() WHERE LOWER(email) = LOWER($2) RETURNING id, name, email, role, status, password_hash AS "passwordHash", last_login_label AS "lastLogin"`, [role, email]);
    sendJson(res, 200, { data: toUserPayload(updated.rows[0]) });
    return;
  }

  if (req.method === 'POST' && requestUrl.pathname.match(/^\/api\/v1\/users\/([^/]+)\/password$/)) {
    const match = requestUrl.pathname.match(/^\/api\/v1\/users\/([^/]+)\/password$/);
    const email = decodeURIComponent(match[1]);
    const payload = await readJsonBody(req);
    const { actor, isSystemAdmin } = await resolveUserAdminActor(payload);
    if (!actor) {
      sendJson(res, 403, appError(403, 'forbidden', 'You do not have permission to perform this action.'));
      return;
    }

    if (!isSystemAdmin) {
      const target = await pool.query(
        `SELECT id, role, status FROM users WHERE LOWER(email) = LOWER($1) LIMIT 1`,
        [email]
      );
      if (!target.rows[0] || !(await clubAdminMayManageUser(actor, target.rows[0]))) {
        sendJson(res, 403, appError(403, 'forbidden', 'You do not have permission to perform this action.'));
        return;
      }
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
    const { actor, isSystemAdmin } = await resolveUserAdminActor(payload);
    if (!actor) {
      sendJson(res, 403, appError(403, 'forbidden', 'You do not have permission to perform this action.'));
      return;
    }
    const target = await pool.query(
      `SELECT id, role, status FROM users WHERE LOWER(email) = LOWER($1) LIMIT 1`,
      [email]
    );
    if (!target.rows[0]) {
      sendJson(res, 404, appError(404, 'not_found', 'The selected user was not found anymore. Refresh and try again.'));
      return;
    }
    if (!isSystemAdmin && !(await clubAdminMayManageUser(actor, target.rows[0]))) {
      sendJson(res, 403, appError(403, 'forbidden', 'You do not have permission to perform this action.'));
      return;
    }

    const updated = await pool.query(`UPDATE users SET status = 'inactive', updated_at = NOW() WHERE LOWER(email) = LOWER($1) RETURNING id, name, email, role, status, password_hash AS "passwordHash", last_login_label AS "lastLogin"`, [email]);
    sendJson(res, 200, { data: toUserPayload(updated.rows[0]) });
    return;
  }

  if (req.method === 'POST' && requestUrl.pathname.match(/^\/api\/v1\/users\/([^/]+)\/reactivate$/)) {
    const match = requestUrl.pathname.match(/^\/api\/v1\/users\/([^/]+)\/reactivate$/);
    const email = decodeURIComponent(match[1]);
    const payload = await readJsonBody(req);
    const { actor, isSystemAdmin } = await resolveUserAdminActor(payload);
    if (!actor) {
      sendJson(res, 403, appError(403, 'forbidden', 'You do not have permission to perform this action.'));
      return;
    }
    const target = await pool.query(
      `SELECT id, role, status FROM users WHERE LOWER(email) = LOWER($1) LIMIT 1`,
      [email]
    );
    if (!target.rows[0]) {
      sendJson(res, 404, appError(404, 'not_found', 'The selected user was not found anymore. Refresh and try again.'));
      return;
    }
    if (!isSystemAdmin && !(await clubAdminMayManageUser(actor, target.rows[0]))) {
      sendJson(res, 403, appError(403, 'forbidden', 'You do not have permission to perform this action.'));
      return;
    }

    const updated = await pool.query(`UPDATE users SET status = 'active', updated_at = NOW() WHERE LOWER(email) = LOWER($1) RETURNING id, name, email, role, status, password_hash AS "passwordHash", last_login_label AS "lastLogin"`, [email]);
    sendJson(res, 200, { data: toUserPayload(updated.rows[0]) });
    return;
  }

  if (req.method === 'POST' && requestUrl.pathname === `${apiPrefix}/auth/login`) {
    const payload = await readJsonBody(req);
    const email = String(payload.email || '').trim().toLowerCase();
    const password = String(payload.password || '').trim();
    const row = await pool.query(`SELECT id, name, email, role, status, password_hash AS "passwordHash", last_login_label AS "lastLogin" FROM users WHERE LOWER(email) = LOWER($1) LIMIT 1`, [email]);

    if (!row.rows[0] || row.rows[0].status !== 'active' || row.rows[0].passwordHash !== password) {
      logStructured('auth.login.failure', row.rows[0] ? row.rows[0].id : null, {
        email: email || null,
        reason: 'invalid_credentials_or_inactive'
      });
      sendJson(res, 403, appError(403, 'forbidden', 'You do not have permission to perform this action.'));
      return;
    }

    await pool.query(`UPDATE users SET last_login_label = $1, updated_at = NOW() WHERE id = $2`, ['Just now', row.rows[0].id]);
    const user = toUserPayload({ ...row.rows[0], lastLogin: 'Just now' });
    logStructured('auth.login.success', user.id, { email: user.email, role: user.role });
    sendJson(res, 200, { token: 'jwt-' + user.role.toLowerCase(), role: user.role, user });
    return;
  }

  if (req.method === 'GET' && requestUrl.pathname === `${apiPrefix}/clips`) {
    const teamName = normalizeLookup(requestUrl.searchParams.get('teamName') || 'all');
    const status = normalizeLookup(requestUrl.searchParams.get('status') || 'all');
    const playerId = String(requestUrl.searchParams.get('playerId') || '').trim();
    const playerName = normalizeLookup(requestUrl.searchParams.get('playerName') || '');
    const where = [];
    const values = [];
    if (teamName !== 'all') {
      values.push(teamName);
      where.push(`LOWER(t.name) = LOWER($${values.length})`);
    }
    if (status !== 'all') {
      values.push(status);
      where.push(`LOWER(c.status) = LOWER($${values.length})`);
    }
    if (playerId) {
      values.push(playerId);
      where.push(`c.player_id = $${values.length}`);
    } else if (playerName) {
      values.push(playerName);
      where.push(`LOWER(p.name) = LOWER($${values.length})`);
    }
    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const query = `
      SELECT
        c.id,
        c.player_id AS "playerId",
        c.situation,
        c.status,
        c.score,
        c.summary,
        c.comments,
        c.submitted_at_label AS "submittedAt",
        c.skill,
        c.skill_focus AS "skillFocus",
        c.skill_ratings AS "skillRatings",
        c.error_message AS "errorMessage",
        c.video_storage_path AS "videoStoragePath",
        c.video_storage_path AS "path",
        p.name AS "playerName",
        t.name AS "teamName"
      FROM clips c
      JOIN players p ON p.id = c.player_id
      LEFT JOIN player_team_assignments a ON a.player_id = p.id
      LEFT JOIN teams t ON t.id = a.team_id
      ${whereSql}
      ORDER BY c.created_at DESC
    `;
    const clipRows = await pool.query(query, values);
    const segmentsByClip = await listSegmentsForClips(
      pool,
      clipRows.rows.map((row) => row.id)
    );
    sendJson(res, 200, {
      data: clipRows.rows.map((row) => toClipResponse(row, segmentsByClip.get(row.id) || []))
    });
    return;
  }

  const clipMediaMatch = requestUrl.pathname.match(new RegExp(`^${apiPrefix}/clips/([^/]+)/media$`));
  if (req.method === 'GET' && clipMediaMatch) {
    const clipId = decodeURIComponent(clipMediaMatch[1] || '');
    const source = String(requestUrl.searchParams.get('source') || 'first').trim().toLowerCase();
    const resolved = await resolveClipMediaPath(pool, clipId, source);
    if (resolved.status !== 200 || !resolved.filePath) {
      sendJson(res, resolved.status || 404, appError(
        resolved.status || 404,
        resolved.code || 'not_found',
        resolved.message || 'No video file is available for this clip.'
      ));
      return;
    }
    streamVideoFile(req, res, resolved.filePath);
    return;
  }

  const clipThumbnailMatch = requestUrl.pathname.match(new RegExp(`^${apiPrefix}/clips/([^/]+)/thumbnail$`));
  if (req.method === 'GET' && clipThumbnailMatch) {
    const clipId = decodeURIComponent(clipThumbnailMatch[1] || '');
    const resolved = await resolveClipThumbnailPath(pool, clipId);
    if (resolved.status !== 200 || !resolved.filePath) {
      sendJson(res, resolved.status || 404, appError(
        resolved.status || 404,
        resolved.code || 'not_found',
        resolved.message || 'No thumbnail is available for this clip.'
      ));
      return;
    }
    streamJpegFile(res, resolved.filePath);
    return;
  }

  if (req.method === 'POST' && requestUrl.pathname === `${apiPrefix}/clips`) {
    const contentType = String(req.headers['content-type'] || '').toLowerCase();
    if (contentType.includes('multipart/form-data')) {
      const uploadResult = await createClipUpload(pool, req, {
        normalizeLookup,
        appError
      });
      sendJson(res, uploadResult.status, uploadResult.body);
      return;
    }

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
      INSERT INTO clips (id, player_id, situation, status, score, summary, submitted_at_label, skill, skill_focus)
      VALUES ($1, $2, $3, 'submitted', NULL, '', 'Submitted just now', $4, $5::jsonb)
    `, [clipId, player.rows[0].id, situation, skill, JSON.stringify([skill])]);

    const created = await pool.query(`
      SELECT
        c.id,
        c.player_id AS "playerId",
        c.situation,
        c.status,
        c.score,
        c.summary,
        c.comments,
        c.submitted_at_label AS "submittedAt",
        c.skill,
        c.skill_focus AS "skillFocus",
        c.skill_ratings AS "skillRatings",
        c.error_message AS "errorMessage",
        c.video_storage_path AS "videoStoragePath",
        c.video_storage_path AS "path",
        p.name AS "playerName",
        t.name AS "teamName"
      FROM clips c
      JOIN players p ON p.id = c.player_id
      LEFT JOIN player_team_assignments a ON a.player_id = p.id
      LEFT JOIN teams t ON t.id = a.team_id
      WHERE c.id = $1
      LIMIT 1
    `, [clipId]);

    sendJson(res, 202, { data: toClipResponse(created.rows[0], []) });
    return;
  }

  if (req.method === 'GET' && requestUrl.pathname === `${apiPrefix}/players`) {
    const teamName = requestUrl.searchParams.get('teamName') || 'all';
    const query = normalizeComparable(requestUrl.searchParams.get('query') || '');
    const actorEmail = requestUrl.searchParams.get('actorEmail') || '';
    // onlyMine further narrows Coach results to teams they lead; club scoping
    // always applies for active Coaches. SystemAdmin bypasses both.
    const onlyMine = String(requestUrl.searchParams.get('onlyMine') || '').toLowerCase() === 'true';
    const actor = await resolveActorForPlayersList(actorEmail);
    const rows = await listPlayers(teamName, query, actor, { onlyMine });
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

      const requestedPosition = String(payload.position || '').trim();
      const positionRows = await client.query(
        `SELECT p.name AS "name" FROM positions p WHERE p.sport_id = $1 AND p.status = 'active' AND p.name = $2 LIMIT 1`,
        [team.sport_id, requestedPosition]
      );
      const persistedPosition = (positionRows.rows[0] && positionRows.rows[0].name) ? requestedPosition : 'Position not set';

      const birth = parseBirthFields(payload);
      if (birth.error) {
        await client.query('ROLLBACK');
        sendJson(res, 400, appError(400, 'validation_error', birth.error));
        return;
      }

      const playerId = `p_${Date.now()}_${Math.floor(Math.random() * 10000)}`;
      await client.query(
        `
          INSERT INTO players (id, name, normalized_name, position, trend, birth_month, birth_year)
          VALUES ($1, $2, $3, $4, 'plateau', $5, $6)
        `,
        [playerId, normalizedName, comparable, persistedPosition, birth.birthMonth, birth.birthYear]
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

  const profileMatch = requestUrl.pathname.match(/^\/api\/v1\/players\/([^/]+)\/profile$/);
  if (req.method === 'GET' && profileMatch) {
    const actor = await resolveCoachActor(requestUrl.searchParams.get('actorEmail'));
    if (!actor) {
      sendJson(res, 403, appError(403, 'forbidden', 'You do not have permission to perform this action.'));
      return;
    }

    const row = await findPlayerProfileForEditor(profileMatch[1], actor);
    if (!row) {
      sendJson(res, 404, appError(404, 'not_found', 'The selected player was not found anymore. Refresh and try again.'));
      return;
    }

    const skillRatings = await listSkillsForPlayer(row.id);
    const payload = toDashboardPayload(row, skillRatings);
    sendJson(res, 200, { data: { player: payload.player, stats: payload.stats, skillRatings: payload.skillRatings } });
    return;
  }

  const skillRatingsMatch = requestUrl.pathname.match(/^\/api\/v1\/players\/([^/]+)\/skill-ratings$/);
  if (req.method === 'GET' && skillRatingsMatch) {
    const playerId = skillRatingsMatch[1];
    const actor = await resolveCoachActor(requestUrl.searchParams.get('actorEmail'));
    if (!actor) {
      sendJson(res, 403, appError(403, 'forbidden', 'You do not have permission to perform this action.'));
      return;
    }

    const existing = await findPlayerProfileForEditor(playerId, actor);
    if (!existing) {
      sendJson(res, 404, appError(404, 'not_found', 'The selected player was not found anymore. Refresh and try again.'));
      return;
    }

    const skillRatings = await listSkillsForPlayer(playerId);
    sendJson(res, 200, { data: { skillRatings } });
    return;
  }

  if (req.method === 'PUT' && skillRatingsMatch) {
    const playerId = skillRatingsMatch[1];
    const actor = await resolveCoachActor(requestUrl.searchParams.get('actorEmail'));
    if (!actor) {
      sendJson(res, 403, appError(403, 'forbidden', 'You do not have permission to perform this action.'));
      return;
    }

    const body = await readJsonBody(req);
    const parsed = parseUpdateSkillRatingsPayload(body);
    if (parsed.error) {
      sendJson(res, 400, appError(400, 'validation_error', parsed.error));
      return;
    }

    const existing = await findPlayerProfileForEditor(playerId, actor);
    if (!existing) {
      sendJson(res, 404, appError(404, 'not_found', 'The selected player was not found anymore. Refresh and try again.'));
      return;
    }

    const allowedSkills = await listSkillsForPlayer(playerId);
    const allowedById = new Map(allowedSkills.map((row) => [row.skillId, row]));

    for (const entry of parsed.ratings) {
      const skillRow = await pool.query(`SELECT id, name, status FROM skills WHERE id = $1`, [entry.skillId]);
      if (!skillRow.rows[0]) {
        sendJson(res, 400, appError(400, 'validation_error', `Unknown skillId '${entry.skillId}'.`));
        return;
      }
      const allowed = allowedById.get(entry.skillId);
      if (!allowed) {
        sendJson(res, 400, appError(
          400,
          'validation_error',
          `Skill '${skillRow.rows[0].name}' is not tracked for the player's position '${existing.position}'. Add it to the position in Manage Skills (S8) or change the player's position.`
        ));
        return;
      }
      if (entry.rating !== null && skillRow.rows[0].status !== 'active') {
        sendJson(res, 400, appError(400, 'validation_error', `Cannot set a rating for inactive skill '${skillRow.rows[0].name}'.`));
        return;
      }
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await upsertSkillRatings(client, playerId, parsed.ratings, {
        actorUserId: actor.id,
        actorKind: 'user',
        source: 'coach_ui'
      });
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }

    const skillRatings = await listSkillsForPlayer(playerId);
    sendJson(res, 200, { data: { skillRatings } });
    return;
  }

  const auditsMatch = requestUrl.pathname.match(/^\/api\/v1\/players\/([^/]+)\/audits$/);
  if (req.method === 'GET' && auditsMatch) {
    const playerId = auditsMatch[1];
    const viewer = await resolvePlayerHistoryViewer(requestUrl.searchParams.get('actorEmail'), playerId);
    if (!viewer) {
      sendJson(res, 403, appError(403, 'forbidden', 'You do not have permission to perform this action.'));
      return;
    }

    const limitRaw = Number(requestUrl.searchParams.get('limit') || 100);
    const limit = Number.isFinite(limitRaw) ? Math.min(200, Math.max(1, Math.floor(limitRaw))) : 100;
    const result = await pool.query(
      `
        SELECT
          a.id,
          a.player_id AS "playerId",
          a.entity,
          a.field_key AS "fieldKey",
          a.skill_id AS "skillId",
          s.name AS "skillName",
          a.old_value AS "oldValue",
          a.new_value AS "newValue",
          a.actor_user_id AS "actorUserId",
          u.name AS "actorName",
          u.email AS "actorEmail",
          a.actor_kind AS "actorKind",
          a.source,
          a.clip_id AS "clipId",
          a.created_at AS "createdAt"
        FROM player_data_audits a
        LEFT JOIN users u ON u.id = a.actor_user_id
        LEFT JOIN skills s ON s.id = a.skill_id
        WHERE a.player_id = $1
        ORDER BY a.created_at DESC
        LIMIT $2
      `,
      [playerId, limit]
    );
    sendJson(res, 200, { data: { audits: result.rows } });
    return;
  }

  const updateMatch = requestUrl.pathname.match(/^\/api\/v1\/players\/([^/]+)$/);
  if (req.method === 'PATCH' && updateMatch) {
    const playerId = updateMatch[1];
    const actor = await resolveCoachActor(requestUrl.searchParams.get('actorEmail'));
    if (!actor) {
      sendJson(res, 403, appError(403, 'forbidden', 'You do not have permission to perform this action.'));
      return;
    }

    const body = await readJsonBody(req);
    const parsed = parseUpdateProfilePayload(body);
    if (parsed.error) {
      sendJson(res, 400, appError(400, 'validation_error', parsed.error));
      return;
    }

    const existing = await findPlayerProfileForEditor(playerId, actor);
    if (!existing) {
      sendJson(res, 404, appError(404, 'not_found', 'The selected player was not found anymore. Refresh and try again.'));
      return;
    }

    const team = await findTeamByName(parsed.identity.teamName);
    if (!team) {
      sendJson(res, 400, appError(400, 'validation_error', 'Please review the form fields and try again.'));
      return;
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const conflict = await client.query(
        `SELECT id FROM players WHERE normalized_name = $1 AND id <> $2 LIMIT 1`,
        [parsed.identity.normalizedName, playerId]
      );
      if (conflict.rows[0]) {
        await client.query('ROLLBACK');
        sendJson(res, 409, appError(409, 'conflict', 'Another player already uses that name.'));
        return;
      }

      const assignment = await client.query(
        `SELECT team_id AS "teamId" FROM player_team_assignments WHERE player_id = $1`,
        [playerId]
      );
      const previousTeamId = assignment.rows[0] ? assignment.rows[0].teamId : null;

      const profileFields = [
        { key: 'name', oldValue: existing.name, newValue: parsed.identity.name },
        { key: 'position', oldValue: existing.position, newValue: parsed.identity.position },
        { key: 'trend', oldValue: existing.trend, newValue: parsed.identity.trend },
        { key: 'avatarUrl', oldValue: existing.avatarUrl, newValue: parsed.identity.avatarUrl },
        { key: 'birthMonth', oldValue: existing.birthMonth, newValue: parsed.identity.birthMonth },
        { key: 'birthYear', oldValue: existing.birthYear, newValue: parsed.identity.birthYear }
      ];
      for (const field of profileFields) {
        await insertPlayerDataAudit(client, {
          playerId,
          entity: 'profile',
          fieldKey: field.key,
          oldValue: field.oldValue,
          newValue: field.newValue,
          actorUserId: actor.id,
          actorKind: 'user',
          source: 'coach_ui'
        });
      }

      await insertPlayerDataAudit(client, {
        playerId,
        entity: 'team_assignment',
        fieldKey: 'teamId',
        oldValue: previousTeamId,
        newValue: team.id,
        actorUserId: actor.id,
        actorKind: 'user',
        source: 'coach_ui'
      });

      await client.query(
        `
          UPDATE players
          SET name = $1, normalized_name = $2, position = $3, trend = $4, player_avatar_url = $5,
              birth_month = $6, birth_year = $7, updated_at = NOW()
          WHERE id = $8
        `,
        [
          parsed.identity.name,
          parsed.identity.normalizedName,
          parsed.identity.position,
          parsed.identity.trend,
          parsed.identity.avatarUrl,
          parsed.identity.birthMonth,
          parsed.identity.birthYear,
          playerId
        ]
      );

      await client.query(
        `UPDATE player_team_assignments SET team_id = $1, updated_at = NOW() WHERE player_id = $2`,
        [team.id, playerId]
      );

      await upsertPlayerStats(client, playerId, parsed.stats);

      // Replace-on-position-change: when the coach changes the player's
      // position, wipe old ratings and seed NULL rows for the new position's
      // skills. Same transaction as the identity/stats update.
      const previousPosition = String(existing.position || '').trim();
      const nextPosition = String(parsed.identity.position || '').trim();
      if (previousPosition !== nextPosition) {
        const beforeRatings = await client.query(
          `SELECT skill_id AS "skillId", rating FROM player_skill_ratings WHERE player_id = $1`,
          [playerId]
        );
        const beforeMap = new Map(
          beforeRatings.rows.map((row) => [
            row.skillId,
            row.rating === null || row.rating === undefined ? null : Number(row.rating)
          ])
        );
        const newPositionId = await resolvePositionIdForPlayer(client, playerId, nextPosition);
        await replaceSkillRatingsForPosition(client, playerId, newPositionId);
        const afterRatings = await client.query(
          `SELECT skill_id AS "skillId", rating FROM player_skill_ratings WHERE player_id = $1`,
          [playerId]
        );
        const afterMap = new Map(
          afterRatings.rows.map((row) => [
            row.skillId,
            row.rating === null || row.rating === undefined ? null : Number(row.rating)
          ])
        );
        const skillIds = new Set([...beforeMap.keys(), ...afterMap.keys()]);
        for (const skillId of skillIds) {
          const oldValue = beforeMap.has(skillId) ? beforeMap.get(skillId) : null;
          const newValue = afterMap.has(skillId) ? afterMap.get(skillId) : null;
          // Rows removed by position replace: treat as clearing to null when gone.
          const effectiveNew = afterMap.has(skillId) ? newValue : null;
          const effectiveOld = beforeMap.has(skillId) ? oldValue : null;
          await insertPlayerDataAudit(client, {
            playerId,
            entity: 'skill_rating',
            fieldKey: 'rating',
            skillId,
            oldValue: effectiveOld,
            newValue: effectiveNew,
            actorUserId: actor.id,
            actorKind: 'user',
            source: 'coach_ui'
          });
        }
      }

      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }

    const row = await findPlayerProfileForEditor(playerId, actor);
    const skillRatings = await listSkillsForPlayer(playerId);
    const payload = toDashboardPayload(row, skillRatings);
    sendJson(res, 200, { data: { player: payload.player, stats: payload.stats, skillRatings: payload.skillRatings } });
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

  // ---------------------------------------------------------------------------
  // Skills admin (sports / positions / skills / position_skills).
  // SystemAdmin-only writes; reads require an active actor but accept any role.
  // ---------------------------------------------------------------------------

  if (req.method === 'GET' && requestUrl.pathname === `${apiPrefix}/sports`) {
    const statusFilter = String(requestUrl.searchParams.get('status') || 'active').trim().toLowerCase();
    const rows = await listSportsWithCounts(statusFilter);
    sendJson(res, 200, { data: rows });
    return;
  }

  if (req.method === 'POST' && requestUrl.pathname === `${apiPrefix}/sports`) {
    const payload = await readJsonBody(req);
    const actor = await resolveSystemAdminActor(payload.actorEmail);
    if (!assertSystemAdminActor(actor)) {
      sendJson(res, 403, appError(403, 'forbidden', 'You do not have permission to perform this action.'));
      return;
    }
    const nameError = validateName(payload.name, 2, 40, 'Sport');
    if (nameError) {
      sendJson(res, 400, appError(400, 'validation_error', nameError));
      return;
    }
    const trimmedName = String(payload.name).trim();
    const existing = await findSportByName(trimmedName);
    if (existing) {
      sendJson(res, 409, appError(409, 'conflict', 'A sport with this name already exists.'));
      return;
    }
    const sportId = `sport_${Date.now()}_${Math.floor(Math.random() * 10000)}`;
    const insertResult = await pool.query(
      `INSERT INTO sports (id, name, status) VALUES ($1, $2, 'active') RETURNING id, name, status`,
      [sportId, trimmedName]
    );
    const row = (await listSportsWithCounts('all')).find((r) => r.id === insertResult.rows[0].id) || toSportPayload({ ...insertResult.rows[0], positionCount: 0 });
    sendJson(res, 201, { data: row });
    return;
  }

  if (req.method === 'PATCH' && /^\/api\/v1\/sports\/[^/]+$/.test(requestUrl.pathname)) {
    const sportId = decodeURIComponent(requestUrl.pathname.split('/').pop());
    const payload = await readJsonBody(req);
    const actor = await resolveSystemAdminActor(payload.actorEmail);
    if (!assertSystemAdminActor(actor)) {
      sendJson(res, 403, appError(403, 'forbidden', 'You do not have permission to perform this action.'));
      return;
    }
    const nameError = validateName(payload.name, 2, 40, 'Sport');
    if (nameError) {
      sendJson(res, 400, appError(400, 'validation_error', nameError));
      return;
    }
    const trimmedName = String(payload.name).trim();
    const existing = await pool.query(`SELECT id FROM sports WHERE id = $1`, [sportId]);
    if (!existing.rows[0]) {
      sendJson(res, 404, appError(404, 'not_found', 'Sport not found.'));
      return;
    }
    const collision = await findSportByName(trimmedName);
    if (collision && collision.id !== sportId) {
      sendJson(res, 409, appError(409, 'conflict', 'A sport with this name already exists.'));
      return;
    }
    await pool.query(`UPDATE sports SET name = $1, updated_at = NOW() WHERE id = $2`, [trimmedName, sportId]);
    const row = (await listSportsWithCounts('all')).find((r) => r.id === sportId);
    sendJson(res, 200, { data: row });
    return;
  }

  if (req.method === 'PATCH' && /^\/api\/v1\/sports\/[^/]+\/status$/.test(requestUrl.pathname)) {
    const sportId = decodeURIComponent(requestUrl.pathname.split('/')[4]);
    const payload = await readJsonBody(req);
    const actor = await resolveSystemAdminActor(payload.actorEmail);
    if (!assertSystemAdminActor(actor)) {
      sendJson(res, 403, appError(403, 'forbidden', 'You do not have permission to perform this action.'));
      return;
    }
    const status = String(payload.status || '').trim().toLowerCase();
    if (status !== 'active' && status !== 'inactive') {
      sendJson(res, 400, appError(400, 'validation_error', 'Status must be "active" or "inactive".'));
      return;
    }
    const existing = await pool.query(`SELECT id FROM sports WHERE id = $1`, [sportId]);
    if (!existing.rows[0]) {
      sendJson(res, 404, appError(404, 'not_found', 'Sport not found.'));
      return;
    }
    await pool.query(`UPDATE sports SET status = $1, updated_at = NOW() WHERE id = $2`, [status, sportId]);
    const row = (await listSportsWithCounts('all')).find((r) => r.id === sportId);
    sendJson(res, 200, { data: row });
    return;
  }

  if (req.method === 'GET' && requestUrl.pathname === `${apiPrefix}/positions`) {
    const sportId = String(requestUrl.searchParams.get('sportId') || 'sport_soccer').trim();
    const statusFilter = String(requestUrl.searchParams.get('status') || 'active').trim().toLowerCase();
    const rows = await listPositionsWithCounts(sportId, statusFilter);
    sendJson(res, 200, { data: rows });
    return;
  }

  if (req.method === 'POST' && requestUrl.pathname === `${apiPrefix}/positions`) {
    const payload = await readJsonBody(req);
    const actor = await resolveSystemAdminActor(payload.actorEmail);
    if (!assertSystemAdminActor(actor)) {
      sendJson(res, 403, appError(403, 'forbidden', 'You do not have permission to perform this action.'));
      return;
    }
    const nameError = validateName(payload.name, 2, 80, 'Position');
    if (nameError) {
      sendJson(res, 400, appError(400, 'validation_error', nameError));
      return;
    }
    const sportId = String(payload.sportId || '').trim();
    if (!sportId) {
      sendJson(res, 400, appError(400, 'validation_error', 'Position requires a sportId.'));
      return;
    }
    const sportRow = await pool.query(`SELECT id, status FROM sports WHERE id = $1`, [sportId]);
    if (!sportRow.rows[0]) {
      sendJson(res, 404, appError(404, 'not_found', 'Sport not found.'));
      return;
    }
    if (sportRow.rows[0].status !== 'active') {
      sendJson(res, 400, appError(400, 'validation_error', 'Cannot add a position under an inactive sport.'));
      return;
    }
    const trimmedName = String(payload.name).trim();
    const collision = await findPositionByName(sportId, trimmedName);
    if (collision) {
      sendJson(res, 409, appError(409, 'conflict', 'A position with this name already exists under that sport.'));
      return;
    }
    const positionId = `pos_${Date.now()}_${Math.floor(Math.random() * 10000)}`;
    await pool.query(
      `INSERT INTO positions (id, name, sport_id, status) VALUES ($1, $2, $3, 'active')`,
      [positionId, trimmedName, sportId]
    );
    const row = (await listPositionsWithCounts(sportId, 'all')).find((r) => r.id === positionId);
    sendJson(res, 201, { data: row });
    return;
  }

  if (req.method === 'PATCH' && /^\/api\/v1\/positions\/[^/]+$/.test(requestUrl.pathname)) {
    const positionId = decodeURIComponent(requestUrl.pathname.split('/').pop());
    const payload = await readJsonBody(req);
    const actor = await resolveSystemAdminActor(payload.actorEmail);
    if (!assertSystemAdminActor(actor)) {
      sendJson(res, 403, appError(403, 'forbidden', 'You do not have permission to perform this action.'));
      return;
    }
    const existing = await pool.query(`SELECT id, name, sport_id AS "sportId" FROM positions WHERE id = $1`, [positionId]);
    if (!existing.rows[0]) {
      sendJson(res, 404, appError(404, 'not_found', 'Position not found.'));
      return;
    }
    const nextName = payload.name !== undefined ? String(payload.name).trim() : existing.rows[0].name;
    const nextSportId = payload.sportId !== undefined ? String(payload.sportId).trim() : existing.rows[0].sportId;
    const nameError = validateName(nextName, 2, 80, 'Position');
    if (nameError) {
      sendJson(res, 400, appError(400, 'validation_error', nameError));
      return;
    }
    if (nextSportId !== existing.rows[0].sportId) {
      const sportRow = await pool.query(`SELECT id FROM sports WHERE id = $1`, [nextSportId]);
      if (!sportRow.rows[0]) {
        sendJson(res, 404, appError(404, 'not_found', 'Target sport not found.'));
        return;
      }
    }
    const collision = await findPositionByName(nextSportId, nextName);
    if (collision && collision.id !== positionId) {
      sendJson(res, 409, appError(409, 'conflict', 'A position with this name already exists under that sport.'));
      return;
    }
    await pool.query(
      `UPDATE positions SET name = $1, sport_id = $2, updated_at = NOW() WHERE id = $3`,
      [nextName, nextSportId, positionId]
    );
    const row = (await listPositionsWithCounts(nextSportId, 'all')).find((r) => r.id === positionId);
    sendJson(res, 200, { data: row });
    return;
  }

  if (req.method === 'PATCH' && /^\/api\/v1\/positions\/[^/]+\/status$/.test(requestUrl.pathname)) {
    const positionId = decodeURIComponent(requestUrl.pathname.split('/')[4]);
    const payload = await readJsonBody(req);
    const actor = await resolveSystemAdminActor(payload.actorEmail);
    if (!assertSystemAdminActor(actor)) {
      sendJson(res, 403, appError(403, 'forbidden', 'You do not have permission to perform this action.'));
      return;
    }
    const status = String(payload.status || '').trim().toLowerCase();
    if (status !== 'active' && status !== 'inactive') {
      sendJson(res, 400, appError(400, 'validation_error', 'Status must be "active" or "inactive".'));
      return;
    }
    const existing = await pool.query(`SELECT id, sport_id AS "sportId" FROM positions WHERE id = $1`, [positionId]);
    if (!existing.rows[0]) {
      sendJson(res, 404, appError(404, 'not_found', 'Position not found.'));
      return;
    }
    await pool.query(`UPDATE positions SET status = $1, updated_at = NOW() WHERE id = $2`, [status, positionId]);
    const row = (await listPositionsWithCounts(existing.rows[0].sportId, 'all')).find((r) => r.id === positionId);
    sendJson(res, 200, { data: row });
    return;
  }

  if (req.method === 'GET' && requestUrl.pathname === `${apiPrefix}/skills`) {
    const statusFilter = String(requestUrl.searchParams.get('status') || 'active').trim().toLowerCase();
    const rows = await listSkillsWithCounts(statusFilter);
    sendJson(res, 200, { data: rows });
    return;
  }

  if (req.method === 'POST' && requestUrl.pathname === `${apiPrefix}/skills`) {
    const payload = await readJsonBody(req);
    const actor = await resolveSystemAdminActor(payload.actorEmail);
    if (!assertSystemAdminActor(actor)) {
      sendJson(res, 403, appError(403, 'forbidden', 'You do not have permission to perform this action.'));
      return;
    }
    const nameError = validateName(payload.name, 2, 60, 'Skill');
    if (nameError) {
      sendJson(res, 400, appError(400, 'validation_error', nameError));
      return;
    }
    const trimmedName = String(payload.name).trim();
    const abbreviation = normalizeSkillAbbreviation(payload.abbreviation, trimmedName);
    const abbrError = validateSkillAbbreviation(abbreviation);
    if (abbrError) {
      sendJson(res, 400, appError(400, 'validation_error', abbrError));
      return;
    }
    const existing = await findSkillByName(trimmedName);
    if (existing) {
      sendJson(res, 409, appError(409, 'conflict', 'A skill with this name already exists.'));
      return;
    }
    const skillId = `s_${Date.now()}_${Math.floor(Math.random() * 10000)}`;
    await pool.query(
      `INSERT INTO skills (id, name, abbreviation, status) VALUES ($1, $2, $3, 'active')`,
      [skillId, trimmedName, abbreviation]
    );
    const row = (await listSkillsWithCounts('all')).find((r) => r.id === skillId);
    sendJson(res, 201, { data: row });
    return;
  }

  if (req.method === 'PATCH' && /^\/api\/v1\/skills\/[^/]+$/.test(requestUrl.pathname)) {
    const skillId = decodeURIComponent(requestUrl.pathname.split('/').pop());
    const payload = await readJsonBody(req);
    const actor = await resolveSystemAdminActor(payload.actorEmail);
    if (!assertSystemAdminActor(actor)) {
      sendJson(res, 403, appError(403, 'forbidden', 'You do not have permission to perform this action.'));
      return;
    }
    const nameError = validateName(payload.name, 2, 60, 'Skill');
    if (nameError) {
      sendJson(res, 400, appError(400, 'validation_error', nameError));
      return;
    }
    const trimmedName = String(payload.name).trim();
    const abbreviation = normalizeSkillAbbreviation(payload.abbreviation, trimmedName);
    const abbrError = validateSkillAbbreviation(abbreviation);
    if (abbrError) {
      sendJson(res, 400, appError(400, 'validation_error', abbrError));
      return;
    }
    const existing = await pool.query(`SELECT id FROM skills WHERE id = $1`, [skillId]);
    if (!existing.rows[0]) {
      sendJson(res, 404, appError(404, 'not_found', 'Skill not found.'));
      return;
    }
    const collision = await findSkillByName(trimmedName);
    if (collision && collision.id !== skillId) {
      sendJson(res, 409, appError(409, 'conflict', 'A skill with this name already exists.'));
      return;
    }
    await pool.query(
      `UPDATE skills SET name = $1, abbreviation = $2, updated_at = NOW() WHERE id = $3`,
      [trimmedName, abbreviation, skillId]
    );
    const row = (await listSkillsWithCounts('all')).find((r) => r.id === skillId);
    sendJson(res, 200, { data: row });
    return;
  }

  if (req.method === 'DELETE' && /^\/api\/v1\/skills\/[^/]+$/.test(requestUrl.pathname)) {
    const skillId = decodeURIComponent(requestUrl.pathname.split('/').pop());
    const payload = await readJsonBody(req);
    const actor = await resolveSystemAdminActor(payload.actorEmail);
    if (!assertSystemAdminActor(actor)) {
      sendJson(res, 403, appError(403, 'forbidden', 'You do not have permission to perform this action.'));
      return;
    }
    const skillRow = await pool.query(`SELECT id, name FROM skills WHERE id = $1`, [skillId]);
    if (!skillRow.rows[0]) {
      sendJson(res, 404, appError(404, 'not_found', 'Skill not found.'));
      return;
    }
    const assignmentCount = await pool.query(
      `SELECT COUNT(*)::int AS n FROM position_skills WHERE skill_id = $1`,
      [skillId]
    );
    if (assignmentCount.rows[0].n > 0) {
      sendJson(res, 409, appError(
        409,
        'conflict',
        `Cannot delete skill '${skillRow.rows[0].name}' because it is assigned to ${assignmentCount.rows[0].n} position(s). Remove the assignments first.`
      ));
      return;
    }
    await pool.query(`DELETE FROM skills WHERE id = $1`, [skillId]);
    sendJson(res, 204, null);
    return;
  }

  // Catalog read — open like GET /positions (Feature 040 Advanced Filter Skill dropdown
  // for Coach needs this; writes below remain SystemAdmin-gated).
  if (req.method === 'GET' && /^\/api\/v1\/positions\/[^/]+\/skills$/.test(requestUrl.pathname)) {
    const positionId = decodeURIComponent(requestUrl.pathname.split('/')[4]);
    const positionRow = await pool.query(`SELECT id FROM positions WHERE id = $1`, [positionId]);
    if (!positionRow.rows[0]) {
      sendJson(res, 404, appError(404, 'not_found', 'Position not found.'));
      return;
    }
    const rows = await listPositionSkills(positionId);
    sendJson(res, 200, { data: rows });
    return;
  }

  if (req.method === 'POST' && /^\/api\/v1\/positions\/[^/]+\/skills$/.test(requestUrl.pathname)) {
    const positionId = decodeURIComponent(requestUrl.pathname.split('/')[4]);
    const payload = await readJsonBody(req);
    const actor = await resolveSystemAdminActor(payload.actorEmail);
    if (!assertSystemAdminActor(actor)) {
      sendJson(res, 403, appError(403, 'forbidden', 'You do not have permission to perform this action.'));
      return;
    }
    const skillId = String(payload.skillId || '').trim();
    if (!skillId) {
      sendJson(res, 400, appError(400, 'validation_error', 'skillId is required.'));
      return;
    }
    const positionRow = await pool.query(`SELECT id FROM positions WHERE id = $1`, [positionId]);
    if (!positionRow.rows[0]) {
      sendJson(res, 404, appError(404, 'not_found', 'Position not found.'));
      return;
    }
    const skillRow = await pool.query(`SELECT id, status FROM skills WHERE id = $1`, [skillId]);
    if (!skillRow.rows[0]) {
      sendJson(res, 404, appError(404, 'not_found', 'Skill not found.'));
      return;
    }
    if (skillRow.rows[0].status !== 'active') {
      sendJson(res, 400, appError(400, 'validation_error', 'Cannot assign an inactive skill.'));
      return;
    }
    const existingAssignment = await pool.query(
      `SELECT 1 FROM position_skills WHERE position_id = $1 AND skill_id = $2`,
      [positionId, skillId]
    );
    if (existingAssignment.rowCount > 0) {
      const rows = await listPositionSkills(positionId);
      sendJson(res, 200, { data: rows });
      return;
    }
    await pool.query(
      `INSERT INTO position_skills (position_id, skill_id) VALUES ($1, $2)`,
      [positionId, skillId]
    );
    const rows = await listPositionSkills(positionId);
    sendJson(res, 201, { data: rows });
    return;
  }

  if (req.method === 'DELETE' && /^\/api\/v1\/positions\/[^/]+\/skills\/[^/]+$/.test(requestUrl.pathname)) {
    const parts = requestUrl.pathname.split('/');
    const positionId = decodeURIComponent(parts[4]);
    const skillId = decodeURIComponent(parts[6]);
    const payload = await readJsonBody(req);
    const actor = await resolveSystemAdminActor(payload.actorEmail);
    if (!assertSystemAdminActor(actor)) {
      sendJson(res, 403, appError(403, 'forbidden', 'You do not have permission to perform this action.'));
      return;
    }
    const result = await pool.query(
      `DELETE FROM position_skills WHERE position_id = $1 AND skill_id = $2`,
      [positionId, skillId]
    );
    if (result.rowCount === 0) {
      sendJson(res, 404, appError(404, 'not_found', 'Assignment not found.'));
      return;
    }
    sendJson(res, 204, null);
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
      console.log(`Structured log file: ${getLogPath()}`);
      logStructured('server.started', null, { host, port });
      if (!databaseUrl) {
        console.log('Database mode disabled: set DATABASE_URL to enable persistent /api/v1 players writes.');
      } else {
        startVideoProcessingQueue(pool);
      }
    });
  })
  .catch((error) => {
    console.error('Failed to initialize database schema:', error);
    process.exit(1);
  });
