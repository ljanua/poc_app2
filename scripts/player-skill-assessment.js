'use strict';

const crypto = require('node:crypto');

/**
 * Upsert live skill ratings and append history rows sharing one assessed_at.
 * ratings: [{ skillId, rating }] with numeric 0–100 only (blanks already filtered).
 * updatedBy: text actor (user email or "video-assessment").
 */
async function recordSkillAssessment(client, { playerId, ratings, updatedBy, assessedAt }) {
  const list = Array.isArray(ratings) ? ratings : [];
  const actor = String(updatedBy || '').trim();
  if (!playerId || !actor) {
    return { assessedAt: null, count: 0 };
  }
  if (!list.length) {
    return { assessedAt: null, count: 0 };
  }

  let assessedAtValue = assessedAt || null;
  if (!assessedAtValue) {
    const ts = await client.query('SELECT NOW() AS assessed_at');
    assessedAtValue = ts.rows[0].assessed_at;
  }

  for (const entry of list) {
    const skillId = String(entry.skillId || '').trim();
    const rating = Number(entry.rating);
    if (!skillId || !Number.isFinite(rating)) {
      continue;
    }
    const clamped = Math.max(0, Math.min(100, Math.round(rating)));

    await client.query(
      `
        INSERT INTO player_skill_ratings (player_id, skill_id, rating, updated_by, updated_at)
        VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT (player_id, skill_id) DO UPDATE SET
          rating = EXCLUDED.rating,
          updated_by = EXCLUDED.updated_by,
          updated_at = EXCLUDED.updated_at
      `,
      [playerId, skillId, clamped, actor, assessedAtValue]
    );

    const histId = 'psrh_' + crypto.randomBytes(8).toString('hex');
    await client.query(
      `
        INSERT INTO player_skill_ratings_history (
          id, player_id, skill_id, rating, updated_by, assessed_at, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $6)
      `,
      [histId, playerId, skillId, clamped, actor, assessedAtValue]
    );
  }

  return { assessedAt: assessedAtValue, count: list.length };
}

module.exports = {
  recordSkillAssessment
};
