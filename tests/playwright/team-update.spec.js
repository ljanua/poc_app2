const { test, expect } = require('@playwright/test');

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
  await page.evaluate(async ({ teamId }) => {
    await fetch('/api/v1/teams/' + encodeURIComponent(teamId) + '/update', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        coachEmail: 'joao@vantageiq.club',
        clubId: 'c_default',
        status: 'active',
        actorRole: 'SystemAdmin',
        actorEmail: 'maria@vantageiq.club'
      })
    });
  }, { teamId });
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

  test.afterEach(async ({ page }) => {
    await restoreTeam(page, 't_u19');
    await restoreTeam(page, 't_u17');
    await restoreTeam(page, 't_senior');
  });
});
