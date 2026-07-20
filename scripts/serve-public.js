'use strict';

const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { URL } = require('node:url');
const { Pool } = require('pg');
const { ensureSubscriptionSchema, createPendingRegistration, createHandoffCode, resolveTierByCode, getMembershipGate } = require('./auth/registration');
const { verifyPassword } = require('./auth/passwords');
const { issueAccessToken } = require('./auth/jwt');
const { getTierForUser } = require('./tiers/quota');

require('dotenv').config({ path: path.join(process.cwd(), '.env') });

const host = process.env.PUBLIC_HOST || '0.0.0.0';
const port = Number(process.env.PUBLIC_PORT || 5501);
const appOrigin = (process.env.APP_ORIGIN || 'http://127.0.0.1:5500').replace(/\/$/, '');
const publicOrigin = (process.env.PUBLIC_ORIGIN || `http://127.0.0.1:${port}`).replace(/\/$/, '');
const root = path.join(process.cwd(), 'docs', 'ux', 'mockup');
const dataImgRoot = path.join(process.cwd(), 'data', 'img');
const apiPrefix = '/api/v1';
const databaseUrl = process.env.DATABASE_URL || '';
const oauthStubMode = String(process.env.OAUTH_STUB_MODE || 'true').toLowerCase() !== 'false';

const pool = databaseUrl
  ? new Pool({ connectionString: databaseUrl })
  : null;

const mimeTypes = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon'
};

function send(res, status, body, contentType) {
  res.writeHead(status, { 'Content-Type': contentType || 'text/plain; charset=utf-8' });
  res.end(body);
}

function sendJson(res, status, payload) {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Actor-Email'
  });
  res.end(JSON.stringify(payload));
}

function appError(status, code, message) {
  return { status, code, message };
}

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (chunk) => chunks.push(chunk));
    req.on('end', () => {
      if (!chunks.length) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')));
      } catch (error) {
        reject(error);
      }
    });
    req.on('error', reject);
  });
}

function toPublicUser(row) {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    role: row.role,
    status: row.status,
    approvalStatus: row.approvalStatus || row.approval_status,
    subscriptionTierId: row.subscriptionTierId || row.subscription_tier_id || null,
    tierCode: row.tierCode || null,
    tierDisplayName: row.tierDisplayName || null,
    clubIds: Array.isArray(row.clubIds) ? row.clubIds : [],
    lastLogin: row.lastLogin || row.last_login_label || null
  };
}

async function loadUserByEmail(email) {
  const result = await pool.query(
    `
      SELECT u.id, u.name, u.email, u.role, u.status,
             u.approval_status AS "approvalStatus",
             u.subscription_tier_id AS "subscriptionTierId",
             u.password_hash AS "passwordHash",
             u.last_login_label AS "lastLogin",
             st.code AS "tierCode",
             st.display_name AS "tierDisplayName"
      FROM users u
      LEFT JOIN subscription_tiers st ON st.id = u.subscription_tier_id
      WHERE LOWER(u.email) = LOWER($1)
      LIMIT 1
    `,
    [email]
  );
  return result.rows[0] || null;
}

function resolveTarget(urlPath) {
  if (urlPath === '/' || urlPath === '' || urlPath === '/index.html') {
    return path.join(root, 'public-home.html');
  }
  if (urlPath === '/admin' || urlPath === '/admin/') {
    return path.join(root, 'public-admin.html');
  }
  if (urlPath === '/pending' || urlPath === '/pending/') {
    return path.join(root, 'public-pending.html');
  }

  const cleanPath = decodeURIComponent(urlPath.split('?')[0]);
  const normalized = cleanPath.replace(/^\/+/, '');

  if (normalized === 'data/img' || normalized.startsWith('data/img/')) {
    const underImg = normalized.slice('data/img'.length).replace(/^\/+/, '');
    return path.join(dataImgRoot, underImg);
  }

  if (!path.extname(normalized)) {
    const htmlCandidate = path.join(root, `${normalized}.html`);
    if (fs.existsSync(htmlCandidate) && fs.statSync(htmlCandidate).isFile()) {
      return htmlCandidate;
    }
  }

  const filePath = path.join(root, normalized);
  if (fs.existsSync(filePath) && fs.statSync(filePath).isDirectory()) {
    return path.join(filePath, 'index.html');
  }
  return filePath;
}

function isAllowedStaticTarget(target) {
  const resolved = path.resolve(target);
  const allowedRoots = [path.resolve(root), path.resolve(dataImgRoot)];
  return allowedRoots.some((base) => resolved === base || resolved.startsWith(base + path.sep));
}

async function handleApi(req, res, requestUrl) {
  if (req.method === 'OPTIONS') {
    sendJson(res, 204, {});
    return;
  }

  if (!pool) {
    sendJson(res, 503, appError(503, 'service_unavailable', 'DATABASE_URL is required for the public site.'));
    return;
  }

  if (req.method === 'GET' && requestUrl.pathname === `${apiPrefix}/config`) {
    sendJson(res, 200, {
      data: {
        publicOrigin,
        appOrigin,
        oauthStubMode,
        oauthProviders: ['google', 'apple', 'facebook', 'password']
      }
    });
    return;
  }

  if (req.method === 'GET' && requestUrl.pathname === `${apiPrefix}/subscription-tiers`) {
    const rows = await pool.query(
      `
        SELECT id, code, display_name AS "displayName",
               max_teams AS "maxTeams", max_coaches AS "maxCoaches",
               max_club_admins AS "maxClubAdmins", videos_per_day AS "videosPerDay",
               max_videos_per_team AS "maxVideosPerTeam", active, sort_order AS "sortOrder"
        FROM subscription_tiers
        WHERE active = TRUE
        ORDER BY sort_order ASC, code ASC
      `
    );
    sendJson(res, 200, { data: rows.rows });
    return;
  }

  if (req.method === 'GET' && requestUrl.pathname === `${apiPrefix}/clubs/search`) {
    const q = String(requestUrl.searchParams.get('q') || '').trim();
    if (q.length < 2) {
      sendJson(res, 200, { data: [] });
      return;
    }
    const rows = await pool.query(
      `
        SELECT id, name
        FROM clubs
        WHERE status = 'active' AND name ILIKE $1
        ORDER BY name ASC
        LIMIT 20
      `,
      [`%${q.replace(/[%_]/g, '')}%`]
    );
    sendJson(res, 200, { data: rows.rows });
    return;
  }

  if (req.method === 'GET' && requestUrl.pathname.match(new RegExp(`^${apiPrefix}/clubs/[^/]+/teams$`))) {
    const clubId = requestUrl.pathname.split('/').slice(-2)[0];
    const rows = await pool.query(
      `
        SELECT id, name, age_group AS "ageGroup"
        FROM teams
        WHERE club_id = $1 AND status = 'active'
        ORDER BY name ASC
        LIMIT 50
      `,
      [clubId]
    );
    sendJson(res, 200, { data: rows.rows });
    return;
  }

  if (req.method === 'POST' && requestUrl.pathname === `${apiPrefix}/auth/register`) {
    const payload = await readJsonBody(req);
    try {
      const result = await createPendingRegistration(pool, {
        name: payload.name,
        email: payload.email,
        password: payload.password,
        tierCode: payload.tierCode || payload.tier || 'free',
        intent: payload.intent,
        clubName: payload.clubName,
        teamName: payload.teamName,
        targetClubId: payload.targetClubId,
        targetTeamId: payload.targetTeamId
      });
      if (!result.ok) {
        sendJson(res, result.error.status, result.error);
        return;
      }
      sendJson(res, 201, {
        status: 201,
        pendingApproval: true,
        message: 'Your account is awaiting SystemAdmin approval.',
        user: toPublicUser(result.user),
        intent: result.intent || null,
        pendingUrl: `${publicOrigin}/pending`
      });
    } catch (error) {
      console.error('public auth.register failed', error);
      sendJson(res, 500, appError(500, 'unknown', 'Could not create your account. Please try again.'));
    }
    return;
  }

  if (req.method === 'POST' && requestUrl.pathname === `${apiPrefix}/auth/login`) {
    const payload = await readJsonBody(req);
    const email = String(payload.email || '').trim().toLowerCase();
    const password = String(payload.password || '').trim();
    const user = await loadUserByEmail(email);
    if (!user || !(await verifyPassword(password, user.passwordHash))) {
      sendJson(res, 403, appError(403, 'forbidden', 'You do not have permission to perform this action.'));
      return;
    }
    if (user.approvalStatus === 'pending') {
      sendJson(res, 403, {
        status: 403,
        code: 'pending_approval',
        message: 'Your account is awaiting SystemAdmin approval.',
        pendingUrl: `${publicOrigin}/pending`
      });
      return;
    }
    if (user.approvalStatus === 'rejected' || user.status !== 'active') {
      sendJson(res, 403, appError(403, 'forbidden', 'Your account is not active. Contact support.'));
      return;
    }

    const membership = await getMembershipGate(pool, user.id);
    if (!membership.ok) {
      sendJson(res, 403, {
        status: 403,
        code: membership.code,
        message: membership.message,
        recoveryUrl: membership.code === 'join_rejected' || membership.code === 'no_club'
          ? `${publicOrigin}/public-pending.html?recover=1`
          : `${publicOrigin}/pending`
      });
      return;
    }

    await pool.query(`UPDATE users SET last_login_label = $1, updated_at = NOW() WHERE id = $2`, ['Just now', user.id]);
    const tier = await getTierForUser(pool, user.id);
    user.clubIds = membership.clubIds || [];
    const token = issueAccessToken(user, tier);
    const code = await createHandoffCode(pool, user.id);
    sendJson(res, 200, {
      token,
      role: user.role,
      user: toPublicUser(user),
      handoffCode: code,
      appHandoffUrl: `${appOrigin}/auth-handoff.html?code=${encodeURIComponent(code)}`
    });
    return;
  }

  if (req.method === 'POST' && requestUrl.pathname === `${apiPrefix}/auth/oauth/start`) {
    const payload = await readJsonBody(req);
    const provider = String(payload.provider || '').trim().toLowerCase();
    const tierCode = String(payload.tierCode || payload.tier || 'free').trim().toLowerCase() || 'free';
    const mode = String(payload.mode || 'register').trim().toLowerCase();
    if (!['google', 'apple', 'facebook'].includes(provider)) {
      sendJson(res, 400, appError(400, 'validation_error', 'Choose Google, Apple, or Facebook.'));
      return;
    }
    if (!oauthStubMode && !process.env[`${provider.toUpperCase()}_CLIENT_ID`]) {
      sendJson(res, 503, appError(503, 'oauth_unconfigured', `${provider} OAuth is not configured. Enable OAUTH_STUB_MODE or set client credentials.`));
      return;
    }
    // Stub: immediate redirect URL back into public OAuth complete page.
    const state = Buffer.from(JSON.stringify({ provider, tierCode, mode, t: Date.now() })).toString('base64url');
    sendJson(res, 200, {
      data: {
        authorizeUrl: `${publicOrigin}/oauth-stub.html?provider=${encodeURIComponent(provider)}&tier=${encodeURIComponent(tierCode)}&mode=${encodeURIComponent(mode)}&state=${encodeURIComponent(state)}`,
        stub: true
      }
    });
    return;
  }

  if (req.method === 'POST' && requestUrl.pathname === `${apiPrefix}/auth/oauth/complete`) {
    const payload = await readJsonBody(req);
    const provider = String(payload.provider || '').trim().toLowerCase();
    const tierCode = String(payload.tierCode || payload.tier || 'free').trim().toLowerCase() || 'free';
    const mode = String(payload.mode || 'register').trim().toLowerCase();
    const stubEmail = String(payload.email || '').trim().toLowerCase();
    const stubName = String(payload.name || '').trim();
    const providerUserId = String(payload.providerUserId || `${provider}_stub_${stubEmail || Date.now()}`);

    if (!['google', 'apple', 'facebook'].includes(provider)) {
      sendJson(res, 400, appError(400, 'validation_error', 'Invalid OAuth provider.'));
      return;
    }

    const identity = await pool.query(
      `SELECT user_id AS "userId" FROM user_oauth_identities WHERE provider = $1 AND provider_user_id = $2 LIMIT 1`,
      [provider, providerUserId]
    );

    if (identity.rows[0]) {
      const user = await pool.query(
        `
          SELECT u.id, u.name, u.email, u.role, u.status,
                 u.approval_status AS "approvalStatus",
                 u.subscription_tier_id AS "subscriptionTierId",
                 st.code AS "tierCode", st.display_name AS "tierDisplayName"
          FROM users u
          LEFT JOIN subscription_tiers st ON st.id = u.subscription_tier_id
          WHERE u.id = $1 LIMIT 1
        `,
        [identity.rows[0].userId]
      );
      const row = user.rows[0];
      if (!row) {
        sendJson(res, 404, appError(404, 'not_found', 'Linked user was not found.'));
        return;
      }
      if (row.approvalStatus !== 'active' || row.status !== 'active') {
        sendJson(res, 403, {
          status: 403,
          code: row.approvalStatus === 'pending' ? 'pending_approval' : 'forbidden',
          message: row.approvalStatus === 'pending'
            ? 'Your account is awaiting SystemAdmin approval.'
            : 'Your account is not active.',
          pendingUrl: `${publicOrigin}/pending`,
          user: toPublicUser(row)
        });
        return;
      }
      const tier = await getTierForUser(pool, row.id);
      const token = issueAccessToken(row, tier);
      const code = await createHandoffCode(pool, row.id);
      sendJson(res, 200, {
        token,
        role: row.role,
        user: toPublicUser(row),
        handoffCode: code,
        appHandoffUrl: `${appOrigin}/auth-handoff.html?code=${encodeURIComponent(code)}`
      });
      return;
    }

    if (mode === 'login') {
      sendJson(res, 404, appError(404, 'not_found', 'No account is linked to this OAuth identity. Register first.'));
      return;
    }

    const email = stubEmail || `${provider}.user.${Date.now()}@example.com`;
    const name = stubName || `${provider} User`;
    try {
      const result = await createPendingRegistration(pool, {
        name,
        email,
        password: null,
        tierCode,
        intent: payload.intent,
        clubName: payload.clubName,
        teamName: payload.teamName,
        targetClubId: payload.targetClubId,
        targetTeamId: payload.targetTeamId,
        oauth: { provider, providerUserId }
      });
      if (!result.ok) {
        sendJson(res, result.error.status, result.error);
        return;
      }
      sendJson(res, 201, {
        status: 201,
        pendingApproval: true,
        message: 'Your account is awaiting SystemAdmin approval.',
        user: toPublicUser(result.user),
        pendingUrl: `${publicOrigin}/pending`
      });
    } catch (error) {
      console.error('public oauth.complete failed', error);
      sendJson(res, 500, appError(500, 'unknown', 'Could not complete OAuth signup.'));
    }
    return;
  }

  if (
    requestUrl.pathname === `${apiPrefix}/admin/pending-users` ||
    requestUrl.pathname === `${apiPrefix}/admin/subscription-tiers` ||
    /^\/api\/v1\/admin\/users\/[^/]+\/(approve|reject)$/.test(requestUrl.pathname) ||
    /^\/api\/v1\/admin\/subscription-tiers\/[^/]+$/.test(requestUrl.pathname)
  ) {
    sendJson(res, 410, appError(
      410,
      'gone',
      'Approvals and tier admin moved to the POC App (S7). Use /api/v1/admin/* on the app origin.'
    ));
    return;
  }

  // unused but keep resolveTierByCode import meaningful for future
  void resolveTierByCode;

  sendJson(res, 404, appError(404, 'not_found', 'Not Found'));
}

if (!fs.existsSync(root)) {
  console.error(`Public site root missing: ${root}`);
  process.exit(1);
}

const server = http.createServer(async (req, res) => {
  try {
    const requestUrl = new URL(req.url || '/', `http://${host}:${port}`);
    if (requestUrl.pathname.startsWith(apiPrefix)) {
      await handleApi(req, res, requestUrl);
      return;
    }
    const target = resolveTarget(requestUrl.pathname || '/');
    if (!isAllowedStaticTarget(target)) {
      send(res, 403, 'Forbidden');
      return;
    }
    fs.readFile(target, (err, data) => {
      if (err) {
        send(res, 404, 'Not Found');
        return;
      }
      const ext = path.extname(target).toLowerCase();
      send(res, 200, data, mimeTypes[ext] || 'application/octet-stream');
    });
  } catch (error) {
    console.error('Public site server error:', error);
    if (!res.headersSent) {
      sendJson(res, 500, appError(500, 'unknown', 'Internal server error'));
    }
  }
});

async function start() {
  if (pool) {
    await ensureSubscriptionSchema(pool);
  }
  server.listen(port, host, () => {
    console.log(`Public site listening on http://${host === '0.0.0.0' ? '127.0.0.1' : host}:${port}`);
    console.log(`App origin: ${appOrigin}`);
  });
}

start().catch((error) => {
  console.error('Failed to start public site:', error);
  process.exit(1);
});
