'use strict';

const path = require('node:path');
const { Pool } = require('pg');
require('dotenv').config({ path: path.join(process.cwd(), '.env') });

const clipId = process.argv[2];
if (!clipId) {
  console.error('Usage: node scripts/video-processing/show-clip.js <clipId>');
  process.exit(1);
}

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

pool.query(
  `SELECT id, status, score, comments, summary, skill_ratings, error_message
   FROM clips WHERE id = $1`,
  [clipId]
)
  .then((result) => {
    console.log(JSON.stringify(result.rows[0] || null, null, 2));
    return pool.end();
  })
  .catch(async (error) => {
    console.error(error);
    await pool.end();
    process.exit(1);
  });
