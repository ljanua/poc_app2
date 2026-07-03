const { test, expect } = require('@playwright/test');

test.describe('S6 Assessment Results list', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/S0-login.html');
    await page.evaluate(() => window.localStorage.removeItem('vantageiq_mockup_v2'));
    await page.goto('/S6-assessment-list.html');
    await expect(page.getByText('Video Assessments')).toBeVisible();
  });

  test('shows assessed and pending result cards with status badges', async ({ page }) => {
    await expect(page.locator('.status-assessed')).toHaveCount(3);
    await expect(page.locator('.status-pending')).toHaveCount(1);
    await expect(page.getByText('Lionel Messi')).toBeVisible();
    await expect(page.getByText('Cristiano Ronaldo')).toBeVisible();
    await expect(page.getByText('Neymar Jr')).toBeVisible();
  });

  test('opens result detail route from View Results actions', async ({ page }) => {
    await page.getByRole('link', { name: 'View Results' }).first().click();
    await expect(page).toHaveURL(/S2-player-dashboard\.html|S2-player-dashboard$/);
  });
});
