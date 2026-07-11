'use strict';

const { COMPLETE_STATUSES } = require('./reconcile-player-clip-stats');
const { logAuditEvent } = require('./audit-logger');

function toPercentRating(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) {
    return null;
  }
  return Math.max(0, Math.min(100, Math.round(n * 100)));
}

async function findSkillIdByName(pool, name) {
  const result = await pool.query(
    `SELECT id FROM skills WHERE LOWER(name) = LOWER($1) LIMIT 1`,
    [name]
  );
  return result.rows[0]?.id || null;
}

async function upsertPlayerSkillRating(pool, playerId, skillId, rating) {
  await pool.query(
    `
      INSERT INTO player_skill_ratings (player_id, skill_id, rating, updated_at)
      VALUES ($1, $2, $3, NOW())
      ON CONFLICT (player_id, skill_id) DO UPDATE SET
        rating = EXCLUDED.rating,
        updated_at = NOW()
    `,
    [playerId, skillId, rating]
  );
}

async function syncPlayerSkillRatingsFromClip(pool, { playerId, skillRatings }) {
  if (!pool || !playerId) {
    return { upserted: 0, skipped: 0 };
  }

  const ratings =
    skillRatings && typeof skillRatings === 'object' && !Array.isArray(skillRatings)
      ? skillRatings
      : null;
  if (!ratings) {
    return { upserted: 0, skipped: 0 };
  }

  const keys = Object.keys(ratings);
  if (keys.length === 0) {
    return { upserted: 0, skipped: 0 };
  }

  let upserted = 0;
  let skipped = 0;
  for (const skillName of keys) {
    const percent = toPercentRating(ratings[skillName]);
    if (percent === null) {
      skipped += 1;
      logAuditEvent('player.skill_ratings.sync.skip', {
        playerId,
        skillName,
        reason: 'invalid_rating'
      });
      continue;
    }

    const skillId = await findSkillIdByName(pool, skillName);
    if (!skillId) {
      skipped += 1;
      logAuditEvent('player.skill_ratings.sync.skip', {
        playerId,
        skillName,
        reason: 'unknown_skill'
      });
      continue;
    }

    await upsertPlayerSkillRating(pool, playerId, skillId, percent);
    upserted += 1;
  }

  if (upserted > 0) {
    logAuditEvent('player.skill_ratings.synced', { playerId, upserted, skipped });
  }
  return { upserted, skipped };
}

async function backfillPlayerSkillRatingsFromClips(pool) {
  if (!pool) {
    return { clips: 0, upserted: 0 };
  }

  const result = await pool.query(
    `
      SELECT player_id AS "playerId", skill_ratings AS "skillRatings"
      FROM clips
      WHERE status = ANY($1::text[])
        AND skill_ratings IS NOT NULL
        AND skill_ratings <> '{}'::jsonb
      ORDER BY processing_completed_at ASC NULLS LAST,
               updated_at ASC NULLS LAST,
               created_at ASC
    `,
    [COMPLETE_STATUSES]
  );

  let upserted = 0;
  for (const row of result.rows) {
    const out = await syncPlayerSkillRatingsFromClip(pool, {
      playerId: row.playerId,
      skillRatings: row.skillRatings
    });
    upserted += out.upserted;
  }

  logAuditEvent('player.skill_ratings.backfill', {
    clips: result.rows.length,
    upserted
  });
  return { clips: result.rows.length, upserted };
}

module.exports = {
  toPercentRating,
  syncPlayerSkillRatingsFromClip,
  backfillPlayerSkillRatingsFromClips
};
