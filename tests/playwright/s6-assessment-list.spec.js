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
    await page.addInitScript(() => {
      window.__USE_MOCK_LOCAL__ = true;
    });
    await page.goto('/S6-assessment-list.html');
    await expect(page.getByText('Video Assessments')).toBeVisible();
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

  test('shows percent scores and bright star only above 80%', async ({ page }) => {
    await page.addInitScript(() => {
      window.__USE_MOCK_LOCAL__ = true;
    });
    await page.goto('/S6-assessment-list.html');
    await expect(page.getByText('Video Assessments')).toBeVisible();

    const messiCard = page.locator('.result-card').filter({ hasText: 'Lionel Messi' });
    await expect(messiCard.getByTestId('rating-label')).toHaveText('84%');
    await expect(messiCard.getByTestId('rating-star')).toHaveAttribute('data-bright', 'true');
    await expect(messiCard.getByTestId('rating-star')).not.toHaveClass(/rating-star--muted/);
    await expect(messiCard.getByTestId('rating-label')).not.toContainText('/ 5');

    const ronaldoCard = page.locator('.result-card').filter({ hasText: 'Cristiano Ronaldo' });
    await expect(ronaldoCard.getByTestId('rating-label')).toHaveText('76%');
    await expect(ronaldoCard.getByTestId('rating-star')).toHaveAttribute('data-bright', 'false');
    await expect(ronaldoCard.getByTestId('rating-star')).toHaveClass(/rating-star--muted/);

    const neymarCard = page.locator('.result-card').filter({ hasText: 'Neymar Jr' });
    await expect(neymarCard.getByTestId('rating-label')).toHaveText('90%');
    await expect(neymarCard.getByTestId('rating-star')).toHaveAttribute('data-bright', 'true');
  });

  test('opens result detail route from View Results actions', async ({ page }) => {
    await page.getByRole('link', { name: 'View Results' }).first().click();
    await expect(page).toHaveURL(/S2-player-dashboard\.html|S2-player-dashboard$/);
  });

  test('does not force Pre-Selected Player without query params', async ({ page }) => {
    await expect(page.getByTestId('preselected-player-filter')).toBeHidden();
    await expect(page.locator('#preselectedPlayerLabel')).toBeHidden();
  });

  test('deep-link enables Pre-Selected Player and filters to that player', async ({ page }) => {
    await page.addInitScript(() => {
      window.__USE_MOCK_LOCAL__ = true;
    });
    await page.goto('/S6-assessment-list.html?playerId=10&playerName=' + encodeURIComponent('Lionel Messi') + '&teamName=' + encodeURIComponent('U19 Prime'));
    await expect(page.getByText('Video Assessments')).toBeVisible();
    const checkbox = page.getByTestId('preselected-player-filter');
    await expect(checkbox).toBeVisible();
    await expect(checkbox).toBeChecked();
    // Team defaults to the deep-linked team when that option exists in the club-scoped list.
    const teamOptions = await page.locator('#teamFilter option').allTextContents();
    if (teamOptions.includes('U19 Prime')) {
      await expect(page.locator('#teamFilter')).toHaveValue('U19 Prime');
    }
    await expect(page.locator('.result-player')).toHaveCount(1);
    await expect(page.locator('.result-player')).toHaveText('Lionel Messi');

    await checkbox.uncheck();
    await page.locator('#teamFilter').selectOption('all');
    await expect(page.locator('.result-player', { hasText: 'Cristiano Ronaldo' })).toHaveCount(1);
    await expect(page.locator('.result-player', { hasText: 'Neymar Jr' })).toHaveCount(1);
  });
});
