const { test, expect } = require('@playwright/test');

test.describe('S6 Assessment Results list', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/S0-login.html');
    await page.evaluate(() => window.localStorage.removeItem('vantageiq_mockup_v2'));
    // Always sign in as coach joao@vantageiq.club before every test in this suite.
    await page.fill('#email', 'joao@vantageiq.club');
    await page.fill('#password', 'SecurePass123');
    await page.locator('#loginForm button[type="submit"]').click();
    await expect(page).toHaveURL(/S1-player-list\.html|S1-player-list$/);
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

  test('renders clip comments above the rating row on assessed cards', async ({ page }) => {
    const firstAssessedCard = page.locator('.result-card').filter({ has: page.locator('.status-assessed') }).first();
    await expect(firstAssessedCard.locator('.result-comment')).toBeVisible();
    const commentIndex = await firstAssessedCard.locator('.result-comment').evaluate((node) => {
      const card = node.closest('.result-card');
      const children = Array.from(card.querySelectorAll('.result-comment, .result-rating'));
      return children.indexOf(node);
    });
    const ratingIndex = await firstAssessedCard.locator('.result-rating').evaluate((node) => {
      const card = node.closest('.result-card');
      const children = Array.from(card.querySelectorAll('.result-comment, .result-rating'));
      return children.indexOf(node);
    });
    expect(commentIndex).toBeGreaterThanOrEqual(0);
    expect(ratingIndex).toBeGreaterThan(commentIndex);
  });

  test('opens result detail route from View Results actions', async ({ page }) => {
    await page.getByRole('link', { name: 'View Results' }).first().click();
    await expect(page).toHaveURL(/S2-player-dashboard\.html|S2-player-dashboard$/);
  });
});
