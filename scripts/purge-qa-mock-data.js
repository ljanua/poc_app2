'use strict';

/**
 * Inventory (and optionally purge) automated-test / QA leftovers on a DB.
 * Uses DATABASE_URL from the environment (load .env_prod first for prod).
 *
 * Usage:
 *   node scripts/purge-qa-mock-data.js           # inventory only
 *   node scripts/purge-qa-mock-data.js --apply   # delete after inventory
 */

const path = require('node:path');
const { Pool } = require('pg');
const { SOCCER_SEED_SKILL_IDS } = require('../tests/playwright/_soccer-skills.js');
const {
  SOCCER_SEED_POSITION_IDS,
  SOCCER_SPORT_ID
} = require('../tests/playwright/_soccer-positions.js');

async function inventory(client) {
  const id = await client.query('SELECT current_database() AS db');
  const out = { database: id.rows[0].db };

  out.qaSkills = (
    await client.query(
      `
      SELECT id, name, abbreviation
      FROM skills
      WHERE id <> ALL($1::text[])
        AND (name ILIKE 'QA%' OR UPPER(COALESCE(abbreviation, '')) LIKE 'QA%')
      ORDER BY id
      `,
      [SOCCER_SEED_SKILL_IDS]
    )
  ).rows;

  out.skillsWithQaToken = (
    await client.query(
      `
      SELECT id, name, abbreviation
      FROM skills
      WHERE id <> ALL($1::text[])
        AND name ILIKE '%QA%'
        AND NOT (name ILIKE 'QA%' OR UPPER(COALESCE(abbreviation, '')) LIKE 'QA%')
      ORDER BY id
      `,
      [SOCCER_SEED_SKILL_IDS]
    )
  ).rows;

  out.qaSports = (
    await client.query(
      `
      SELECT id, name, status
      FROM sports
      WHERE id <> 'sport_soccer'
        AND (
          name ILIKE 'QA%'
          OR name ILIKE '% QA'
          OR name ILIKE '% QA %'
          OR name ILIKE 'Futsal QA%'
        )
      ORDER BY id
      `
    )
  ).rows;

  out.qaPositions = (
    await client.query(
      `
      SELECT p.id, p.name, p.sport_id, s.name AS sport_name
      FROM positions p
      JOIN sports s ON s.id = p.sport_id
      WHERE p.name ILIKE 'QA%'
         OR (
           p.sport_id = $1
           AND p.id <> ALL($2::text[])
         )
      ORDER BY p.id
      `,
      [SOCCER_SPORT_ID, SOCCER_SEED_POSITION_IDS]
    )
  ).rows;

  out.qaClubs = (
    await client.query(
      `
      SELECT id, name, status, is_free_tier
      FROM clubs
      WHERE name ILIKE 'QA%'
      ORDER BY id
      `
    )
  ).rows;

  out.exampleUsers = (
    await client.query(
      `
      SELECT id, email, role, status, approval_status
      FROM users
      WHERE email ILIKE '%@example.com'
      ORDER BY email
      `
    )
  ).rows;

  const userIds = out.exampleUsers.map((r) => r.id);

  out.teamsLedByExampleUsers = userIds.length
    ? (
        await client.query(
          `SELECT id, name, club_id, lead_coach_user_id FROM teams WHERE lead_coach_user_id = ANY($1::text[]) ORDER BY id`,
          [userIds]
        )
      ).rows
    : [];

  // Clubs created by free-signup / registration tests (not always named QA%)
  const relatedClubIds = new Set(out.qaClubs.map((r) => r.id));
  out.teamsLedByExampleUsers.forEach((t) => {
    if (t.club_id) relatedClubIds.add(t.club_id);
  });
  if (userIds.length) {
    const fromCoachClubs = await client.query(
      `SELECT DISTINCT club_id FROM coach_clubs WHERE user_id = ANY($1::text[])`,
      [userIds]
    );
    fromCoachClubs.rows.forEach((r) => relatedClubIds.add(r.club_id));
  }

  if (relatedClubIds.size) {
    // Keep only clubs that look test-owned: QA* name, free-tier signup clubs,
    // or clubs whose every coach_clubs member is an @example.com user.
    const candidates = (
      await client.query(
        `
        SELECT c.id, c.name, c.status, c.is_free_tier
        FROM clubs c
        WHERE c.id = ANY($1::text[])
        ORDER BY c.id
        `,
        [[...relatedClubIds]]
      )
    ).rows;

    const safeClubIds = [];
    for (const club of candidates) {
      if (String(club.name || '').toUpperCase().startsWith('QA')) {
        safeClubIds.push(club.id);
        continue;
      }
      if (club.is_free_tier) {
        safeClubIds.push(club.id);
        continue;
      }
      const members = await client.query(
        `
        SELECT u.email
        FROM coach_clubs cc
        JOIN users u ON u.id = cc.user_id
        WHERE cc.club_id = $1
        `,
        [club.id]
      );
      const emails = members.rows.map((r) => String(r.email || '').toLowerCase());
      const allExample =
        emails.length > 0 && emails.every((e) => e.endsWith('@example.com'));
      const noMembers = emails.length === 0;
      if (allExample || noMembers) {
        safeClubIds.push(club.id);
      }
    }

    out.qaClubs = candidates.filter((c) => safeClubIds.includes(c.id));
    out.skippedRealClubs = candidates
      .filter((c) => !safeClubIds.includes(c.id))
      .map((c) => ({ id: c.id, name: c.name }));
  } else {
    out.skippedRealClubs = [];
  }

  const clubIds = out.qaClubs.map((r) => r.id);
  const sportIds = out.qaSports.map((r) => r.id);

  out.teamsUnderQaClubs = clubIds.length
    ? (
        await client.query(
          `SELECT id, name, club_id, lead_coach_user_id FROM teams WHERE club_id = ANY($1::text[]) ORDER BY id`,
          [clubIds]
        )
      ).rows
    : [];

  out.coachClubsForQa = clubIds.length || userIds.length
    ? (
        await client.query(
          `
          SELECT user_id, club_id FROM coach_clubs
          WHERE ($1::text[] IS NOT NULL AND cardinality($1::text[]) > 0 AND club_id = ANY($1::text[]))
             OR ($2::text[] IS NOT NULL AND cardinality($2::text[]) > 0 AND user_id = ANY($2::text[]))
          `,
          [clubIds.length ? clubIds : null, userIds.length ? userIds : null]
        )
      ).rows
    : [];

  out.registrationIntentsForExampleUsers = userIds.length
    ? (
        await client.query(
          `SELECT id, user_id, intent, status, proposed_club_name FROM registration_intents WHERE user_id = ANY($1::text[]) ORDER BY id`,
          [userIds]
        )
      ).rows
    : [];

  const teamIds = [
    ...new Set([
      ...out.teamsUnderQaClubs.map((t) => t.id),
      ...out.teamsLedByExampleUsers.map((t) => t.id)
    ])
  ];

  out.playersOnQaTeams = teamIds.length
    ? (
        await client.query(
          `
          SELECT p.id, p.name, a.team_id
          FROM players p
          JOIN player_team_assignments a ON a.player_id = p.id
          WHERE a.team_id = ANY($1::text[])
          ORDER BY p.id
          `,
          [teamIds]
        )
      ).rows
    : [];

  out.clipsOnQaPlayers = out.playersOnQaTeams.length
    ? (
        await client.query(
          `SELECT id, player_id, status FROM clips WHERE player_id = ANY($1::text[]) ORDER BY id`,
          [out.playersOnQaTeams.map((p) => p.id)]
        )
      ).rows
    : [];

  out.gamesOnQaTeams = teamIds.length
    ? (
        await client.query(
          `SELECT id, team_id, opponent, kickoff_at FROM games WHERE team_id = ANY($1::text[]) ORDER BY id`,
          [teamIds]
        )
      ).rows
    : [];

  out.positionsUnderQaSports = sportIds.length
    ? (
        await client.query(
          `SELECT id, name, sport_id FROM positions WHERE sport_id = ANY($1::text[]) ORDER BY id`,
          [sportIds]
        )
      ).rows
    : [];

  out.summary = {
    qaSkills: out.qaSkills.length,
    skillsWithQaToken: out.skillsWithQaToken.length,
    qaSports: out.qaSports.length,
    qaPositions: out.qaPositions.length,
    positionsUnderQaSports: out.positionsUnderQaSports.length,
    qaClubs: out.qaClubs.length,
    exampleUsers: out.exampleUsers.length,
    teamsUnderQaClubs: out.teamsUnderQaClubs.length,
    teamsLedByExampleUsers: out.teamsLedByExampleUsers.length,
    coachClubsForQa: out.coachClubsForQa.length,
    registrationIntents: out.registrationIntentsForExampleUsers.length,
    playersOnQaTeams: out.playersOnQaTeams.length,
    clipsOnQaPlayers: out.clipsOnQaPlayers.length,
    gamesOnQaTeams: out.gamesOnQaTeams.length
  };

  return out;
}

async function applyPurge(client, inv) {
  const deleted = {};

  const exampleUserIds = inv.exampleUsers.map((r) => r.id);
  const qaClubIds = inv.qaClubs.map((r) => r.id);
  const teamIds = [
    ...new Set([
      ...inv.teamsUnderQaClubs.map((t) => t.id),
      ...inv.teamsLedByExampleUsers.map((t) => t.id)
    ])
  ];
  const playerIds = inv.playersOnQaTeams.map((p) => p.id);
  const qaSportIds = inv.qaSports.map((r) => r.id);
  const qaSkillIds = [
    ...new Set([...inv.qaSkills, ...inv.skillsWithQaToken].map((r) => r.id))
  ];
  const positionIds = [
    ...new Set([
      ...inv.qaPositions.map((r) => r.id),
      ...inv.positionsUnderQaSports.map((r) => r.id)
    ])
  ];

  await client.query('BEGIN');
  try {
    // Clear club default_sport pointing at disposable QA sports
    if (qaSportIds.length) {
      deleted.clubsDefaultSportCleared = (
        await client.query(
          `UPDATE clubs SET default_sport_id = 'sport_soccer' WHERE default_sport_id = ANY($1::text[])`,
          [qaSportIds]
        )
      ).rowCount;
    }

    if (playerIds.length) {
      deleted.clipSegments = (
        await client.query(
          `DELETE FROM clip_segments WHERE clip_id IN (SELECT id FROM clips WHERE player_id = ANY($1::text[]))`,
          [playerIds]
        )
      ).rowCount;
      deleted.clips = (await client.query(`DELETE FROM clips WHERE player_id = ANY($1::text[])`, [playerIds]))
        .rowCount;
      deleted.playerShareLinks = (
        await client.query(`DELETE FROM player_share_links WHERE player_id = ANY($1::text[])`, [playerIds])
      ).rowCount;
      deleted.playerDataAudits = (
        await client.query(`DELETE FROM player_data_audits WHERE player_id = ANY($1::text[])`, [playerIds])
      ).rowCount;
      deleted.playerSkillRatingsHistory = (
        await client.query(
          `DELETE FROM player_skill_ratings_history WHERE player_id = ANY($1::text[])`,
          [playerIds]
        )
      ).rowCount;
      deleted.playerSkillRatings = (
        await client.query(`DELETE FROM player_skill_ratings WHERE player_id = ANY($1::text[])`, [playerIds])
      ).rowCount;
      deleted.playerStats = (
        await client.query(`DELETE FROM player_stats WHERE player_id = ANY($1::text[])`, [playerIds])
      ).rowCount;
      deleted.gamePerformancePlayers = (
        await client.query(`DELETE FROM game_performance WHERE player_id = ANY($1::text[])`, [playerIds])
      ).rowCount;
      deleted.gameSubsPlayers = (
        await client.query(
          `DELETE FROM game_substitutions WHERE player_in_id = ANY($1::text[]) OR player_out_id = ANY($1::text[])`,
          [playerIds]
        )
      ).rowCount;
    }

    if (teamIds.length) {
      deleted.gamePerformanceTeams = (
        await client.query(
          `DELETE FROM game_performance WHERE game_id IN (SELECT id FROM games WHERE team_id = ANY($1::text[]))`,
          [teamIds]
        )
      ).rowCount;
      deleted.gameSubsTeams = (
        await client.query(
          `DELETE FROM game_substitutions WHERE game_id IN (SELECT id FROM games WHERE team_id = ANY($1::text[]))`,
          [teamIds]
        )
      ).rowCount;
      deleted.games = (await client.query(`DELETE FROM games WHERE team_id = ANY($1::text[])`, [teamIds]))
        .rowCount;
      deleted.registrationIntentsTeams = (
        await client.query(`UPDATE registration_intents SET target_team_id = NULL WHERE target_team_id = ANY($1::text[])`, [
          teamIds
        ])
      ).rowCount;
      deleted.playerTeamAssignments = (
        await client.query(`DELETE FROM player_team_assignments WHERE team_id = ANY($1::text[])`, [teamIds])
      ).rowCount;
    }

    if (playerIds.length) {
      deleted.players = (await client.query(`DELETE FROM players WHERE id = ANY($1::text[])`, [playerIds]))
        .rowCount;
    }

    if (teamIds.length) {
      deleted.teams = (await client.query(`DELETE FROM teams WHERE id = ANY($1::text[])`, [teamIds])).rowCount;
    }

    if (exampleUserIds.length) {
      deleted.authHandoff = (
        await client.query(`DELETE FROM auth_handoff_codes WHERE user_id = ANY($1::text[])`, [exampleUserIds])
      ).rowCount;
      deleted.oauthIdentities = (
        await client.query(`DELETE FROM user_oauth_identities WHERE user_id = ANY($1::text[])`, [
          exampleUserIds
        ])
      ).rowCount;
      deleted.registrationIntents = (
        await client.query(`DELETE FROM registration_intents WHERE user_id = ANY($1::text[])`, [exampleUserIds])
      ).rowCount;
      deleted.coachClubsUsers = (
        await client.query(`DELETE FROM coach_clubs WHERE user_id = ANY($1::text[])`, [exampleUserIds])
      ).rowCount;
    }

    if (qaClubIds.length) {
      deleted.coachClubsClubs = (
        await client.query(`DELETE FROM coach_clubs WHERE club_id = ANY($1::text[])`, [qaClubIds])
      ).rowCount;
      deleted.registrationIntentsClubs = (
        await client.query(
          `UPDATE registration_intents SET target_club_id = NULL WHERE target_club_id = ANY($1::text[])`,
          [qaClubIds]
        )
      ).rowCount;
      deleted.clubs = (await client.query(`DELETE FROM clubs WHERE id = ANY($1::text[])`, [qaClubIds]))
        .rowCount;
    }

    if (exampleUserIds.length) {
      // Null created_by on remaining games if any (should be none for QA teams)
      deleted.gamesCreatedByNulled = (
        await client.query(
          `UPDATE games SET created_by_user_id = NULL WHERE created_by_user_id = ANY($1::text[])`,
          [exampleUserIds]
        )
      ).rowCount;
      deleted.users = (await client.query(`DELETE FROM users WHERE id = ANY($1::text[])`, [exampleUserIds]))
        .rowCount;
    }

    if (positionIds.length) {
      deleted.positionSkills = (
        await client.query(`DELETE FROM position_skills WHERE position_id = ANY($1::text[])`, [positionIds])
      ).rowCount;
    }

    if (qaSkillIds.length) {
      deleted.positionSkillsBySkill = (
        await client.query(`DELETE FROM position_skills WHERE skill_id = ANY($1::text[])`, [qaSkillIds])
      ).rowCount;
      deleted.playerSkillRatingsBySkill = (
        await client.query(`DELETE FROM player_skill_ratings WHERE skill_id = ANY($1::text[])`, [qaSkillIds])
      ).rowCount;
      deleted.playerSkillRatingsHistoryBySkill = (
        await client.query(`DELETE FROM player_skill_ratings_history WHERE skill_id = ANY($1::text[])`, [
          qaSkillIds
        ])
      ).rowCount;
      deleted.playerDataAuditsBySkill = (
        await client.query(
          `UPDATE player_data_audits SET skill_id = NULL WHERE skill_id = ANY($1::text[])`,
          [qaSkillIds]
        )
      ).rowCount;
      deleted.skills = (await client.query(`DELETE FROM skills WHERE id = ANY($1::text[])`, [qaSkillIds]))
        .rowCount;
    }

    if (positionIds.length) {
      deleted.positions = (
        await client.query(`DELETE FROM positions WHERE id = ANY($1::text[])`, [positionIds])
      ).rowCount;
    }

    if (qaSportIds.length) {
      deleted.sports = (await client.query(`DELETE FROM sports WHERE id = ANY($1::text[])`, [qaSportIds]))
        .rowCount;
    }

    await client.query('COMMIT');
    return deleted;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  }
}

async function main() {
  const apply = process.argv.includes('--apply');
  if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL is required (load .env_prod for production)');
    process.exit(1);
  }

  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const client = await pool.connect();
  try {
    const inv = await inventory(client);
    console.log(
      JSON.stringify(
        {
          mode: apply ? 'apply' : 'inventory',
          database: inv.database,
          summary: inv.summary,
          qaSkills: inv.qaSkills,
          skillsWithQaToken: inv.skillsWithQaToken,
          qaSports: inv.qaSports,
          qaPositions: inv.qaPositions,
          positionsUnderQaSports: inv.positionsUnderQaSports,
          qaClubs: inv.qaClubs,
          skippedRealClubs: inv.skippedRealClubs || [],
          exampleUsers: inv.exampleUsers.map((u) => ({
            id: u.id,
            email: u.email,
            role: u.role,
            status: u.status,
            approval_status: u.approval_status
          })),
          teamsUnderQaClubs: inv.teamsUnderQaClubs,
          teamsLedByExampleUsers: inv.teamsLedByExampleUsers,
          registrationIntents: inv.registrationIntentsForExampleUsers,
          playersOnQaTeams: inv.playersOnQaTeams,
          clipsOnQaPlayers: inv.clipsOnQaPlayers,
          gamesOnQaTeams: inv.gamesOnQaTeams
        },
        null,
        2
      )
    );

    if (!apply) {
      console.error('\nInventory only. Re-run with --apply to delete the matched rows.');
      return;
    }

    const deleted = await applyPurge(client, inv);
    const after = await inventory(client);
    console.log(JSON.stringify({ deleted, afterSummary: after.summary }, null, 2));
    if (Object.values(after.summary).some((n) => n > 0)) {
      console.error('WARNING: some QA-pattern rows remain after purge');
      process.exitCode = 2;
    }
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
