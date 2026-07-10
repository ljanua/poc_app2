'use strict';

const path = require('node:path');
const { Pool } = require('pg');
const { processClip } = require('./process-clip');
const { setFfmpegPath } = require('./ffmpeg-utils');
const { getFfmpegPath } = require('./config');

require('dotenv').config({ path: path.join(process.cwd(), '.env') });

const clipId = process.argv[2];
if (!clipId) {
  console.error('Usage: node scripts/video-processing/retry-clip.js <clipId>');
  process.exit(1);
}

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function main() {
  const before = await pool.query(
    `SELECT id, status, video_storage_path, error_message, score, summary
     FROM clips WHERE id = $1`,
    [clipId]
  );
  if (!before.rows[0]) {
    throw new Error(`Clip not found: ${clipId}`);
  }
  console.log('Before:', JSON.stringify(before.rows[0], null, 2));

  await pool.query(
    `
      UPDATE clips
      SET status = 'in_progress',
          error_message = NULL,
          processing_started_at = NOW(),
          processing_completed_at = NULL,
          updated_at = NOW()
      WHERE id = $1
    `,
    [clipId]
  );
  console.log(`Processing ${clipId}...`);

  setFfmpegPath(await getFfmpegPath(pool));
  await processClip(pool, clipId);

  const after = await pool.query(
    `SELECT status, score, summary, comments, error_message, skill_ratings
     FROM clips WHERE id = $1`,
    [clipId]
  );
  const row = after.rows[0];
  console.log('After:', JSON.stringify(row, null, 2));
  await pool.end();
  process.exit(row.status === 'complete' ? 0 : 1);
}

main().catch(async (error) => {
  console.error(error);
  await pool.end();
  process.exit(1);
});
