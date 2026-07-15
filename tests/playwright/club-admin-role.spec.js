const { test, expect } = require('@playwright/test');
const { uniqueEmail } = require('./_fixture-utils');

async function loginAsRita(page) {
  await page.addInitScript(() => {
    window.__USE_MOCK_LOCAL__ = true;
    window.__USE_BACKEND__ = false;
  });
  await page.goto('/S0-login.html');
  await page.evaluate(() => window.localStorage.removeItem('vantageiq_mockup_v2'));
  await page.fill('#email', 'rita@vantageiq.club');
  await page.fill('#password', 'SecurePass123');
  await page.locator('#loginForm button[type="submit"]').click();
  await expect(page).toHaveURL(/S1-player-list\.html|S1-player-list$/);
}

test.describe('Club Admin role', () => {
  test('S1 shows all club players without Only My Players toggle', async ({ page }) => {
    await loginAsRita(page);
    await expect(page.getByTestId('only-mine-toggle')).toBeHidden();
    await expect(page.locator('.player-card .player-name')).toHaveCount(4);
    await expect(page.locator('#playerListStatus')).toContainText('your clubs');
    await expect(page.locator('#teamFilter')).toContainText('Senior Squad');
    await expect(page.locator('#teamFilter')).toContainText('U19 Prime');
    await expect(page.getByTestId('nav-users')).toBeVisible();
    await expect(page.getByTestId('nav-clubs')).toBeHidden();
    await expect(page.getByTestId('nav-skills')).toBeHidden();
    await expect(page.getByTestId('advanced-filter-toggle')).toBeVisible();
  });

  test('S7 allows Club Admin to create Coach and denies SystemAdmin role option', async ({ page }) => {
    await loginAsRita(page);
    await page.getByTestId('nav-users').click();
    await expect(page).toHaveURL(/S7-admin-user-management/);
    await expect(page.getByTestId('open-clubs-page')).toBeHidden();
    await expect(page.locator('#createRole option', { hasText: 'SystemAdmin' })).toHaveCount(0);
    await expect(page.locator('#createRole option', { hasText: 'Coach' })).toHaveCount(1);

    const email = uniqueEmail('club.coach', 'vantageiq.club');
    await page.locator('#openCreateUser').click();
    await expect(page.getByTestId('create-club-select')).toHaveValue('c_default');
    await expect(page.getByTestId('create-club-select')).toBeDisabled();
    await page.fill('#createName', 'Club Coach');
    await page.fill('#createEmail', email);
    await page.fill('#createPassword', 'SecurePass123');
    await page.locator('#createUserForm button[type="submit"]').click();

    const newRow = page.locator('#usersTableBody tr', { hasText: email });
    await expect(newRow).toBeVisible({ timeout: 5000 });
    await expect(newRow.locator('.team-chip.js-club-chip', { hasText: 'VantageIQ Club' })).toHaveCount(1);
  });

  test('S7 Club Admin with multiple clubs only offers owned clubs', async ({ page }) => {
    await loginAsRita(page);
    await page.evaluate(() => {
      const key = 'vantageiq_mockup_v2';
      const store = JSON.parse(window.localStorage.getItem(key) || '{}');
      if (!Array.isArray(store.clubs)) store.clubs = [];
      if (!store.clubs.some((club) => club.id === 'c_second')) {
        store.clubs.push({ id: 'c_second', name: 'Second Club', status: 'active' });
      }
      if (!store.clubs.some((club) => club.id === 'c_foreign')) {
        store.clubs.push({ id: 'c_foreign', name: 'Foreign Club', status: 'active' });
      }
      if (!Array.isArray(store.coachClubs)) store.coachClubs = [];
      if (!store.coachClubs.some((entry) => entry.userId === 'u_clubadmin_rita' && entry.clubId === 'c_second')) {
        store.coachClubs.push({ userId: 'u_clubadmin_rita', clubId: 'c_second' });
      }
      window.localStorage.setItem(key, JSON.stringify(store));
    });

    await page.getByTestId('nav-users').click();
    await page.locator('#openCreateUser').click();

    const clubSelect = page.getByTestId('create-club-select');
    await expect(clubSelect).toBeEnabled();
    const optionValues = await clubSelect.locator('option').evaluateAll((opts) =>
      opts.map((opt) => opt.value).filter(Boolean)
    );
    expect(optionValues).toEqual(expect.arrayContaining(['c_default', 'c_second']));
    expect(optionValues).not.toContain('c_foreign');

    await clubSelect.evaluate((select) => {
      const phantom = document.createElement('option');
      phantom.value = 'c_foreign';
      phantom.textContent = 'Foreign Club';
      select.appendChild(phantom);
      select.value = 'c_foreign';
    });

    const email = uniqueEmail('multi.club', 'vantageiq.club');
    await page.fill('#createName', 'Multi Club Coach');
    await page.fill('#createEmail', email);
    await page.fill('#createPassword', 'SecurePass123');
    await page.locator('#createUserForm button[type="submit"]').click();

    await expect(page.locator('#createUserModal')).toBeVisible();
    await expect(page.locator('#toast')).toContainText(/club|belong|permission|forbidden|assign/i);
  });

  test('S3 Club Admin only sees teams in assigned clubs', async ({ page }) => {
    await loginAsRita(page);
    await page.evaluate(() => {
      const key = 'vantageiq_mockup_v2';
      const store = JSON.parse(window.localStorage.getItem(key) || '{}');
      if (!Array.isArray(store.clubs)) store.clubs = [];
      if (!store.clubs.some((club) => club.id === 'c_other')) {
        store.clubs.push({ id: 'c_other', name: 'Other Football Club', status: 'active' });
      }
      if (!Array.isArray(store.teams)) store.teams = [];
      if (!store.teams.some((team) => team.id === 99)) {
        store.teams.push({
          id: 99,
          name: 'Other Club United',
          ageGroup: 'U15',
          leadCoach: 'Outside Coach',
          leadCoachEmail: 'outside@example.com',
          clubId: 'c_other',
          sportId: 'sport_soccer',
          status: 'active'
        });
      }
      window.localStorage.setItem(key, JSON.stringify(store));
    });

    await page.goto('/S3-team-management.html');
    await expect(page.locator('#roleBadge')).toContainText('ClubAdmin');
    await expect(page.getByRole('cell', { name: 'Senior Squad' })).toBeVisible();
    await expect(page.getByRole('cell', { name: 'U19 Prime' })).toBeVisible();
    await expect(page.getByRole('cell', { name: 'Other Club United' })).toHaveCount(0);
  });
});
