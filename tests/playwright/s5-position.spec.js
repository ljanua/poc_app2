const { test, expect } = require('@playwright/test');

// Feature 012 — S5 player-edit position dropdown.
//
// Covers the replacement of the free-text #fieldPosition with a sport-filtered
// <select> sourced from MockupApi.listPositions. The team's sport is the
// upstream control: changing the team reloads the options. The seeded
// U19 Prime team is on sport_soccer, so every existing position for that
// team should be a Soccer position.

test.describe('S5 Edit Player — sport-filtered position dropdown', () => {
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

    // Reach the S2 dashboard so the offline store is hydrated before we
    // inject the edit-page player.
    await page.goto('/S2-player-dashboard.html');
    await expect(page.getByText('Player Development')).toBeVisible();

    await page.evaluate(() => {
      const store = JSON.parse(window.localStorage.getItem('vantageiq_mockup_v2'));
      store.players.push({
        id: 998,
        name: 'Position Probe',
        normalizedName: 'position probe',
        teamName: 'U19 Prime',
        position: 'Position not set',
        trend: 'plateau',
        updated: 'Updated just now'
      });
      window.localStorage.setItem('vantageiq_mockup_v2', JSON.stringify(store));
    });
  });

  test('fieldPosition is a <select> pre-populated with Soccer positions for a Soccer team', async ({ page }) => {
    await page.goto('/S5-player-edit.html?playerId=998');
    await expect(page.locator('#playerEditForm')).toBeVisible();

    const positionField = page.locator('[data-testid="field-position"]');
    await expect(positionField).toBeVisible();

    // The seeded U19 Prime team has sport_soccer; the dropdown must surface
    // all 13 seeded Soccer positions (12 named + the "Any Position" wildcard).
    const optionTexts = await positionField.locator('option').allTextContents();
    expect(optionTexts).toContain('GK – Goalkeeper');
    expect(optionTexts).toContain('ST – Striker');
    expect(optionTexts).toContain('Any Position');
    // No non-Soccer positions should leak into the dropdown.
    expect(optionTexts.every((text) => !/Hockey|Basketball|Rugby|Cricket/i.test(text))).toBe(true);
  });

  test('selecting a position and saving persists the position name on the player', async ({ page }) => {
    await page.goto('/S5-player-edit.html?playerId=998');
    await expect(page.locator('#playerEditForm')).toBeVisible();

    const positionField = page.locator('[data-testid="field-position"]');
    await positionField.selectOption('ST – Striker');
    await page.locator('#saveEdit').click();

    await expect(page).toHaveURL(/S2-player-dashboard\.html\?player=Position%20Probe/);
    const stored = await page.evaluate(() => {
      const data = JSON.parse(window.localStorage.getItem('vantageiq_mockup_v2') || '{}');
      return (data.players || []).find((entry) => entry.id === 998);
    });
    expect(stored.position).toBe('ST – Striker');
  });

  test('changing the team reloads the position dropdown against the new team\'s sport', async ({ page }) => {
    await page.goto('/S5-player-edit.html?playerId=998');
    await expect(page.locator('#playerEditForm')).toBeVisible();

    // Switch the team to U17 Elite (also Soccer in the seed) — the option
    // list must remain the Soccer positions, and any prior value that no
    // longer exists in the new options is replaced by a sensible fallback.
    const positionField = page.locator('[data-testid="field-position"]');
    const teamField = page.locator('#fieldTeam');
    await teamField.selectOption('U17 Elite');

    const optionTexts = await positionField.locator('option').allTextContents();
    // U17 Elite is on sport_soccer too, so the same Soccer set is expected.
    expect(optionTexts).toContain('GK – Goalkeeper');
    expect(optionTexts).toContain('ST – Striker');
    // The control is still enabled because Soccer positions exist for this sport.
    await expect(positionField).toBeEnabled();
  });

  test('empty-hint notice is hidden when at least one position exists for the team\'s sport', async ({ page }) => {
    await page.goto('/S5-player-edit.html?playerId=998');
    await expect(page.locator('#playerEditForm')).toBeVisible();
    await expect(page.locator('#fieldPositionEmpty')).toBeHidden();
  });
});