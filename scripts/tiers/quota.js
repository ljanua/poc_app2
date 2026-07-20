'use strict';

function appError(status, code, message) {
  return { status, code, message };
}

async function getTierForClub(pool, clubId) {
  const result = await pool.query(
    `
      SELECT
        st.id,
        st.code,
        st.display_name AS "displayName",
        st.max_teams AS "maxTeams",
        st.max_coaches AS "maxCoaches",
        st.max_club_admins AS "maxClubAdmins",
        st.videos_per_day AS "videosPerDay",
        st.max_videos_per_team AS "maxVideosPerTeam",
        c.is_free_tier AS "isFreeTier"
      FROM clubs c
      LEFT JOIN coach_clubs cc ON cc.club_id = c.id
      LEFT JOIN users u ON u.id = cc.user_id
      LEFT JOIN subscription_tiers st ON st.id = u.subscription_tier_id AND st.active = TRUE
      WHERE c.id = $1
      ORDER BY
        CASE WHEN u.role = 'ClubAdmin' THEN 0 WHEN u.role = 'Coach' THEN 1 ELSE 2 END,
        u.created_at ASC NULLS LAST
      LIMIT 1
    `,
    [clubId]
  );
  const row = result.rows[0];
  if (!row) {
    return null;
  }
  if (row.id) {
    return row;
  }
  // Legacy free-tier club without owner tier row.
  if (row.isFreeTier) {
    const free = await pool.query(
      `SELECT id, code, display_name AS "displayName", max_teams AS "maxTeams",
              max_coaches AS "maxCoaches", max_club_admins AS "maxClubAdmins",
              videos_per_day AS "videosPerDay", max_videos_per_team AS "maxVideosPerTeam"
       FROM subscription_tiers WHERE code = 'free' AND active = TRUE LIMIT 1`
    );
    return free.rows[0] || {
      code: 'free',
      displayName: 'Free Tier',
      maxTeams: 1,
      maxCoaches: 1,
      maxClubAdmins: 0,
      videosPerDay: 2,
      maxVideosPerTeam: 11
    };
  }
  return null;
}

async function getTierForUser(pool, userId) {
  const result = await pool.query(
    `
      SELECT
        st.id,
        st.code,
        st.display_name AS "displayName",
        st.max_teams AS "maxTeams",
        st.max_coaches AS "maxCoaches",
        st.max_club_admins AS "maxClubAdmins",
        st.videos_per_day AS "videosPerDay",
        st.max_videos_per_team AS "maxVideosPerTeam"
      FROM users u
      LEFT JOIN subscription_tiers st ON st.id = u.subscription_tier_id AND st.active = TRUE
      WHERE u.id = $1
      LIMIT 1
    `,
    [userId]
  );
  return result.rows[0] && result.rows[0].id ? result.rows[0] : null;
}

async function assertTierAllowsNewTeam(pool, clubId) {
  const tier = await getTierForClub(pool, clubId);
  if (!tier) {
    return { ok: true, tier: null };
  }
  const count = await pool.query(`SELECT COUNT(*)::int AS n FROM teams WHERE club_id = $1`, [clubId]);
  const n = (count.rows[0] && count.rows[0].n) || 0;
  if (n >= Number(tier.maxTeams)) {
    return {
      ok: false,
      tier,
      error: appError(
        403,
        'tier_limit',
        `${tier.displayName || 'Your plan'} allows only ${tier.maxTeams} team(s). Delete a team or upgrade to add more.`
      )
    };
  }
  return { ok: true, tier };
}

async function assertTierAllowsNewMember(pool, clubId, role) {
  const tier = await getTierForClub(pool, clubId);
  if (!tier) {
    return { ok: true, tier: null };
  }
  const memberRole = String(role || 'Coach');
  if (memberRole === 'ClubAdmin') {
    if (Number(tier.maxClubAdmins) <= 0) {
      return {
        ok: false,
        tier,
        error: appError(
          403,
          'tier_limit',
          `${tier.displayName || 'Your plan'} does not include ClubAdmin seats.`
        )
      };
    }
    const admins = await pool.query(
      `
        SELECT COUNT(*)::int AS n
        FROM coach_clubs cc
        JOIN users u ON u.id = cc.user_id
        WHERE cc.club_id = $1 AND u.role = 'ClubAdmin'
      `,
      [clubId]
    );
    const n = (admins.rows[0] && admins.rows[0].n) || 0;
    if (n >= Number(tier.maxClubAdmins)) {
      return {
        ok: false,
        tier,
        error: appError(
          403,
          'tier_limit',
          `${tier.displayName || 'Your plan'} allows only ${tier.maxClubAdmins} ClubAdmin(s).`
        )
      };
    }
    return { ok: true, tier };
  }

  const coaches = await pool.query(
    `
      SELECT COUNT(*)::int AS n
      FROM coach_clubs cc
      JOIN users u ON u.id = cc.user_id
      WHERE cc.club_id = $1 AND u.role IN ('Coach', 'ClubAdmin')
    `,
    [clubId]
  );
  const n = (coaches.rows[0] && coaches.rows[0].n) || 0;
  if (n >= Number(tier.maxCoaches)) {
    return {
      ok: false,
      tier,
      error: appError(
        403,
        'tier_limit',
        `${tier.displayName || 'Your plan'} allows only ${tier.maxCoaches} coach seat(s).`
      )
    };
  }
  return { ok: true, tier };
}

async function resolveTeamIdForPlayer(pool, playerId) {
  const result = await pool.query(
    `SELECT team_id AS "teamId" FROM player_team_assignments WHERE player_id = $1 LIMIT 1`,
    [playerId]
  );
  return result.rows[0] ? result.rows[0].teamId : null;
}

async function assertTierAllowsNewVideo(pool, teamId) {
  if (!teamId) {
    return { ok: true, tier: null };
  }
  const team = await pool.query(`SELECT club_id AS "clubId" FROM teams WHERE id = $1 LIMIT 1`, [teamId]);
  const clubId = team.rows[0] && team.rows[0].clubId;
  if (!clubId) {
    return { ok: true, tier: null };
  }
  const tier = await getTierForClub(pool, clubId);
  if (!tier) {
    return { ok: true, tier: null };
  }

  const teamCount = await pool.query(
    `
      SELECT COUNT(*)::int AS n
      FROM clips c
      JOIN player_team_assignments a ON a.player_id = c.player_id
      WHERE a.team_id = $1
    `,
    [teamId]
  );
  const teamN = (teamCount.rows[0] && teamCount.rows[0].n) || 0;
  if (teamN >= Number(tier.maxVideosPerTeam)) {
    return {
      ok: false,
      tier,
      error: appError(
        403,
        'tier_limit',
        `${tier.displayName || 'Your plan'} allows at most ${tier.maxVideosPerTeam} videos per team. Delete a video before adding a new one.`
      )
    };
  }

  const dayCount = await pool.query(
    `
      SELECT COUNT(*)::int AS n
      FROM clips c
      JOIN player_team_assignments a ON a.player_id = c.player_id
      JOIN teams t ON t.id = a.team_id
      WHERE t.club_id = $1
        AND c.created_at >= date_trunc('day', NOW() AT TIME ZONE 'UTC')
        AND c.created_at < date_trunc('day', NOW() AT TIME ZONE 'UTC') + INTERVAL '1 day'
    `,
    [clubId]
  );
  const dayN = (dayCount.rows[0] && dayCount.rows[0].n) || 0;
  if (dayN >= Number(tier.videosPerDay)) {
    return {
      ok: false,
      tier,
      error: appError(
        403,
        'tier_limit',
        `${tier.displayName || 'Your plan'} allows ${tier.videosPerDay} video(s) per day (UTC). Try again tomorrow or delete older videos if at the team max.`
      )
    };
  }
  return { ok: true, tier };
}

function roleForTierCode(tierCode) {
  const code = String(tierCode || 'free').toLowerCase();
  if (code === 'professional') {
    return 'Coach';
  }
  // Free + club tiers: ClubAdmin (free is single-user admin of personal club)
  return 'ClubAdmin';
}

module.exports = {
  getTierForClub,
  getTierForUser,
  assertTierAllowsNewTeam,
  assertTierAllowsNewMember,
  assertTierAllowsNewVideo,
  resolveTeamIdForPlayer,
  roleForTierCode,
  appError
};
