'use strict';

const path = require('node:path');
const { Pool } = require('pg');
require('dotenv').config({ path: path.join(process.cwd(), '.env') });

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function main() {
  const players = await pool.query(
    `SELECT id, name FROM players WHERE name ILIKE '%Defense One%'`
  );
  console.log('players:', players.rows);

  for (const player of players.rows) {
    const coach = await pool.query(
      `
        SELECT u.email AS coach_email, t.name AS team_name
        FROM players p
        JOIN player_team_assignments a ON a.player_id = p.id
        JOIN teams t ON t.id = a.team_id
        JOIN users u ON u.id = t.lead_coach_user_id
        WHERE p.id = $1
        LIMIT 1
      `,
      [player.id]
    );
    const clips = await pool.query(
      `SELECT id, status, score FROM clips WHERE player_id = $1 ORDER BY created_at`,
      [player.id]
    );
    const stats = await pool.query(
      `SELECT clip_submitted_count, clip_assessed_count, clip_pending_count
       FROM player_stats WHERE player_id = $1`,
      [player.id]
    );
    console.log(`\n${player.name} (${player.id})`);
    console.log('coach:', coach.rows[0] || null);
    console.log('clips:', clips.rows);
    console.log('player_stats:', stats.rows[0] || null);
  }

  await pool.end();
}

main().catch(async (error) => {
  console.error(error);
  await pool.end();
  process.exit(1);
});
