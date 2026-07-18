'use strict';

/**
 * Delete automated-test leftover skills (name QA% or abbreviation QA%)
 * that are not in the migration-015 seed allowlist, including their
 * position_skills rows. Does not insert any skills.
 *
 * Usage: node scripts/purge-qa-skills.js
 */

const path = require('node:path');
const { Pool } = require('pg');
const { SOCCER_SEED_SKILL_IDS } = require('../tests/playwright/_soccer-skills.js');

try {
  require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
} catch (err) {
  // dotenv optional when DATABASE_URL is already set
}

async function purgeQaSkills(pool) {
  if (!pool) {
    throw new Error('pool is required');
  }
  if (SOCCER_SEED_SKILL_IDS.length !== 31) {
    throw new Error('SOCCER_SEED_SKILL_IDS must contain exactly 31 ids');
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const matched = await client.query(
      `
        SELECT id, name, abbreviation
        FROM skills
        WHERE id <> ALL($1::text[])
          AND (
            name ILIKE 'QA%'
            OR UPPER(abbreviation) LIKE 'QA%'
          )
        ORDER BY id
      `,
      [SOCCER_SEED_SKILL_IDS]
    );
    const matchedIds = matched.rows.map((row) => row.id);

    let deletedAssignments = 0;
    let deletedSkills = 0;
    if (matchedIds.length) {
      const assignmentsResult = await client.query(
        `DELETE FROM position_skills WHERE skill_id = ANY($1::text[])`,
        [matchedIds]
      );
      deletedAssignments = assignmentsResult.rowCount || 0;
      const skillsResult = await client.query(
        `DELETE FROM skills WHERE id = ANY($1::text[])`,
        [matchedIds]
      );
      deletedSkills = skillsResult.rowCount || 0;
    }

    const remainingSeed = await client.query(
      `SELECT id FROM skills WHERE id = ANY($1::text[]) ORDER BY id`,
      [SOCCER_SEED_SKILL_IDS]
    );
    const leftoverQa = await client.query(
      `
        SELECT id FROM skills
        WHERE id <> ALL($1::text[])
          AND (
            name ILIKE 'QA%'
            OR UPPER(abbreviation) LIKE 'QA%'
          )
      `,
      [SOCCER_SEED_SKILL_IDS]
    );

    await client.query('COMMIT');

    return {
      matchedIds,
      matchedRows: matched.rows,
      deletedAssignments,
      deletedSkills,
      remainingSeedIds: remainingSeed.rows.map((row) => row.id),
      leftoverQaIds: leftoverQa.rows.map((row) => row.id)
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
    const result = await purgeQaSkills(pool);
    console.log(
      JSON.stringify(
        {
          deletedSkills: result.deletedSkills,
          deletedAssignments: result.deletedAssignments,
          matchedIds: result.matchedIds,
          remainingSeedCount: result.remainingSeedIds.length,
          leftoverQaCount: result.leftoverQaIds.length
        },
        null,
        2
      )
    );

    if (result.remainingSeedIds.length !== 31) {
      const allowSet = new Set(SOCCER_SEED_SKILL_IDS);
      const missing = SOCCER_SEED_SKILL_IDS.filter((id) => !result.remainingSeedIds.includes(id));
      console.error('Expected all 31 seed skill ids to remain. Missing:', missing);
      process.exit(1);
    }
    const allowSet = new Set(SOCCER_SEED_SKILL_IDS);
    const unexpected = result.remainingSeedIds.filter((id) => !allowSet.has(id));
    if (unexpected.length) {
      console.error('Unexpected seed query results:', unexpected);
      process.exit(1);
    }
    if (result.leftoverQaIds.length) {
      console.error('QA leftover skills remain after purge:', result.leftoverQaIds);
      process.exit(1);
    }
  } finally {
    await pool.end();
  }
}

module.exports = {
  purgeQaSkills,
  SOCCER_SEED_SKILL_IDS
};

if (require.main === module) {
  main().catch((err) => {
    console.error(err.message || err);
    process.exit(1);
  });
}
