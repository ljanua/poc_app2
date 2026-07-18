const { test, expect } = require('@playwright/test');

async function loginLocal(page, email, password) {
  await page.addInitScript(() => {
    window.__USE_MOCK_LOCAL__ = true;
    window.__USE_BACKEND__ = false;
  });
  await page.goto('/S0-login.html');
  await page.evaluate(() => {
    window.localStorage.removeItem('vantageiq_mockup_v2');
    window.localStorage.removeItem('vantageiq_current_user_email');
    window.localStorage.removeItem('vantageiq_active_club_id');
  });
  await page.fill('#email', email);
  await page.fill('#password', password);
  await page.locator('#loginForm button[type="submit"]').click();
}

async function seedSecondClubForRita(page) {
  await page.evaluate(() => {
    const key = 'vantageiq_mockup_v2';
    const store = JSON.parse(window.localStorage.getItem(key) || '{}');
    if (!Array.isArray(store.clubs)) store.clubs = [];
    if (!store.clubs.some((club) => club.id === 'c_second')) {
      store.clubs.push({
        id: 'c_second',
        name: 'Second Club',
        status: 'active',
        defaultSportId: 'sport_soccer'
      });
    }
    if (!Array.isArray(store.coachClubs)) store.coachClubs = [];
    if (!store.coachClubs.some((entry) => entry.userId === 'u_clubadmin_rita' && entry.clubId === 'c_second')) {
      store.coachClubs.push({ userId: 'u_clubadmin_rita', clubId: 'c_second' });
    }
    if (!Array.isArray(store.teams)) store.teams = [];
    if (!store.teams.some((team) => team.id === 't_second')) {
      store.teams.push({
        id: 't_second',
        name: 'Second Club U17',
        ageGroup: 'U17',
        leadCoach: 'Rita Admin',
        leadCoachEmail: 'rita@vantageiq.club',
        clubId: 'c_second',
        sportId: 'sport_soccer',
        status: 'active'
      });
    }
    window.localStorage.setItem(key, JSON.stringify(store));
  });
}

test.describe('Active club session', () => {
  test('single-club coach auto-binds and shows club name in header', async ({ page }) => {
    await loginLocal(page, 'joao@vantageiq.club', 'SecurePass123');
    await expect(page).toHaveURL(/S1-player-list/);
    await expect(page.getByTestId('active-club-name')).toBeVisible();
    await expect(page.getByTestId('active-club-name')).not.toHaveText('');
    await expect(page.getByTestId('change-club')).toBeHidden();

    const clubId = await page.evaluate(() => {
      const raw = window.localStorage.getItem('vantageiq_active_club_id');
      return raw ? JSON.parse(raw).id : null;
    });
    expect(clubId).toBeTruthy();

    const teamsQuery = await page.evaluate(() => {
      const original = window.XMLHttpRequest;
      // Probe listTeams param injection via MockupApi offline path
      const teams = window.MockupApi.listTeams();
      return {
        clubId: JSON.parse(window.localStorage.getItem('vantageiq_active_club_id') || '{}').id,
        teamClubIds: (teams || []).map((t) => t.clubId)
      };
    });
    expect(teamsQuery.teamClubIds.every((id) => id === teamsQuery.clubId)).toBe(true);
  });

  test('multi-club user must pick before reaching S1', async ({ page }) => {
    await loginLocal(page, 'rita@vantageiq.club', 'SecurePass123');
    await expect(page).toHaveURL(/S1-player-list/);
    await seedSecondClubForRita(page);
    await page.evaluate(() => {
      window.localStorage.removeItem('vantageiq_active_club_id');
    });
    await page.goto('/S1-player-list.html');
    await expect(page).toHaveURL(/S0a-club-select/);
    await expect(page.getByTestId('club-select')).toBeVisible();
    await page.selectOption('[data-testid="club-select"]', 'c_default');
    await page.getByTestId('club-select-submit').click();
    await expect(page).toHaveURL(/S1-player-list/);
    await expect(page.getByTestId('active-club-name')).toContainText(/VantageIQ|Club/i);
  });

  test('deep-link without active club redirects to picker for multi-club', async ({ page }) => {
    await page.addInitScript(() => {
      window.__USE_MOCK_LOCAL__ = true;
      window.__USE_BACKEND__ = false;
    });
    await page.goto('/S0-login.html');
    await page.evaluate(() => {
      window.localStorage.removeItem('vantageiq_mockup_v2');
      window.localStorage.removeItem('vantageiq_active_club_id');
    });
    await page.fill('#email', 'rita@vantageiq.club');
    await page.fill('#password', 'SecurePass123');
    await page.locator('#loginForm button[type="submit"]').click();
    await expect(page).toHaveURL(/S1-player-list/);
    await seedSecondClubForRita(page);
    await page.evaluate(() => window.localStorage.removeItem('vantageiq_active_club_id'));
    await page.goto('/S1-player-list.html');
    await expect(page).toHaveURL(/S0a-club-select/);
  });

  test('setActiveClub rejects ineligible club client-side', async ({ page }) => {
    await loginLocal(page, 'rita@vantageiq.club', 'SecurePass123');
    await expect(page).toHaveURL(/S1-player-list/);
    const result = await page.evaluate(() => {
      return window.MockupApi.setActiveClub({ id: 'c_foreign', name: 'Foreign' });
    });
    expect(result.ok).toBe(false);
    expect(result.code).toBe('forbidden_scope');
  });

  test('logout clears active club', async ({ page }) => {
    await loginLocal(page, 'joao@vantageiq.club', 'SecurePass123');
    await expect(page.getByTestId('active-club-name')).toBeVisible();
    await page.getByTestId('exit-button').click();
    await expect(page).toHaveURL(/S0-login/);
    const cleared = await page.evaluate(() => ({
      email: window.localStorage.getItem('vantageiq_current_user_email'),
      club: window.localStorage.getItem('vantageiq_active_club_id')
    }));
    expect(cleared.email).toBeFalsy();
    expect(cleared.club).toBeFalsy();
  });

  test('switch club updates header and isolates teams', async ({ page }) => {
    await loginLocal(page, 'rita@vantageiq.club', 'SecurePass123');
    await seedSecondClubForRita(page);
    await page.evaluate(() => {
      window.localStorage.removeItem('vantageiq_active_club_id');
    });
    await page.goto('/S1-player-list.html');
    await page.selectOption('[data-testid="club-select"]', 'c_default');
    await page.getByTestId('club-select-submit').click();
    await expect(page.getByTestId('active-club-name')).toBeVisible();
    await expect(page.getByTestId('change-club')).toBeVisible();
    await page.getByTestId('change-club').click();
    await expect(page).toHaveURL(/S0a-club-select/);
    await page.selectOption('[data-testid="club-select"]', 'c_second');
    await page.getByTestId('club-select-submit').click();
    await expect(page.getByTestId('active-club-name')).toContainText('Second Club');
    const teamNames = await page.locator('#teamFilter option').allTextContents();
    expect(teamNames.join(' ')).toMatch(/Second Club U17/);
    expect(teamNames.join(' ')).not.toMatch(/Senior Squad/);
  });
});
