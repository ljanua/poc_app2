'use strict';

const crypto = require('node:crypto');
const { hashPassword } = require('./passwords');
const { roleForTierCode } = require('../tiers/quota');

const DEFAULT_TEAM_AGE_GROUP = 'U15';

async function ensureSubscriptionSchema(pool) {
  if (!pool) {
    return;
  }

  await pool.query(`
    CREATE TABLE IF NOT EXISTS subscription_tiers (
      id TEXT PRIMARY KEY,
      code TEXT NOT NULL UNIQUE,
      display_name TEXT NOT NULL,
      max_teams INT NOT NULL CHECK (max_teams >= 0),
      max_coaches INT NOT NULL CHECK (max_coaches >= 0),
      max_club_admins INT NOT NULL CHECK (max_club_admins >= 0),
      videos_per_day INT NOT NULL CHECK (videos_per_day >= 0),
      max_videos_per_team INT NOT NULL CHECK (max_videos_per_team >= 0),
      active BOOLEAN NOT NULL DEFAULT TRUE,
      sort_order INT NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await pool.query(`
    INSERT INTO subscription_tiers (
      id, code, display_name, max_teams, max_coaches, max_club_admins,
      videos_per_day, max_videos_per_team, active, sort_order
    ) VALUES
      ('tier_free', 'free', 'Free Tier', 1, 1, 0, 2, 11, TRUE, 10),
      ('tier_professional', 'professional', 'Professional', 3, 3, 0, 2, 11, TRUE, 20),
      ('tier_club_basic', 'club_basic', 'Club Basic', 5, 10, 1, 11, 33, TRUE, 30),
      ('tier_club_premium', 'club_premium', 'Club Premium', 10, 10, 10, 11, 55, TRUE, 40)
    ON CONFLICT (code) DO NOTHING;
  `);

  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS approval_status TEXT NOT NULL DEFAULT 'active'`);
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS subscription_tier_id TEXT`);
  await pool.query(`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_schema = 'public'
          AND table_name = 'users'
          AND constraint_name = 'users_approval_status_check'
      ) THEN
        ALTER TABLE users
          ADD CONSTRAINT users_approval_status_check
          CHECK (approval_status IN ('pending', 'active', 'rejected'));
      END IF;
    END $$;
  `);

  await pool.query(`
    UPDATE users
    SET approval_status = COALESCE(NULLIF(approval_status, ''), 'active'),
        subscription_tier_id = COALESCE(
          subscription_tier_id,
          (SELECT id FROM subscription_tiers WHERE code = 'free' LIMIT 1)
        )
    WHERE subscription_tier_id IS NULL OR approval_status IS NULL OR approval_status = '';
  `);

  await pool.query(`CREATE INDEX IF NOT EXISTS idx_users_approval_status ON users(approval_status)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_users_subscription_tier_id ON users(subscription_tier_id)`);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS user_oauth_identities (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      provider TEXT NOT NULL CHECK (provider IN ('google', 'apple', 'facebook')),
      provider_user_id TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (provider, provider_user_id)
    );
  `);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_user_oauth_identities_user_id ON user_oauth_identities(user_id)`);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS auth_handoff_codes (
      code TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      expires_at TIMESTAMPTZ NOT NULL,
      used_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_auth_handoff_codes_user_id ON auth_handoff_codes(user_id)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_auth_handoff_codes_expires_at ON auth_handoff_codes(expires_at)`);

  await ensureRegistrationIntentSchema(pool);
}

async function ensureRegistrationIntentSchema(pool) {
  if (!pool) {
    return;
  }
  await pool.query(`
    CREATE TABLE IF NOT EXISTS registration_intents (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      intent TEXT NOT NULL CHECK (intent IN ('create', 'join')),
      status TEXT NOT NULL CHECK (status IN (
        'pending_sa',
        'pending_join',
        'completed',
        'sa_rejected',
        'join_rejected'
      )),
      proposed_club_name TEXT,
      proposed_team_name TEXT,
      target_club_id TEXT REFERENCES clubs(id) ON DELETE SET NULL,
      target_team_id TEXT REFERENCES teams(id) ON DELETE SET NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_registration_intents_user_id ON registration_intents(user_id)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_registration_intents_status ON registration_intents(status)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_registration_intents_target_club ON registration_intents(target_club_id)`);
}

function normalizeLookup(value) {
  return String(value || '').trim().replace(/\s+/g, ' ');
}

function roleForRegistrationIntent(tierCode, intent) {
  const code = String(tierCode || 'free').toLowerCase();
  const kind = String(intent || 'create').toLowerCase();
  if (kind === 'join') {
    return 'Coach';
  }
  // Create paths (including Professional create): founding ClubAdmin.
  if (code === 'professional' || code === 'free' || code === 'club_basic' || code === 'club_premium') {
    return 'ClubAdmin';
  }
  return roleForTierCode(code);
}

async function resolveTierByCode(pool, tierCode) {
  const code = String(tierCode || 'free').trim().toLowerCase() || 'free';
  const result = await pool.query(
    `SELECT id, code, display_name AS "displayName", max_teams AS "maxTeams",
            max_coaches AS "maxCoaches", max_club_admins AS "maxClubAdmins",
            videos_per_day AS "videosPerDay", max_videos_per_team AS "maxVideosPerTeam"
     FROM subscription_tiers WHERE code = $1 AND active = TRUE LIMIT 1`,
    [code]
  );
  return result.rows[0] || null;
}

async function clubNameTaken(pool, clubName, { excludeUserId } = {}) {
  const name = normalizeLookup(clubName);
  if (!name) {
    return true;
  }
  const existing = await pool.query(
    `SELECT id FROM clubs WHERE LOWER(name) = LOWER($1) LIMIT 1`,
    [name]
  );
  if (existing.rows[0]) {
    return true;
  }
  const pending = await pool.query(
    `
      SELECT ri.id
      FROM registration_intents ri
      WHERE ri.intent = 'create'
        AND ri.status IN ('pending_sa', 'pending_join')
        AND LOWER(ri.proposed_club_name) = LOWER($1)
        AND ($2::text IS NULL OR ri.user_id <> $2)
      LIMIT 1
    `,
    [name, excludeUserId || null]
  );
  return Boolean(pending.rows[0]);
}

async function uniqueTeamName(pool, desiredName) {
  const base = normalizeLookup(desiredName).slice(0, 60) || 'Team';
  let candidate = base;
  let suffix = 0;
  while (true) {
    const clash = await pool.query(`SELECT id FROM teams WHERE LOWER(name) = LOWER($1) LIMIT 1`, [candidate]);
    if (!clash.rows[0]) {
      return candidate;
    }
    suffix += 1;
    const tag = ` ${suffix}`;
    candidate = `${base.slice(0, Math.max(2, 60 - tag.length))}${tag}`;
  }
}

function parseIntentOptions(options, tierCode) {
  const tier = String(tierCode || 'free').toLowerCase();
  let intent = String(options.intent || '').trim().toLowerCase();
  if (!intent) {
    intent = 'create';
  }
  if (intent !== 'create' && intent !== 'join') {
    return { ok: false, error: { status: 400, code: 'validation_error', message: 'Choose create or join.' } };
  }
  if (tier === 'free' && intent === 'join') {
    return { ok: false, error: { status: 400, code: 'validation_error', message: 'Free Tier cannot join an existing club. Enter a new team name.' } };
  }
  if ((tier === 'club_basic' || tier === 'club_premium') && intent === 'join') {
    return { ok: false, error: { status: 400, code: 'validation_error', message: 'Club tiers must create a new club and team.' } };
  }
  if (tier !== 'professional' && intent === 'join') {
    return { ok: false, error: { status: 400, code: 'validation_error', message: 'Only Professional can request to join an existing club.' } };
  }

  let clubName = normalizeLookup(options.clubName || options.proposedClubName);
  let teamName = normalizeLookup(options.teamName || options.proposedTeamName);
  const targetClubId = String(options.targetClubId || '').trim() || null;
  const targetTeamId = String(options.targetTeamId || '').trim() || null;

  if (intent === 'create') {
    if (tier === 'free') {
      if (!teamName || teamName.length < 2) {
        return { ok: false, error: { status: 400, code: 'validation_error', message: 'Enter a team name.' } };
      }
      clubName = teamName;
    } else {
      if (!clubName || clubName.length < 2 || !teamName || teamName.length < 2) {
        return { ok: false, error: { status: 400, code: 'validation_error', message: 'Enter a club name and a team name.' } };
      }
    }
  } else {
    if (!targetClubId) {
      return { ok: false, error: { status: 400, code: 'validation_error', message: 'Select an existing club to join.' } };
    }
  }

  return {
    ok: true,
    intent,
    clubName: clubName || null,
    teamName: teamName || null,
    targetClubId,
    targetTeamId
  };
}

async function createPendingRegistration(pool, options) {
  await ensureRegistrationIntentSchema(pool);

  const name = normalizeLookup(options.name);
  const email = String(options.email || '').trim().toLowerCase();
  const password = options.password != null ? String(options.password) : null;
  const tierCode = String(options.tierCode || 'free').trim().toLowerCase() || 'free';
  const oauth = options.oauth || null;

  if (!name || name.length < 2 || !email.includes('@')) {
    return { ok: false, error: { status: 400, code: 'validation_error', message: 'Please review the form fields and try again.' } };
  }

  if (!oauth) {
    const hasNumber = /\d/.test(String(password || ''));
    if (!password || password.length < 10 || !hasNumber) {
      return { ok: false, error: { status: 400, code: 'validation_error', message: 'Please review the form fields and try again.' } };
    }
  }

  const tier = await resolveTierByCode(pool, tierCode);
  if (!tier) {
    return { ok: false, error: { status: 400, code: 'validation_error', message: 'Please select a valid subscription tier.' } };
  }

  const intentParsed = parseIntentOptions(options, tier.code);
  if (!intentParsed.ok) {
    return intentParsed;
  }

  const existing = await pool.query(`SELECT id FROM users WHERE LOWER(email) = LOWER($1) LIMIT 1`, [email]);
  if (existing.rows[0]) {
    return { ok: false, error: { status: 409, code: 'conflict', message: 'A user with the same identifier already exists.' } };
  }

  if (intentParsed.intent === 'create') {
    if (await clubNameTaken(pool, intentParsed.clubName)) {
      return {
        ok: false,
        error: {
          status: 409,
          code: 'conflict',
          message: 'That club name is already taken. Choose a different name.'
        }
      };
    }
  } else {
    const club = await pool.query(
      `SELECT id, name FROM clubs WHERE id = $1 AND status = 'active' LIMIT 1`,
      [intentParsed.targetClubId]
    );
    if (!club.rows[0]) {
      return { ok: false, error: { status: 404, code: 'not_found', message: 'Selected club was not found.' } };
    }
    if (intentParsed.targetTeamId) {
      const team = await pool.query(
        `SELECT id FROM teams WHERE id = $1 AND club_id = $2 AND status = 'active' LIMIT 1`,
        [intentParsed.targetTeamId, intentParsed.targetClubId]
      );
      if (!team.rows[0]) {
        return { ok: false, error: { status: 404, code: 'not_found', message: 'Selected team was not found in that club.' } };
      }
    }
  }

  const role = roleForRegistrationIntent(tier.code, intentParsed.intent);
  const passwordHash = password ? await hashPassword(password) : null;
  const userId = `u_${Date.now()}_${Math.floor(Math.random() * 10000)}`;
  const intentId = `ri_${Date.now().toString(36)}_${Math.floor(Math.random() * 1000)}`;

  await pool.query('BEGIN');
  try {
    await pool.query(
      `
        INSERT INTO users (
          id, name, email, role, status, password_hash, last_login_label,
          approval_status, subscription_tier_id
        )
        VALUES ($1, $2, $3, $4, 'inactive', $5, NULL, 'pending', $6)
      `,
      [userId, name, email, role, passwordHash, tier.id]
    );

    await pool.query(
      `
        INSERT INTO registration_intents (
          id, user_id, intent, status,
          proposed_club_name, proposed_team_name,
          target_club_id, target_team_id
        )
        VALUES ($1, $2, $3, 'pending_sa', $4, $5, $6, $7)
      `,
      [
        intentId,
        userId,
        intentParsed.intent,
        intentParsed.clubName,
        intentParsed.teamName,
        intentParsed.targetClubId,
        intentParsed.targetTeamId
      ]
    );

    if (oauth && oauth.provider && oauth.providerUserId) {
      const identityId = `oauth_${Date.now()}_${Math.floor(Math.random() * 10000)}`;
      await pool.query(
        `
          INSERT INTO user_oauth_identities (id, user_id, provider, provider_user_id)
          VALUES ($1, $2, $3, $4)
        `,
        [identityId, userId, oauth.provider, String(oauth.providerUserId)]
      );
    }

    await pool.query('COMMIT');
  } catch (error) {
    await pool.query('ROLLBACK');
    throw error;
  }

  const created = await pool.query(
    `
      SELECT id, name, email, role, status,
             approval_status AS "approvalStatus",
             subscription_tier_id AS "subscriptionTierId",
             password_hash AS "passwordHash",
             last_login_label AS "lastLogin"
      FROM users WHERE id = $1 LIMIT 1
    `,
    [userId]
  );
  const user = created.rows[0];
  user.clubIds = [];
  user.tierCode = tier.code;
  user.tierDisplayName = tier.displayName;
  return {
    ok: true,
    user,
    tier,
    intent: {
      id: intentId,
      intent: intentParsed.intent,
      status: 'pending_sa',
      proposedClubName: intentParsed.clubName,
      proposedTeamName: intentParsed.teamName,
      targetClubId: intentParsed.targetClubId,
      targetTeamId: intentParsed.targetTeamId
    }
  };
}

async function materializeCreateOrg(pool, userId, intentRow, { asRecovery } = {}) {
  const clubName = normalizeLookup(intentRow.proposedClubName || intentRow.proposed_club_name);
  const teamName = normalizeLookup(intentRow.proposedTeamName || intentRow.proposed_team_name);
  if (!clubName || !teamName) {
    return { ok: false, error: { status: 400, code: 'validation_error', message: 'Club and team names are required.' } };
  }
  if (await clubNameTaken(pool, clubName, { excludeUserId: userId })) {
    return {
      ok: false,
      error: {
        status: 409,
        code: 'conflict',
        message: 'That club name is already taken. Choose a different name.'
      }
    };
  }

  const userRes = await pool.query(
    `
      SELECT u.id, u.role, st.code AS "tierCode"
      FROM users u
      LEFT JOIN subscription_tiers st ON st.id = u.subscription_tier_id
      WHERE u.id = $1
      LIMIT 1
    `,
    [userId]
  );
  const user = userRes.rows[0];
  if (!user) {
    return { ok: false, error: { status: 404, code: 'not_found', message: 'User not found.' } };
  }

  const isFree = String(user.tierCode || '') === 'free';
  const clubId = `c_${Date.now().toString(36)}_${Math.floor(Math.random() * 1000)}`;
  const teamId = `t_${Date.now().toString(36)}_${Math.floor(Math.random() * 1000)}`;
  const finalTeamName = await uniqueTeamName(pool, teamName);

  await pool.query('BEGIN');
  try {
    await pool.query(
      `INSERT INTO clubs (id, name, status, default_sport_id, is_free_tier)
       VALUES ($1, $2, 'active', 'sport_soccer', $3)`,
      [clubId, clubName, isFree]
    );
    await pool.query(
      `
        INSERT INTO teams (id, name, age_group, lead_coach_user_id, club_id, sport_id, status)
        VALUES ($1, $2, $3, $4, $5, 'sport_soccer', 'active')
      `,
      [teamId, finalTeamName, DEFAULT_TEAM_AGE_GROUP, userId, clubId]
    );
    await pool.query(`INSERT INTO coach_clubs (user_id, club_id) VALUES ($1, $2)`, [userId, clubId]);
    if (user.role !== 'ClubAdmin') {
      await pool.query(`UPDATE users SET role = 'ClubAdmin', updated_at = NOW() WHERE id = $1`, [userId]);
    }
    await pool.query(
      `
        UPDATE registration_intents
        SET status = 'completed',
            proposed_club_name = $2,
            proposed_team_name = $3,
            updated_at = NOW()
        WHERE id = $1
      `,
      [intentRow.id, clubName, finalTeamName]
    );
    if (asRecovery) {
      await pool.query(
        `
          UPDATE registration_intents
          SET status = 'join_rejected', updated_at = NOW()
          WHERE user_id = $1 AND intent = 'join' AND status = 'join_rejected'
        `,
        [userId]
      );
    }
    await pool.query('COMMIT');
  } catch (error) {
    await pool.query('ROLLBACK');
    throw error;
  }

  return { ok: true, clubId, teamId, clubName, teamName: finalTeamName };
}

async function approveSystemAdminRegistration(pool, userId) {
  await ensureRegistrationIntentSchema(pool);
  const intentRes = await pool.query(
    `
      SELECT id, user_id AS "userId", intent, status,
             proposed_club_name AS "proposedClubName",
             proposed_team_name AS "proposedTeamName",
             target_club_id AS "targetClubId",
             target_team_id AS "targetTeamId"
      FROM registration_intents
      WHERE user_id = $1 AND status = 'pending_sa'
      ORDER BY created_at DESC
      LIMIT 1
    `,
    [userId]
  );
  const intent = intentRes.rows[0];
  if (!intent) {
    // Legacy pending users without intent: activate only.
    const updated = await pool.query(
      `
        UPDATE users
        SET approval_status = 'active', status = 'active', updated_at = NOW()
        WHERE id = $1
        RETURNING id
      `,
      [userId]
    );
    if (!updated.rows[0]) {
      return { ok: false, error: { status: 404, code: 'not_found', message: 'User not found.' } };
    }
    return { ok: true, mode: 'legacy' };
  }

  if (intent.intent === 'create') {
    const materialize = await materializeCreateOrg(pool, userId, intent);
    if (!materialize.ok) {
      return materialize;
    }
    await pool.query(
      `
        UPDATE users
        SET approval_status = 'active', status = 'active', updated_at = NOW()
        WHERE id = $1
      `,
      [userId]
    );
    return { ok: true, mode: 'create', ...materialize };
  }

  await pool.query('BEGIN');
  try {
    await pool.query(
      `
        UPDATE users
        SET approval_status = 'active', status = 'active', updated_at = NOW()
        WHERE id = $1
      `,
      [userId]
    );
    await pool.query(
      `
        UPDATE registration_intents
        SET status = 'pending_join', updated_at = NOW()
        WHERE id = $1
      `,
      [intent.id]
    );
    await pool.query('COMMIT');
  } catch (error) {
    await pool.query('ROLLBACK');
    throw error;
  }
  return { ok: true, mode: 'join', intent };
}

async function rejectSystemAdminRegistration(pool, userId) {
  await ensureRegistrationIntentSchema(pool);
  await pool.query('BEGIN');
  try {
    const updated = await pool.query(
      `
        UPDATE users
        SET approval_status = 'rejected', status = 'inactive', updated_at = NOW()
        WHERE id = $1
        RETURNING id
      `,
      [userId]
    );
    if (!updated.rows[0]) {
      await pool.query('ROLLBACK');
      return { ok: false, error: { status: 404, code: 'not_found', message: 'User not found.' } };
    }
    await pool.query(
      `
        UPDATE registration_intents
        SET status = 'sa_rejected', updated_at = NOW()
        WHERE user_id = $1 AND status = 'pending_sa'
      `,
      [userId]
    );
    await pool.query('COMMIT');
  } catch (error) {
    await pool.query('ROLLBACK');
    throw error;
  }
  return { ok: true };
}

async function getMembershipGate(pool, userId) {
  await ensureRegistrationIntentSchema(pool);
  const userRes = await pool.query(`SELECT role FROM users WHERE id = $1 LIMIT 1`, [userId]);
  if (userRes.rows[0] && userRes.rows[0].role === 'SystemAdmin') {
    const clubs = await pool.query(`SELECT club_id AS "clubId" FROM coach_clubs WHERE user_id = $1`, [userId]);
    return { ok: true, clubIds: clubs.rows.map((r) => r.clubId) };
  }
  const clubs = await pool.query(`SELECT club_id AS "clubId" FROM coach_clubs WHERE user_id = $1`, [userId]);
  if (clubs.rows.length > 0) {
    return { ok: true, clubIds: clubs.rows.map((r) => r.clubId) };
  }
  const pendingJoin = await pool.query(
    `
      SELECT id, status, target_club_id AS "targetClubId"
      FROM registration_intents
      WHERE user_id = $1 AND intent = 'join' AND status IN ('pending_join', 'join_rejected', 'pending_sa')
      ORDER BY created_at DESC
      LIMIT 1
    `,
    [userId]
  );
  const row = pendingJoin.rows[0];
  if (row && row.status === 'pending_join') {
    return {
      ok: false,
      code: 'pending_join',
      message: 'Your club join request is awaiting ClubAdmin approval.'
    };
  }
  if (row && row.status === 'join_rejected') {
    return {
      ok: false,
      code: 'join_rejected',
      message: 'Your join request was rejected. Create a club and team to continue.'
    };
  }
  if (row && row.status === 'pending_sa') {
    return {
      ok: false,
      code: 'pending_approval',
      message: 'Your account is awaiting SystemAdmin approval.'
    };
  }
  // Active user with create intent still pending SA should not reach here normally.
  return {
    ok: false,
    code: 'no_club',
    message: 'Create a club and team to continue.'
  };
}

async function listPendingJoinRequestsForActor(pool, actor) {
  await ensureRegistrationIntentSchema(pool);
  const isSystemAdmin = actor.role === 'SystemAdmin';
  const rows = await pool.query(
    `
      SELECT ri.id, ri.user_id AS "userId", ri.status,
             ri.target_club_id AS "targetClubId",
             ri.target_team_id AS "targetTeamId",
             ri.created_at AS "createdAt",
             u.name AS "userName", u.email AS "userEmail", u.role AS "userRole",
             c.name AS "clubName",
             t.name AS "teamName"
      FROM registration_intents ri
      JOIN users u ON u.id = ri.user_id
      LEFT JOIN clubs c ON c.id = ri.target_club_id
      LEFT JOIN teams t ON t.id = ri.target_team_id
      WHERE ri.intent = 'join'
        AND ri.status = 'pending_join'
        AND (
          $1::boolean = TRUE
          OR ri.target_club_id IN (SELECT club_id FROM coach_clubs WHERE user_id = $2)
        )
      ORDER BY ri.created_at ASC
    `,
    [isSystemAdmin, actor.id]
  );
  return rows.rows;
}

async function approveClubJoinRequest(pool, intentId, actor) {
  await ensureRegistrationIntentSchema(pool);
  const intentRes = await pool.query(
    `
      SELECT id, user_id AS "userId", intent, status,
             target_club_id AS "targetClubId",
             target_team_id AS "targetTeamId"
      FROM registration_intents
      WHERE id = $1
      LIMIT 1
    `,
    [intentId]
  );
  const intent = intentRes.rows[0];
  if (!intent || intent.intent !== 'join' || intent.status !== 'pending_join') {
    return { ok: false, error: { status: 404, code: 'not_found', message: 'Join request not found.' } };
  }
  if (actor.role !== 'SystemAdmin') {
    const membership = await pool.query(
      `SELECT 1 FROM coach_clubs WHERE user_id = $1 AND club_id = $2 LIMIT 1`,
      [actor.id, intent.targetClubId]
    );
    if (!membership.rows[0] || actor.role !== 'ClubAdmin') {
      return { ok: false, error: { status: 403, code: 'forbidden', message: 'You do not have permission to perform this action.' } };
    }
  }

  await pool.query('BEGIN');
  try {
    await pool.query(
      `INSERT INTO coach_clubs (user_id, club_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
      [intent.userId, intent.targetClubId]
    );
    if (intent.targetTeamId) {
      // Optional team: ensure team exists under club; do not steal lead unless empty — leave lead as-is.
      await pool.query(
        `SELECT id FROM teams WHERE id = $1 AND club_id = $2 LIMIT 1`,
        [intent.targetTeamId, intent.targetClubId]
      );
    }
    await pool.query(
      `UPDATE users SET role = 'Coach', updated_at = NOW() WHERE id = $1 AND role <> 'SystemAdmin'`,
      [intent.userId]
    );
    await pool.query(
      `UPDATE registration_intents SET status = 'completed', updated_at = NOW() WHERE id = $1`,
      [intent.id]
    );
    await pool.query('COMMIT');
  } catch (error) {
    await pool.query('ROLLBACK');
    throw error;
  }
  return { ok: true };
}

async function rejectClubJoinRequest(pool, intentId, actor) {
  await ensureRegistrationIntentSchema(pool);
  const intentRes = await pool.query(
    `
      SELECT id, user_id AS "userId", intent, status, target_club_id AS "targetClubId"
      FROM registration_intents
      WHERE id = $1
      LIMIT 1
    `,
    [intentId]
  );
  const intent = intentRes.rows[0];
  if (!intent || intent.intent !== 'join' || intent.status !== 'pending_join') {
    return { ok: false, error: { status: 404, code: 'not_found', message: 'Join request not found.' } };
  }
  if (actor.role !== 'SystemAdmin') {
    const membership = await pool.query(
      `SELECT 1 FROM coach_clubs WHERE user_id = $1 AND club_id = $2 LIMIT 1`,
      [actor.id, intent.targetClubId]
    );
    if (!membership.rows[0] || actor.role !== 'ClubAdmin') {
      return { ok: false, error: { status: 403, code: 'forbidden', message: 'You do not have permission to perform this action.' } };
    }
  }
  await pool.query(
    `UPDATE registration_intents SET status = 'join_rejected', updated_at = NOW() WHERE id = $1`,
    [intent.id]
  );
  return { ok: true };
}

async function createClubRecovery(pool, userId, options) {
  await ensureRegistrationIntentSchema(pool);
  const gate = await getMembershipGate(pool, userId);
  if (gate.ok) {
    return { ok: false, error: { status: 409, code: 'conflict', message: 'You already belong to a club.' } };
  }
  if (gate.code !== 'join_rejected' && gate.code !== 'no_club') {
    return { ok: false, error: { status: 403, code: 'forbidden', message: gate.message } };
  }

  const userRes = await pool.query(
    `
      SELECT u.id, u.name, st.code AS "tierCode"
      FROM users u
      LEFT JOIN subscription_tiers st ON st.id = u.subscription_tier_id
      WHERE u.id = $1
      LIMIT 1
    `,
    [userId]
  );
  const user = userRes.rows[0];
  if (!user) {
    return { ok: false, error: { status: 404, code: 'not_found', message: 'User not found.' } };
  }

  const clubName = normalizeLookup(options.clubName || options.teamName);
  const teamName = normalizeLookup(options.teamName || options.clubName);
  if (!clubName || clubName.length < 2 || !teamName || teamName.length < 2) {
    return { ok: false, error: { status: 400, code: 'validation_error', message: 'Enter a club name and a team name.' } };
  }

  if (await clubNameTaken(pool, clubName)) {
    return {
      ok: false,
      error: {
        status: 409,
        code: 'conflict',
        message: 'That club name is already taken. Choose a different name.'
      }
    };
  }

  const intentId = `ri_${Date.now().toString(36)}_${Math.floor(Math.random() * 1000)}`;
  await pool.query(
    `
      INSERT INTO registration_intents (
        id, user_id, intent, status,
        proposed_club_name, proposed_team_name
      )
      VALUES ($1, $2, 'create', 'pending_sa', $3, $4)
    `,
    [intentId, userId, clubName, teamName]
  );
  const intentRow = {
    id: intentId,
    proposedClubName: clubName,
    proposedTeamName: teamName
  };
  const materialize = await materializeCreateOrg(pool, userId, intentRow, { asRecovery: true });
  if (!materialize.ok) {
    return materialize;
  }
  await pool.query(
    `
      UPDATE users
      SET approval_status = 'active', status = 'active', role = 'ClubAdmin', updated_at = NOW()
      WHERE id = $1
    `,
    [userId]
  );
  return { ok: true, ...materialize };
}

async function createHandoffCode(pool, userId) {
  const code = crypto.randomBytes(24).toString('hex');
  await pool.query(
    `INSERT INTO auth_handoff_codes (code, user_id, expires_at) VALUES ($1, $2, NOW() + INTERVAL '5 minutes')`,
    [code, userId]
  );
  return code;
}

async function consumeHandoffCode(pool, code) {
  const raw = String(code || '').trim();
  if (!raw) {
    return null;
  }
  const result = await pool.query(
    `
      UPDATE auth_handoff_codes
      SET used_at = NOW()
      WHERE code = $1
        AND used_at IS NULL
        AND expires_at > NOW()
      RETURNING user_id AS "userId"
    `,
    [raw]
  );
  return result.rows[0] ? result.rows[0].userId : null;
}

module.exports = {
  ensureSubscriptionSchema,
  ensureRegistrationIntentSchema,
  createPendingRegistration,
  resolveTierByCode,
  createHandoffCode,
  consumeHandoffCode,
  normalizeLookup,
  roleForRegistrationIntent,
  clubNameTaken,
  approveSystemAdminRegistration,
  rejectSystemAdminRegistration,
  getMembershipGate,
  listPendingJoinRequestsForActor,
  approveClubJoinRequest,
  rejectClubJoinRequest,
  createClubRecovery,
  materializeCreateOrg,
  DEFAULT_TEAM_AGE_GROUP
};
