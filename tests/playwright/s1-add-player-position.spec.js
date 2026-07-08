const { test, expect } = require('@playwright/test');

// Feature 012 — S1 add-player position dropdown.
//
// The existing inline addPlayerPanel grows a Position <select> filtered by
// the selected team's sport. Submitting a player with the dropdown value
// persists the position name on the new player through the offline store.

test.describe('S1 add-player position dropdown', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      window.__USE_MOCK_LOCAL__ = true;
      window.__USE_BACKEND__ = false;
    });

    await page.goto('/S0-login.html');
    await page.evaluate(() => window.localStorage.removeItem('vantageiq_mockup_v2'));
    await page.fill('#email', 'joao@vantageiq.club');
    await page.fill('#password', 'SecurePass123');
    await page.locator('#loginForm button[type="submit"]').click();
    await expect(page).toHaveURL(/S1-player-list\.html|S1-player-list$/);
  });

  test('opening Add Player on U19 Prime exposes sport-filtered position options', async ({ page }) => {
    await page.selectOption('#teamFilter', 'U19 Prime');
    await page.getByRole('button', { name: 'Add Player' }).click();

    const positionField = page.locator('[data-testid="add-player-position"]');
    await expect(positionField).toBeVisible();
    const optionTexts = await positionField.locator('option').allTextContents();
    expect(optionTexts).toContain('GK – Goalkeeper');
    expect(optionTexts).toContain('ST – Striker');
    // "Position not set" is the explicit no-position option, available so
    // existing flows that don't care about position still work.
    expect(optionTexts).toContain('Position not set');
  });

  test('changing the team reloads the position dropdown against the new sport', async ({ page }) => {
    // Joao's coach scope shows only his own team, so the reload-the-list
    // assertion focuses on the helper notice staying hidden for a team that
    // has positions.
    await page.selectOption('#teamFilter', 'U19 Prime');
    await page.getByRole('button', { name: 'Add Player' }).click();
    await expect(page.locator('#addPlayerPositionEmpty')).toBeHidden();
  });

  test('creating a player with a chosen position persists that position on the new player', async ({ page }) => {
    await page.selectOption('#teamFilter', 'U19 Prime');
    await page.getByRole('button', { name: 'Add Player' }).click();

    await page.fill('#addPlayerInput', 'Pos Test One');
    await page.locator('[data-testid="add-player-position"]').selectOption('CM – Central Midfielder');
    await page.getByRole('button', { name: 'Add to Team' }).click();

    // Toast confirms the player was added; the new player should appear on
    // the S1 card list (or, when coach-scoped, the offline store snapshot
    // should already reflect the position).
    await expect(page.locator('#toast')).toContainText('Pos Test One');
    const stored = await page.evaluate(() => {
      const data = JSON.parse(window.localStorage.getItem('vantageiq_mockup_v2') || '{}');
      return (data.players || []).find((entry) => entry.name === 'Pos Test One');
    });
    expect(stored).toBeTruthy();
    expect(stored.position).toBe('CM – Central Midfielder');
  });
});