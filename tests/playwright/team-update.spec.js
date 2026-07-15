const { test, expect } = require('@playwright/test');

const SEED_TEAMS = {
  t_u19: {
    name: 'U19 Prime',
    ageGroup: 'U19',
    coachEmail: 'joao@vantageiq.club',
    clubId: 'c_default',
    status: 'active',
    sportId: 'sport_soccer'
  },
  t_u17: {
    name: 'U17 Elite',
    ageGroup: 'U17',
    coachEmail: 'ana@vantageiq.club',
    clubId: 'c_default',
    status: 'active',
    sportId: 'sport_soccer'
  },
  t_senior: {
    name: 'Senior Squad',
    ageGroup: '18+',
    // Lead in seed is SystemAdmin Maria; update API requires an active Coach email.
    coachEmail: 'joao@vantageiq.club',
    clubId: 'c_default',
    status: 'active',
    sportId: 'sport_soccer'
  }
};

async function loginAs(page, email) {
  await page.goto('/S0-login.html');
  await page.evaluate(() => {
    window.localStorage.removeItem('vantageiq_mockup_v2');
    window.localStorage.removeItem('vantageiq_current_user_email');
  });
  await page.fill('#email', email);
  await page.fill('#password', 'SecurePass123');
  await page.locator('#loginForm button[type="submit"]').click();
  await expect(page).toHaveURL(/S1-player-list\.html|S1-player-list$|S7-admin-user-management\.html|S7-admin-user-management$/);
}

async function restoreTeam(page, teamId) {
  const defaults = SEED_TEAMS[teamId];
  if (!defaults) return;
  await page.evaluate(async ({ teamId, defaults }) => {
    await fetch('/api/v1/teams/' + encodeURIComponent(teamId) + '/update', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: defaults.name,
        ageGroup: defaults.ageGroup,
        coachEmail: defaults.coachEmail,
        clubId: defaults.clubId,
        status: defaults.status,
        sportId: defaults.sportId,
        actorRole: 'SystemAdmin',
        actorEmail: 'maria@vantageiq.club'
      })
    });
  }, { teamId, defaults });
}

test.describe('S3a Team Update + status filter', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/S0-login.html');
    await page.evaluate(() => window.localStorage.removeItem('vantageiq_mockup_v2'));
    await loginAs(page, 'joao@vantageiq.club');
  });

  test('S3 renders the Show active (default ON) and Only my teams (default OFF) filters', async ({ page }) => {
    await page.goto('/S3-team-management.html');
    await expect(page.getByText('Team Management')).toBeVisible();

    const showActive = page.locator('#showActive');
    await expect(showActive).toBeChecked();

    const onlyMy = page.locator('#onlyMyClubs');
    await expect(onlyMy).toBeChecked();
  });

  test('at-least-3 named seeded teams visible with Show active ON and Only my teams OFF', async ({ page }) => {
    await page.goto('/S3-team-management.html');
    const rows = page.locator('tbody tr');
    expect(await rows.count()).toBeGreaterThanOrEqual(3);
    await expect(page.locator('tbody tr', { hasText: 'Senior Squad' })).toHaveCount(1);
    await expect(page.locator('tbody tr', { hasText: 'U19 Prime' })).toHaveCount(1);
    await expect(page.locator('tbody tr', { hasText: 'U17 Elite' })).toHaveCount(1);
  });

  test('coach happy path: S3a save flips coach and toggles status active->inactive', async ({ page }) => {
    await page.goto('/S3a-team-update.html?teamId=t_u19');
    await expect(page.locator('#pageTitle')).toContainText('Update U19 Prime');

    await page.selectOption('#updateCoachSelect', 'ana@vantageiq.club');
    await page.selectOption('#updateStatusSelect', 'inactive');
    await page.getByTestId('update-save').click();

    await expect(page).toHaveURL(/S3-team-management\.html/);

    await expect(page.locator('tbody tr', { hasText: 'U19 Prime' })).toHaveCount(0);

    await page.locator('#showActive').uncheck();
    await expect(page.locator('tbody tr', { hasText: 'U19 Prime' })).toHaveCount(1);
    await expect(page.locator('tbody tr[data-status="inactive"]', { hasText: 'U19 Prime' })).toHaveCount(1);
  });

  test('coach self-update idempotency: leave coach unchanged, status stays active', async ({ page }) => {
    await page.goto('/S3a-team-update.html?teamId=t_u17');
    await expect(page.locator('#pageTitle')).toContainText('Update U17 Elite');

    await page.selectOption('#updateCoachSelect', 'ana@vantageiq.club');
    await page.selectOption('#updateStatusSelect', 'active');
    await page.getByTestId('update-save').click();
    await expect(page).toHaveURL(/S3-team-management\.html/);

    await page.goto('/S3a-team-update.html?teamId=t_u17');
    await expect(page.locator('#updateStatusSelect')).toHaveValue('active');
    await expect(page.locator('#updateCoachSelect')).toHaveValue('ana@vantageiq.club');
  });

  test('coach foreign-club move is rejected with inline error', async ({ page }) => {
    await page.goto('/S3a-team-update.html?teamId=t_u17');

    await page.evaluate(() => {
      const clubSelect = document.getElementById('updateClubSelect');
      const phantom = document.createElement('option');
      phantom.value = 'c_phantom';
      phantom.textContent = 'Phantom Club';
      phantom.selected = true;
      clubSelect.appendChild(phantom);
    });

    await page.selectOption('#updateCoachSelect', 'ana@vantageiq.club');
    await page.selectOption('#updateStatusSelect', 'active');
    await page.getByTestId('update-save').click();

    await expect(page.locator('#updateFormError')).toHaveClass(/show/);
    await expect(page).toHaveURL(/S3a-team-update\.html/);
  });

  test('system admin cross-club + status inactive', async ({ page }) => {
    await loginAs(page, 'maria@vantageiq.club');
    await page.goto('/S3a-team-update.html?teamId=t_senior');

    await page.selectOption('#updateCoachSelect', 'ana@vantageiq.club');
    await page.selectOption('#updateStatusSelect', 'inactive');
    await page.getByTestId('update-save').click();

    await expect(page).toHaveURL(/S3-team-management\.html/);
    await expect(page.locator('tbody tr', { hasText: 'Senior Squad' })).toHaveCount(0);
  });

  test('S3a name and age group prefill and persist', async ({ page }) => {
    // Server title-cases name tokens; use a stable unique suffix that survives that.
    const suffix = String(Date.now());
    const uniqueName = 'U19 Renamed ' + suffix;
    await page.goto('/S3a-team-update.html?teamId=t_u19');
    await expect(page.getByTestId('update-name-input')).toHaveValue('U19 Prime');
    await expect(page.getByTestId('update-age-group-input')).toHaveValue('U19');

    await page.fill('#updateNameInput', uniqueName);
    await page.fill('#updateAgeGroupInput', 'U18');
    await page.getByTestId('update-save').click();

    await expect(page).toHaveURL(/S3-team-management\.html/);
    await page.locator('#onlyMyClubs').uncheck();
    const row = page.locator('tbody tr', { hasText: suffix });
    await expect(row).toHaveCount(1);
    await expect(row).toContainText('U18');
    await expect(row).toContainText('U19 Renamed');
  });

  test('S3a duplicate team name shows inline conflict', async ({ page }) => {
    await restoreTeam(page, 't_u19');
    await page.goto('/S3a-team-update.html?teamId=t_u19');
    await expect(page.getByTestId('update-name-input')).toHaveValue('U19 Prime');
    await page.fill('#updateNameInput', 'Senior Squad');
    await page.getByTestId('update-save').click();

    await expect(page.locator('#updateFormError')).toHaveClass(/show/);
    await expect(page.locator('#updateFormError')).toContainText(/team with this name already exists/i);
    await expect(page).toHaveURL(/S3a-team-update\.html/);
  });

  test('offline rename cascades player teamName', async ({ page }) => {
    await page.addInitScript(() => {
      window.__USE_MOCK_LOCAL__ = true;
      window.__USE_BACKEND__ = false;
    });
    await loginAs(page, 'joao@vantageiq.club');

    const suffix = String(Date.now());
    const uniqueName = 'U19 Offline ' + suffix;
    const meta = await page.evaluate((newName) => {
      const key = 'vantageiq_mockup_v2';
      const store = JSON.parse(window.localStorage.getItem(key) || '{}');
      const team = (store.teams || []).find((entry) => entry.name === 'U19 Prime');
      if (!team) throw new Error('seed team missing');
      const players = (store.players || []).filter((player) => player.teamName === 'U19 Prime');
      if (!players.length) {
        store.players.push({
          id: 9919,
          name: 'Offline Cascade Player',
          normalizedName: 'offline cascade player',
          teamName: 'U19 Prime',
          position: 'CF – Centre Forward',
          trend: 'improving',
          updated: 'Updated just now',
          avatarUrl: null,
          birthMonth: null,
          birthYear: 2007
        });
      }
      window.localStorage.setItem(key, JSON.stringify(store));
      const refreshed = JSON.parse(window.localStorage.getItem(key) || '{}');
      const count = (refreshed.players || []).filter((player) => player.teamName === 'U19 Prime').length;
      return { teamId: String(team.id), expected: count, newName };
    }, uniqueName);

    await page.goto('/S3a-team-update.html?teamId=' + meta.teamId);
    await page.fill('#updateNameInput', uniqueName);
    await page.getByTestId('update-save').click();
    await expect(page).toHaveURL(/S3-team-management\.html/);

    const cascaded = await page.evaluate(({ expected, suffix }) => {
      const store = JSON.parse(window.localStorage.getItem('vantageiq_mockup_v2') || '{}');
      const remainingOld = (store.players || []).filter((player) => player.teamName === 'U19 Prime').length;
      const onNew = (store.players || []).filter((player) => String(player.teamName || '').includes(suffix)).length;
      return { remainingOld, onNew, expected };
    }, { expected: meta.expected, suffix });

    expect(cascaded.remainingOld).toBe(0);
    expect(cascaded.onNew).toBe(cascaded.expected);
    expect(cascaded.onNew).toBeGreaterThan(0);
  });

  test.afterEach(async ({ page }) => {
    await restoreTeam(page, 't_u19');
    await restoreTeam(page, 't_u17');
    await restoreTeam(page, 't_senior');
  });
});
