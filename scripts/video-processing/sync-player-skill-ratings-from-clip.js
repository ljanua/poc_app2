'use strict';

const crypto = require('node:crypto');
const { COMPLETE_STATUSES } = require('./reconcile-player-clip-stats');
const { logAuditEvent } = require('./audit-logger');

function toPercentRating(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) {
    return null;
  }
  return Math.max(0, Math.min(100, Math.round(n * 100)));
}

function normalizeAuditScalar(value) {
  if (value === null || value === undefined) {
    return null;
  }
  return String(value);
}

async function findSkillIdByName(pool, name) {
  const result = await pool.query(
    `SELECT id FROM skills WHERE LOWER(name) = LOWER($1) LIMIT 1`,
    [name]
  );
  return result.rows[0]?.id || null;
}

async function upsertPlayerSkillRating(pool, playerId, skillId, rating, meta = null) {
  const previous = await pool.query(
    `SELECT rating FROM player_skill_ratings WHERE player_id = $1 AND skill_id = $2`,
    [playerId, skillId]
  );
  const oldRating = previous.rows[0]
    ? (previous.rows[0].rating === null || previous.rows[0].rating === undefined
      ? null
      : Number(previous.rows[0].rating))
    : null;

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

  if (meta && normalizeAuditScalar(oldRating) !== normalizeAuditScalar(rating)) {
    const id = 'pda_' + crypto.randomBytes(8).toString('hex');
    await pool.query(
      `
        INSERT INTO player_data_audits (
          id, player_id, entity, field_key, skill_id, old_value, new_value,
          actor_user_id, actor_kind, source, clip_id
        ) VALUES ($1, $2, 'skill_rating', 'rating', $3, $4, $5, NULL, 'system', $6, $7)
      `,
      [
        id,
        playerId,
        skillId,
        normalizeAuditScalar(oldRating),
        normalizeAuditScalar(rating),
        meta.source || 'clip_sync',
        meta.clipId || null
      ]
    );
  }
}

async function syncPlayerSkillRatingsFromClip(pool, { playerId, skillRatings, clipId }) {
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

    await upsertPlayerSkillRating(pool, playerId, skillId, percent, {
      source: 'clip_sync',
      clipId: clipId || null
    });
    upserted += 1;
  }

  if (upserted > 0) {
    logAuditEvent('player.skill_ratings.synced', { playerId, upserted, skipped, clipId: clipId || null });
  }
  return { upserted, skipped };
}

async function backfillPlayerSkillRatingsFromClips(pool) {
  if (!pool) {
    return { clips: 0, upserted: 0 };
  }

  const result = await pool.query(
    `
      SELECT id AS "clipId", player_id AS "playerId", skill_ratings AS "skillRatings"
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
      skillRatings: row.skillRatings,
      clipId: row.clipId
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
