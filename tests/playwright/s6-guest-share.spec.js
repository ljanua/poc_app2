const { test, expect } = require('@playwright/test');

async function loginAsCoach(page) {
  await page.goto('/S0-login.html');
  await page.evaluate(() => window.localStorage.removeItem('vantageiq_mockup_v2'));
  await page.fill('#email', 'joao@vantageiq.club');
  await page.fill('#password', 'SecurePass123');
  await page.locator('#loginForm button[type="submit"]').click();
  await expect(page).toHaveURL(/S1-player-list\.html|S1-player-list$/);
}

test.describe('S6 guest share (Feature 035)', () => {
  test('coach S6 without share still loads', async ({ page }) => {
    await loginAsCoach(page);
    await page.goto('/S6-assessment-list.html');
    await expect(page.getByText('Video Assessments')).toBeVisible();
    await expect(page.locator('#roleMeta')).not.toHaveText('Guest View');
    await expect(page.getByTestId('guest-share-unavailable')).toHaveCount(0);
  });
});
