'use strict';

/**
 * Delete non-seed Soccer positions and their position_skills rows.
 * Usage: node scripts/purge-soccer-position-orphans.js
 */

const path = require('node:path');
const { Pool } = require('pg');
const { SOCCER_SEED_POSITION_IDS, SOCCER_SPORT_ID } = require('../tests/playwright/_soccer-positions.js');

try {
  require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
} catch (err) {
  // dotenv optional when DATABASE_URL is already set
}

async function purgeSoccerPositionOrphans(pool) {
  if (!pool) {
    throw new Error('pool is required');
  }
  if (SOCCER_SEED_POSITION_IDS.length !== 13) {
    throw new Error('SOCCER_SEED_POSITION_IDS must contain exactly 13 ids');
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const orphanSelect = `
      SELECT id FROM positions
      WHERE sport_id = $1
        AND id <> ALL($2::text[])
    `;
    const orphans = await client.query(orphanSelect, [SOCCER_SPORT_ID, SOCCER_SEED_POSITION_IDS]);
    const orphanIds = orphans.rows.map((row) => row.id);

    let deletedSkills = 0;
    let deletedPositions = 0;
    if (orphanIds.length) {
      const skillsResult = await client.query(
        `DELETE FROM position_skills WHERE position_id = ANY($1::text[])`,
        [orphanIds]
      );
      deletedSkills = skillsResult.rowCount || 0;
      const positionsResult = await client.query(
        `DELETE FROM positions
         WHERE sport_id = $1
           AND id = ANY($2::text[])`,
        [SOCCER_SPORT_ID, orphanIds]
      );
      deletedPositions = positionsResult.rowCount || 0;
    }

    const remaining = await client.query(
      `SELECT id FROM positions WHERE sport_id = $1 ORDER BY id`,
      [SOCCER_SPORT_ID]
    );
    await client.query('COMMIT');

    return {
      orphanIds,
      deletedSkills,
      deletedPositions,
      remainingIds: remaining.rows.map((row) => row.id)
    };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error('DATABASE_URL is required');
    process.exit(1);
  }

  const pool = new Pool({ connectionString: databaseUrl });
  try {
    const result = await purgeSoccerPositionOrphans(pool);
    console.log(
      JSON.stringify(
        {
          deletedPositions: result.deletedPositions,
          deletedSkills: result.deletedSkills,
          orphanIds: result.orphanIds,
          remainingCount: result.remainingIds.length,
          remainingIds: result.remainingIds
        },
        null,
        2
      )
    );
    if (result.remainingIds.length !== 13) {
      console.error('Expected exactly 13 Soccer positions after purge');
      process.exit(1);
    }
    const allowSet = new Set(SOCCER_SEED_POSITION_IDS);
    const unexpected = result.remainingIds.filter((id) => !allowSet.has(id));
    if (unexpected.length) {
      console.error('Unexpected Soccer position ids remain:', unexpected);
      process.exit(1);
    }
  } finally {
    await pool.end();
  }
}

module.exports = {
  purgeSoccerPositionOrphans,
  SOCCER_SEED_POSITION_IDS,
  SOCCER_SPORT_ID
};

if (require.main === module) {
  main().catch((err) => {
    console.error(err.message || err);
    process.exit(1);
  });
}
