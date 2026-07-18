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
    await expect(page.getByTestId('nav-skills')).toBeVisible();
    await expect(page.getByTestId('advanced-filter-toggle')).toBeVisible();
  });

  test('Users bottom-nav is visible on S3 and S4 and opens S7', async ({ page }) => {
    await loginAsRita(page);

    await page.goto('/S3-team-management.html');
    await expect(page.getByTestId('nav-users')).toBeVisible();
    await page.getByTestId('nav-users').click();
    await expect(page).toHaveURL(/S7-admin-user-management/);

    await page.goto('/S4-video-capture.html');
    await expect(page.getByTestId('nav-users')).toBeVisible();
    await expect(page.getByTestId('nav-clubs')).toBeHidden();
  });

  test('S7 allows Club Admin to create Coach or ClubAdmin and denies SystemAdmin', async ({ page }) => {
    await loginAsRita(page);
    await page.getByTestId('nav-users').click();
    await expect(page).toHaveURL(/S7-admin-user-management/);
    await expect(page.getByTestId('open-clubs-page')).toBeHidden();
    await expect(page.locator('#createRole option', { hasText: 'SystemAdmin' })).toHaveCount(0);
    await expect(page.locator('#createRole option', { hasText: 'Coach' })).toHaveCount(1);
    await expect(page.locator('#createRole option', { hasText: 'ClubAdmin' })).toHaveCount(1);

    const coachEmail = uniqueEmail('club.coach', 'vantageiq.club');
    await page.locator('#openCreateUser').click();
    await expect(page.getByTestId('create-club-select')).toHaveValue('c_default');
    await expect(page.getByTestId('create-club-select')).toBeDisabled();
    await page.fill('#createName', 'Club Coach');
    await page.fill('#createEmail', coachEmail);
    await page.selectOption('#createRole', 'Coach');
    await page.fill('#createPassword', 'SecurePass123');
    await page.locator('#createUserForm button[type="submit"]').click();

    const coachRow = page.locator('#usersTableBody tr', { hasText: coachEmail });
    await expect(coachRow).toBeVisible({ timeout: 5000 });
    await expect(coachRow.locator('.team-chip.js-club-chip', { hasText: 'VantageIQ Club' })).toHaveCount(1);

    const adminEmail = uniqueEmail('club.admin', 'vantageiq.club');
    await page.locator('#openCreateUser').click();
    await page.fill('#createName', 'Peer Club Admin');
    await page.fill('#createEmail', adminEmail);
    await page.selectOption('#createRole', 'ClubAdmin');
    await page.fill('#createPassword', 'SecurePass123');
    await page.locator('#createUserForm button[type="submit"]').click();

    const adminRow = page.locator('#usersTableBody tr', { hasText: adminEmail });
    await expect(adminRow).toBeVisible({ timeout: 5000 });
    await expect(adminRow).toContainText('ClubAdmin');
    await expect(adminRow.locator('.team-chip.js-club-chip', { hasText: 'VantageIQ Club' })).toHaveCount(1);
  });

  test('S7 Club Admin can change Coach to ClubAdmin and demote back', async ({ page }) => {
    await loginAsRita(page);
    await page.getByTestId('nav-users').click();

    const joaoRow = page.locator('#usersTableBody tr[data-email="joao@vantageiq.club"]');
    await expect(joaoRow).toBeVisible();
    await joaoRow.getByRole('button', { name: 'Change Role' }).click();
    await expect(page.locator('#updatedRole option', { hasText: 'SystemAdmin' })).toHaveCount(0);
    await page.selectOption('#updatedRole', 'ClubAdmin');
    await page.getByRole('button', { name: 'Update Role' }).click();
    await expect(page.locator('#changeRoleModal')).toBeHidden();
    await expect(joaoRow).toContainText('ClubAdmin');

    await joaoRow.getByRole('button', { name: 'Change Role' }).click();
    await page.selectOption('#updatedRole', 'Coach');
    await page.getByRole('button', { name: 'Update Role' }).click();
    await expect(joaoRow).toContainText('Coach');
  });

  test('S7 Club Admin cannot change own role', async ({ page }) => {
    await loginAsRita(page);
    await page.getByTestId('nav-users').click();

    const ritaRow = page.locator('#usersTableBody tr[data-email="rita@vantageiq.club"]');
    await expect(ritaRow).toBeVisible();
    await ritaRow.getByRole('button', { name: 'Change Role' }).click();
    await page.selectOption('#updatedRole', 'Coach');
    await page.getByRole('button', { name: 'Update Role' }).click();
    await expect(page.locator('#changeRoleModal')).toBeVisible();
    await expect(page.locator('#toast')).toContainText(/permission|forbidden/i);
    await expect(ritaRow).toContainText('ClubAdmin');
  });

  test('S7 Club Admin create-user club select locks to active club', async ({ page }) => {
    await loginAsRita(page);
    await page.evaluate(() => {
      const key = 'vantageiq_mockup_v2';
      const store = JSON.parse(window.localStorage.getItem(key) || '{}');
      if (!Array.isArray(store.clubs)) store.clubs = [];
      if (!store.clubs.some((club) => club.id === 'c_second')) {
        store.clubs.push({ id: 'c_second', name: 'Second Club', status: 'active', defaultSportId: 'sport_soccer' });
      }
      if (!store.clubs.some((club) => club.id === 'c_foreign')) {
        store.clubs.push({ id: 'c_foreign', name: 'Foreign Club', status: 'active' });
      }
      if (!Array.isArray(store.coachClubs)) store.coachClubs = [];
      if (!store.coachClubs.some((entry) => entry.userId === 'u_clubadmin_rita' && entry.clubId === 'c_second')) {
        store.coachClubs.push({ userId: 'u_clubadmin_rita', clubId: 'c_second' });
      }
      window.localStorage.setItem(key, JSON.stringify(store));
      window.localStorage.setItem(
        'vantageiq_active_club_id',
        JSON.stringify({ id: 'c_default', name: 'VantageIQ Club' })
      );
    });

    await page.getByTestId('nav-users').click();
    await page.locator('#openCreateUser').click();

    const clubSelect = page.getByTestId('create-club-select');
    await expect(clubSelect).toBeDisabled();
    await expect(clubSelect).toHaveValue('c_default');
    const optionValues = await clubSelect.locator('option').evaluateAll((opts) =>
      opts.map((opt) => opt.value).filter(Boolean)
    );
    expect(optionValues).toEqual(['c_default']);
    expect(optionValues).not.toContain('c_second');
    expect(optionValues).not.toContain('c_foreign');
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

  test('S6 Club Admin hides foreign-club clips and team options', async ({ page }) => {
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
      if (!Array.isArray(store.players)) store.players = [];
      if (!store.players.some((player) => player.id === 991)) {
        store.players.push({
          id: 991,
          name: 'Foreign Club Striker',
          normalizedName: 'foreign club striker',
          teamName: 'Other Club United',
          position: 'ST – Striker',
          trend: 'improving',
          updated: 'Updated 1h ago',
          avatarUrl: null,
          birthMonth: null,
          birthYear: 2008
        });
      }
      if (!Array.isArray(store.clips)) store.clips = [];
      store.clips.push({
        id: 'clip_foreign_rita_1',
        playerId: 991,
        situation: 'Foreign club chance',
        status: 'complete',
        score: 0.5,
        summary: 'Outside club clip',
        comments: 'Outside club clip',
        submittedAt: '1 hour ago',
        skill: 'Finishing',
        skillFocus: ['Finishing'],
        skillRatings: { Finishing: 0.5 }
      });
      window.localStorage.setItem(key, JSON.stringify(store));
    });

    await page.goto('/S6-assessment-list.html');
    await expect(page.getByText('Video Assessments')).toBeVisible();
    await expect(page.getByText('Lionel Messi')).toBeVisible();
    await expect(page.getByText('Foreign Club Striker')).toHaveCount(0);
    await expect(page.locator('#teamFilter option', { hasText: 'Other Club United' })).toHaveCount(0);
    await expect(page.locator('#teamFilter option', { hasText: 'U19 Prime' })).toHaveCount(1);
  });
});
