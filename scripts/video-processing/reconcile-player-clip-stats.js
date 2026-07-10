'use strict';

const COMPLETE_STATUSES = ['complete', 'assessed'];
const PENDING_STATUSES = ['submitted', 'in_progress', 'pending'];

async function reconcilePlayerClipStats(pool, playerId) {
  if (!pool || !playerId) {
    return null;
  }

  const counts = await pool.query(
    `
      SELECT
        COUNT(*)::int AS submitted,
        COUNT(*) FILTER (WHERE status = ANY($2::text[]))::int AS assessed,
        COUNT(*) FILTER (WHERE status = ANY($3::text[]))::int AS pending
      FROM clips
      WHERE player_id = $1
    `,
    [playerId, COMPLETE_STATUSES, PENDING_STATUSES]
  );
  const row = counts.rows[0] || { submitted: 0, assessed: 0, pending: 0 };

  const updated = await pool.query(
    `
      UPDATE player_stats
      SET clip_submitted_count = $2,
          clip_assessed_count = $3,
          clip_pending_count = $4,
          updated_at = NOW()
      WHERE player_id = $1
      RETURNING clip_submitted_count AS "clipSubmittedCount",
                clip_assessed_count AS "clipAssessedCount",
                clip_pending_count AS "clipPendingCount"
    `,
    [playerId, row.submitted, row.assessed, row.pending]
  );

  if (updated.rows[0]) {
    return updated.rows[0];
  }

  const inserted = await pool.query(
    `
      INSERT INTO player_stats (
        player_id,
        trend,
        clip_submitted_count,
        clip_assessed_count,
        clip_pending_count
      )
      VALUES ($1, 'plateau', $2, $3, $4)
      RETURNING clip_submitted_count AS "clipSubmittedCount",
                clip_assessed_count AS "clipAssessedCount",
                clip_pending_count AS "clipPendingCount"
    `,
    [playerId, row.submitted, row.assessed, row.pending]
  );
  return inserted.rows[0] || null;
}

module.exports = {
  COMPLETE_STATUSES,
  PENDING_STATUSES,
  reconcilePlayerClipStats
};
