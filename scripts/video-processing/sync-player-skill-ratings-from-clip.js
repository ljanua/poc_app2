'use strict';

const { COMPLETE_STATUSES } = require('./reconcile-player-clip-stats');
const { logAuditEvent } = require('./audit-logger');
const { recordSkillAssessment } = require('../player-skill-assessment');

const VIDEO_ASSESSMENT_ACTOR = 'video-assessment';

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

  const resolved = [];
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

    resolved.push({ skillId, rating: percent });
  }

  if (!resolved.length) {
    return { upserted: 0, skipped };
  }

  const client = await pool.connect();
  let upserted = 0;
  try {
    await client.query('BEGIN');
    const result = await recordSkillAssessment(client, {
      playerId,
      ratings: resolved,
      updatedBy: VIDEO_ASSESSMENT_ACTOR
    });
    upserted = result.count;
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }

  if (upserted > 0) {
    logAuditEvent('player.skill_ratings.synced', {
      playerId,
      upserted,
      skipped,
      clipId: clipId || null,
      updatedBy: VIDEO_ASSESSMENT_ACTOR
    });
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
  backfillPlayerSkillRatingsFromClips,
  VIDEO_ASSESSMENT_ACTOR
};
