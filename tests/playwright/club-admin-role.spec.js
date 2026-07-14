const { test, expect } = require('@playwright/test');

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

    await page.locator('#openCreateUser').click();
    await page.fill('#createName', 'Club Coach');
    await page.fill('#createEmail', 'club.coach@vantageiq.club');
    await page.fill('#createPassword', 'SecurePass123');
    await page.locator('#createUserForm button[type="submit"]').click();
    await expect(page.locator('.player-card, #usersTableBody tr', { hasText: 'Club Coach' }).or(
      page.locator('#usersTableBody tr', { hasText: 'club.coach@vantageiq.club' })
    )).toBeVisible({ timeout: 5000 });
  });
});
