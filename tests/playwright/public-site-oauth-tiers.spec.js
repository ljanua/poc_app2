const { test, expect } = require('@playwright/test');
const { completeClubSelectIfNeeded } = require('./_fixture-utils');

const PUBLIC = 'http://127.0.0.1:5501';
const APP = 'http://127.0.0.1:5500';
const ADMIN_EMAIL = 'maria@vantageiq.club';

async function registerPending(request, { name, email, password, tierCode, intent, clubName, teamName, targetClubId, targetTeamId }) {
  const resolvedIntent = intent || 'create';
  const resolvedTeam = teamName || (resolvedIntent === 'create' ? `Team ${Date.now()}` : undefined);
  const resolvedClub = clubName || (tierCode === 'free' ? resolvedTeam : clubName);
  const res = await request.post(PUBLIC + '/api/v1/auth/register', {
    data: {
      name,
      email,
      password,
      tierCode,
      intent: resolvedIntent,
      clubName: resolvedClub,
      teamName: resolvedTeam,
      targetClubId,
      targetTeamId
    }
  });
  const body = await res.json();
  expect(res.status(), body.message || '').toBe(201);
  expect(body.pendingApproval).toBeTruthy();
  return body.user;
}

async function approveUser(request, userId) {
  const res = await request.post(APP + `/api/v1/admin/users/${userId}/approve`, {
    headers: { 'X-Actor-Email': ADMIN_EMAIL }
  });
  expect(res.ok()).toBeTruthy();
  return res.json();
}

test.describe('Public site OAuth & subscription tiers', () => {
  test('AE6: public port marketing vs app health', async ({ request }) => {
    const pub = await request.get(PUBLIC + '/api/v1/config');
    expect(pub.ok()).toBeTruthy();
    const pubBody = await pub.json();
    expect(pubBody.data.oauthStubMode).toBeTruthy();

    const app = await request.get(APP + '/api/v1/health');
    expect(app.ok()).toBeTruthy();

    const tiers = await request.get(PUBLIC + '/api/v1/subscription-tiers');
    const tierBody = await tiers.json();
    const codes = (tierBody.data || []).map((t) => t.code);
    expect(codes).toEqual(expect.arrayContaining(['free', 'professional', 'club_basic', 'club_premium']));
  });

  test('AE1: pending gate then approve then handoff to app', async ({ page, request }) => {
    const stamp = Date.now();
    const email = `pending.${stamp}@example.com`;
    const user = await registerPending(request, {
      name: `Pending User ${stamp}`,
      email,
      password: 'SecurePass123',
      tierCode: 'free'
    });

    const denied = await request.post(APP + '/api/v1/auth/login', {
      data: { email, password: 'SecurePass123' }
    });
    expect(denied.status()).toBe(403);
    const deniedBody = await denied.json();
    expect(deniedBody.code).toBe('pending_approval');

    await approveUser(request, user.id);

    await page.goto(PUBLIC + '/public-signin.html');
    await page.getByTestId('signin-email').fill(email);
    await page.getByTestId('signin-password').fill('SecurePass123');
    await page.getByTestId('signin-submit').click();
    await page.waitForURL(/auth-handoff|S1-player-list|S0a-club-select/, { timeout: 20000 });
    if (page.url().includes('auth-handoff')) {
      await page.waitForURL(/S1-player-list|S0a-club-select/, { timeout: 20000 });
    }
    await completeClubSelectIfNeeded(page);
    await expect(page).toHaveURL(/S1-player-list\.html|S1-player-list$|S0a-club-select/);
    // If still on club select after helper, accept that as approved access into the app surface
    if (/S0a-club-select/.test(page.url())) {
      await completeClubSelectIfNeeded(page);
    }
    await expect(page).toHaveURL(/S1-player-list\.html|S1-player-list$/);
  });

  test('AE2: stub OAuth creates pending user with selected tier', async ({ page, request }) => {
    const stamp = Date.now();
    await page.goto(PUBLIC + '/');
    await page.getByTestId('door-coach').click();
    await page.getByTestId('signup-tier').selectOption('professional');
    await page.getByTestId('signup-club-name').fill(`OAuth Club ${stamp}`);
    await page.getByTestId('signup-team-name').fill(`OAuth Team ${stamp}`);
    await page.getByTestId('signup-auth-method').selectOption('google');
    await page.getByTestId('signup-submit').click();
    await page.waitForURL(/oauth-stub/);
    await expect(page.getByTestId('oauth-stub-form')).toBeVisible();
    await page.getByTestId('oauth-name').fill(`OAuth Pro ${stamp}`);
    await page.getByTestId('oauth-email').fill(`oauth.pro.${stamp}@example.com`);
    await page.getByTestId('oauth-stub-submit').click();
    await page.waitForURL(/pending/);

    const pending = await request.get(APP + '/api/v1/admin/pending-users', {
      headers: { 'X-Actor-Email': ADMIN_EMAIL }
    });
    const pendingBody = await pending.json();
    const found = (pendingBody.data || []).find((u) => u.email === `oauth.pro.${stamp}@example.com`);
    expect(found).toBeTruthy();
    expect(found.tierCode).toBe('professional');
    expect(found.role).toBe('ClubAdmin');
    expect(found.regIntent).toBe('create');
  });

  test('AE3: free tier blocks second team after approval', async ({ page, request }) => {
    const stamp = Date.now();
    const email = `caps.${stamp}@example.com`;
    const user = await registerPending(request, {
      name: `Caps Admin ${stamp}`,
      email,
      password: 'SecurePass123',
      tierCode: 'free'
    });
    await approveUser(request, user.id);

    const login = await request.post(APP + '/api/v1/auth/login', {
      data: { email, password: 'SecurePass123' }
    });
    expect(login.ok()).toBeTruthy();
    const loginBody = await login.json();
    const clubId = (loginBody.user && loginBody.user.clubIds && loginBody.user.clubIds[0]) || null;

    // Resolve club id from memberships if not on login payload
    let resolvedClubId = clubId;
    if (!resolvedClubId) {
      const clubsRes = await request.get(APP + `/api/v1/users/${encodeURIComponent(user.id)}/clubs`);
      if (clubsRes.ok()) {
        const clubsBody = await clubsRes.json();
        const rows = clubsBody.data || clubsBody.clubs || [];
        if (rows[0]) {
          resolvedClubId = rows[0].clubId || rows[0].id;
        }
      }
    }
    if (!resolvedClubId) {
      // Fallback: list clubs via coach memberships query used by app
      const meClubs = await request.get(APP + `/api/v1/clubs?actorEmail=${encodeURIComponent(email)}`);
      if (meClubs.ok()) {
        const body = await meClubs.json();
        const rows = body.data || [];
        if (rows[0]) resolvedClubId = rows[0].id;
      }
    }
    expect(resolvedClubId).toBeTruthy();

    await page.goto(APP + '/S1-player-list.html');
    await page.evaluate(({ actorEmail, clubId: cid }) => {
      window.localStorage.setItem('vantageiq_current_user_email', actorEmail);
      window.localStorage.setItem('vantageiq_active_club_id', JSON.stringify({ id: cid, name: 'Test Club' }));
      // also common key variants
      try {
        window.localStorage.setItem('vantageiq_active_club', JSON.stringify({ id: cid, name: 'Test Club' }));
      } catch (_e) {}
    }, { actorEmail: email, clubId: resolvedClubId });

    await page.reload();
    await completeClubSelectIfNeeded(page);

    const result = await page.evaluate(async ({ actorEmail, clubId: cid }) => {
      const second = window.MockupApi.createTeam(
        {
          name: `Free Team B ${Date.now()}`,
          ageGroup: 'U16',
          coachEmail: actorEmail,
          sportId: 'sport_soccer',
          clubId: cid
        },
        'ClubAdmin',
        actorEmail
      );
      return {
        secondStatus: second.status,
        secondCode: second.code,
        secondMessage: second.message
      };
    }, { actorEmail: email, clubId: resolvedClubId });

    // Signup materialization already created the Free tier's single team seat.
    expect(result.secondStatus).toBeGreaterThanOrEqual(400);
    expect(String(result.secondMessage || '')).toMatch(/Free Tier|1 team|plan allows/i);
  });

  test('AE5: SystemAdmin can edit tier quotas', async ({ request }) => {
    const list = await request.get(APP + '/api/v1/admin/subscription-tiers', {
      headers: { 'X-Actor-Email': ADMIN_EMAIL }
    });
    expect(list.ok()).toBeTruthy();
    const tiers = (await list.json()).data || [];
    const basic = tiers.find((t) => t.code === 'club_basic');
    expect(basic).toBeTruthy();

    const updatedMax = Number(basic.maxTeams) === 5 ? 6 : 5;
    const save = await request.put(APP + `/api/v1/admin/subscription-tiers/${basic.id}`, {
      headers: { 'X-Actor-Email': ADMIN_EMAIL },
      data: {
        maxTeams: updatedMax,
        maxCoaches: basic.maxCoaches,
        maxClubAdmins: basic.maxClubAdmins,
        videosPerDay: basic.videosPerDay,
        maxVideosPerTeam: basic.maxVideosPerTeam
      }
    });
    expect(save.ok()).toBeTruthy();
    const saved = (await save.json()).data;
    expect(saved.maxTeams).toBe(updatedMax);

    // restore
    await request.put(APP + `/api/v1/admin/subscription-tiers/${basic.id}`, {
      headers: { 'X-Actor-Email': ADMIN_EMAIL },
      data: {
        maxTeams: 5,
        maxCoaches: basic.maxCoaches,
        maxClubAdmins: basic.maxClubAdmins,
        videosPerDay: basic.videosPerDay,
        maxVideosPerTeam: basic.maxVideosPerTeam
      }
    });
  });

  test('AE4: public admin APIs are gone; landing has no SystemAdmin entry', async ({ page, request }) => {
    await page.goto(PUBLIC + '/');
    await expect(page.getByTestId('admin-link')).toHaveCount(0);
    await page.getByTestId('door-coach').click();
    await expect(page.getByTestId('sign-in-link')).toBeVisible();
    await expect(page.getByTestId('admin-link')).toHaveCount(0);

    const gone = await request.get(PUBLIC + '/api/v1/admin/pending-users', {
      headers: { 'X-Actor-Email': ADMIN_EMAIL }
    });
    expect(gone.status()).toBe(410);
  });

  test('SystemAdmin reactivate also clears pending approval_status', async ({ request }) => {
    const stamp = Date.now();
    const email = `reactivate.${stamp}@example.com`;
    const user = await registerPending(request, {
      name: `Reactivate User ${stamp}`,
      email,
      password: 'SecurePass123',
      tierCode: 'free'
    });

    await approveUser(request, user.id);

    const deactivated = await request.post(APP + `/api/v1/users/${encodeURIComponent(email)}/deactivate`, {
      data: { actorEmail: ADMIN_EMAIL, actorRole: 'SystemAdmin' }
    });
    expect(deactivated.ok()).toBeTruthy();

    const reactivated = await request.post(APP + `/api/v1/users/${encodeURIComponent(email)}/reactivate`, {
      data: { actorEmail: ADMIN_EMAIL, actorRole: 'SystemAdmin' }
    });
    expect(reactivated.ok()).toBeTruthy();
    const body = await reactivated.json();
    expect(body.data.status).toBe('active');
    expect(body.data.approvalStatus).toBe('active');

    const login = await request.post(APP + '/api/v1/auth/login', {
      data: { email, password: 'SecurePass123' }
    });
    expect(login.ok()).toBeTruthy();
    expect(user.id).toBeTruthy();
  });
});
