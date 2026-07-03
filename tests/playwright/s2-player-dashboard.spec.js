const { test, expect } = require('@playwright/test');

test.describe('S2 Player Development Dashboard', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/S0-login.html');
    await page.evaluate(() => window.localStorage.removeItem('vantageiq_mockup_v2'));
    await page.goto('/S2-player-dashboard.html');
    await expect(page.getByText('Player Development')).toBeVisible();
  });

  test('shows key development, match time, and performance sections', async ({ page }) => {
    await expect(page.getByText('Development Progress')).toBeVisible();
    await expect(page.getByText('Match Time History')).toBeVisible();
    await expect(page.getByText('Recent Performance')).toBeVisible();
    await expect(page.getByText('Video Assessments')).toBeVisible();

    await expect(page.getByText('Current Level')).toBeVisible();
    await expect(page.getByText('Total Minutes')).toBeVisible();
    await expect(page.getByText('Avg Score')).toBeVisible();
  });

  test('provides actions to view results and submit clips', async ({ page }) => {
    await page.getByRole('link', { name: 'View Results' }).click();
    await expect(page).toHaveURL(/S6-assessment-list\.html|S6-assessment-list$/);

    await page.goto('/S2-player-dashboard.html');
    await page.getByRole('link', { name: /Submit New Clip|Submit a Clip/ }).first().click();
    await expect(page).toHaveURL(/S4-video-capture\.html|S4-video-capture$/);
  });
});
