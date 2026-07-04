const { test, expect } = require('@playwright/test');

test.describe('S1 Player List team filter and add-player flow', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      window.__USE_MOCK_LOCAL__ = true;
      window.__USE_BACKEND__ = false;
    });

    await page.goto('/S0-login.html');
    await page.evaluate(() => window.localStorage.removeItem('vantageiq_mockup_v2'));
    await page.goto('/S1-player-list.html');
    await expect(page.locator('#playerGrid')).toBeVisible();
  });

  test('bottom navigation routes to teams, capture, and assessments pages', async ({ page }) => {
    await page.locator('.bottom-nav .nav-item', { hasText: 'Teams' }).click();
    await expect(page).toHaveURL(/S3-team-management\.html|S3-team-management$/);

    await page.goto('/S1-player-list.html');
    await page.locator('.bottom-nav .nav-item', { hasText: 'Capture' }).click();
    await expect(page).toHaveURL(/S4-video-capture\.html|S4-video-capture$/);

    await page.goto('/S1-player-list.html');
    await page.locator('.bottom-nav .nav-item', { hasText: 'My Clips' }).click();
    await expect(page).toHaveURL(/S6-assessment-list\.html|S6-assessment-list$/);
  });

  test('shows only players assigned to selected team', async ({ page }) => {
    await page.selectOption('#teamFilter', 'Senior Squad');

    const cards = page.locator('.player-card .player-name');
    await expect(cards).toHaveCount(2);
    await expect(page.locator('.player-card .player-name', { hasText: 'Cristiano Ronaldo' })).toBeVisible();
    await expect(page.locator('.player-card .player-name', { hasText: 'Kylian Mbappe' })).toBeVisible();
    await expect(page.locator('.player-card .player-name', { hasText: 'Neymar Jr' })).toHaveCount(0);

    await expect(page.locator('#playerListStatus')).toContainText('Senior Squad');
  });

  test('initializes selected team from query string when valid', async ({ page }) => {
    await page.goto('/S1-player-list.html?team=Senior%20Squad');

    await expect(page.locator('#teamFilter')).toHaveValue('Senior Squad');
    const cards = page.locator('.player-card .player-name');
    await expect(cards).toHaveCount(2);
    await expect(page.locator('.player-card .player-name', { hasText: 'Cristiano Ronaldo' })).toBeVisible();
    await expect(page.locator('.player-card .player-name', { hasText: 'Kylian Mbappe' })).toBeVisible();
    await expect(page.locator('.player-card .player-name', { hasText: 'Neymar Jr' })).toHaveCount(0);
  });

  test('falls back to all teams when query string team is invalid', async ({ page }) => {
    await page.goto('/S1-player-list.html?team=Unknown%20Team');

    await expect(page.locator('#teamFilter')).toHaveValue('all');
    await expect(page.locator('.player-card .player-name')).toHaveCount(4);
    await expect(page.locator('#playerListStatus')).toContainText('Showing all assigned players');
  });

  test('adds a player from name lookup and reassigns to selected team', async ({ page }) => {
    await page.selectOption('#teamFilter', 'Senior Squad');
    await page.getByRole('button', { name: 'Add Player' }).click();

    await page.fill('#addPlayerInput', 'ney');
    await page.fill('#addPlayerInput', 'Neymar Jr');
    await page.getByRole('button', { name: 'Add to Team' }).click();

    await expect(page.locator('#toast')).toContainText('Neymar Jr moved to Senior Squad.');
    await expect(page.locator('.player-card .player-name', { hasText: 'Neymar Jr' })).toBeVisible();

    await page.selectOption('#teamFilter', 'U17 Elite');
    await expect(page.locator('.player-card .player-name', { hasText: 'Neymar Jr' })).toHaveCount(0);
    await expect(page.locator('#emptyState')).toBeVisible();
  });

  test('blocks add action when no valid dropdown match exists', async ({ page }) => {
    await page.selectOption('#teamFilter', 'U19 Prime');
    await page.getByRole('button', { name: 'Add Player' }).click();

    await page.fill('#addPlayerInput', 'zzz');
    await expect(page.locator('#addPlayerHint')).toContainText('No exact match found. Confirm create-on-no-match before submit.');
    await expect(page.locator('#createConfirm')).toBeChecked();

    await page.locator('#createConfirm').uncheck();
    await page.getByRole('button', { name: 'Add to Team' }).click();
    await expect(page.locator('#addPlayerHint')).toContainText('Choose a player from the dropdown matches.');
  });

  test('requires selecting a specific team before add-player suggestions are enabled', async ({ page }) => {
    await page.selectOption('#teamFilter', 'all');
    await page.getByRole('button', { name: 'Add Player' }).click();

    await expect(page.locator('#addPlayerHint')).toContainText('Select a specific team before adding players.');
    await expect(page.getByRole('button', { name: 'Add to Team' })).toBeDisabled();
  });

  test('keeps explicit mock-local behavior for offline regression runs', async ({ page }) => {
    await expect(page.locator('.player-card .player-name')).toHaveCount(4);
    await page.selectOption('#teamFilter', 'Senior Squad');
    await expect(page.locator('.player-card .player-name', { hasText: 'Cristiano Ronaldo' })).toBeVisible();
  });
});
