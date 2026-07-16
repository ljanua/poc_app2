const { test, expect } = require('@playwright/test');

test.describe('S0 Login role entry points', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/S0-login.html');
    await page.evaluate(() => window.localStorage.removeItem('vantageiq_mockup_v2'));
    await page.goto('/S0-login.html');
  });

  test('shows login shell without SystemAdmin quick sign-in', async ({ page }) => {
    const logo = page.getByTestId('brand-logo');
    await expect(logo).toBeVisible();
    await expect(logo).toHaveAttribute('alt', 'VantageIQ');
    await expect(logo).toHaveAttribute('src', /VantagIQ_transp_300/);
    await expect(page.locator('.auth-logo')).not.toContainText('⚡ VantageIQ');

    await expect(page.getByText('LOGIN')).toBeVisible();
    await expect(page.getByLabel('Email')).toBeVisible();
    const password = page.getByLabel('Password');
    await expect(password).toBeVisible();
    await expect(password).toHaveAttribute('type', 'password');

    await expect(page.getByRole('button', { name: 'Sign In' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Quick Sign-In as SystemAdmin' })).toHaveCount(0);
  });

  test('navigates to coach and admin landing pages from login', async ({ page }) => {
    await page.fill('#email', 'joao@vantageiq.club');
    await page.fill('#password', 'SecurePass123');
    await page.getByRole('button', { name: 'Sign In' }).click();
    await expect(page).toHaveURL(/S1-player-list\.html|S1-player-list$/);
    await expect(page.getByRole('button', { name: 'Add Player' })).toBeVisible();

    await page.goto('/S0-login.html');
    await page.fill('#email', 'maria@vantageiq.club');
    await page.fill('#password', 'SecurePass123');
    await page.getByRole('button', { name: 'Sign In' }).click();
    await expect(page).toHaveURL(/S7-admin-user-management\.html|S7-admin-user-management$/);
    await expect(page.getByRole('button', { name: 'Create User' })).toBeVisible();
  });

  test('system admin can reach team management with admin controls', async ({ page }) => {
    await page.fill('#email', 'maria@vantageiq.club');
    await page.fill('#password', 'SecurePass123');
    await page.getByRole('button', { name: 'Sign In' }).click();
    await expect(page).toHaveURL(/S7-admin-user-management\.html|S7-admin-user-management$/);

    await page.getByRole('link', { name: 'Teams' }).click();
    await expect(page).toHaveURL(/S3-team-management\.html|S3-team-management$/);
    await expect(page.locator('#roleBadge')).toContainText('SystemAdmin');
    await expect(page.getByRole('button', { name: 'Change Coach' }).first()).toBeVisible();
  });
});
