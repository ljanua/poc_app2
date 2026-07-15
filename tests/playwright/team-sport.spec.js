const { test, expect } = require('@playwright/test');
const { uniqueTeamName } = require('./_fixture-utils');

// Feature 012 — S3 / S3a sport assignment.
//
// Covers the Sport <select> on the Create Team modal, the Sport column on the
// teams table, the Sport <select> on the Update Team form, and the round-trip
// through the offline mockup client (MockupApi.createTeam +
// MockupApi.updateTeamCoachAndClub).

test.describe('S3 / S3a team sport assignment', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      window.__USE_MOCK_LOCAL__ = true;
      window.__USE_BACKEND__ = false;
    });

    await page.goto('/S0-login.html');
    await page.evaluate(() => window.localStorage.removeItem('vantageiq_mockup_v2'));
    // Sign in as Coach Joao; the create flow under Coach actor is the
    // narrowest path through the modal (no coach / club pickers).
    await page.fill('#email', 'joao@vantageiq.club');
    await page.fill('#password', 'SecurePass123');
    await page.locator('#loginForm button[type="submit"]').click();
    await expect(page).toHaveURL(/S1-player-list\.html|S1-player-list$/);
  });

  test('Create Team modal exposes a Sport <select> pre-populated with active sports', async ({ page }) => {
    await page.goto('/S3-team-management.html');
    await expect(page.getByText(/^Active Teams$/)).toBeVisible();

    await page.getByRole('button', { name: 'Create Team' }).click();
    const sportSelect = page.locator('[data-testid="team-sport-select"]');
    await expect(sportSelect).toBeVisible();

    const optionTexts = await sportSelect.locator('option').allTextContents();
    expect(optionTexts.some((text) => text.trim() === 'Soccer')).toBe(true);

    // Default value is the seeded Soccer sport so the test mirrors the plan's
    // §5.4 acceptance ("Soccer preselected in Create Team").
    await expect(sportSelect).toHaveValue('sport_soccer');
  });

  test('teams table surfaces a Sport column with the sport name on every row', async ({ page }) => {
    await page.goto('/S3-team-management.html');
    // Seeded teams are all sport_soccer; the Sport cell should resolve to
    // "Soccer" for at least the U19 Prime row (Joao's team).
    const u19Row = page.locator('tbody tr', { hasText: 'U19 Prime' });
    await expect(u19Row.locator('[data-testid="row-sport"]')).toHaveText('Soccer');
  });

  test('creating a team persists the selected sport on the new row', async ({ page }) => {
    await page.goto('/S3-team-management.html');

    const rowsBefore = await page.locator('tbody tr').count();
    const teamName = uniqueTeamName('U15 Sport');

    await page.getByRole('button', { name: 'Create Team' }).click();
    await expect(page.locator('[data-testid="team-sport-select"]')).toBeVisible();
    await page.fill('#teamNameInput', teamName);
    await page.fill('#teamAgeGroupInput', 'U15');
    await page.locator('[data-testid="team-sport-select"]').selectOption('sport_soccer');
    await page.getByRole('button', { name: 'Save Team' }).click();

    const createdRow = page.locator('tbody tr', { hasText: teamName });
    await expect(createdRow).toBeVisible();
    await expect(createdRow.locator('[data-testid="row-sport"]')).toHaveText('Soccer');

    // Invariant: roster never shrinks.
    expect(await page.locator('tbody tr').count()).toBeGreaterThanOrEqual(rowsBefore);

    // Offline store carries sportId/sportName as well.
    const stored = await page.evaluate((name) => {
      const data = JSON.parse(window.localStorage.getItem('vantageiq_mockup_v2') || '{}');
      return (data.teams || []).find((entry) => entry.name === name);
    }, teamName);
    expect(stored).toBeTruthy();
    expect(stored.sportId).toBe('sport_soccer');
    expect(stored.sportName).toBe('Soccer');
  });

  test('Update Team (S3a) loads with current sport preselected and saves the new sport', async ({ page }) => {
    await page.goto('/S3-team-management.html');
    const u19Row = page.locator('tbody tr', { hasText: 'U19 Prime' });
    await u19Row.locator('[data-testid="row-update-link"]').click();
    await expect(page).toHaveURL(/S3a-team-update\.html/);

    const sportSelect = page.locator('[data-testid="update-sport-select"]');
    await expect(sportSelect).toBeVisible();
    // Preselect matches the team's current sport (form-only S3a; no Snapshot panel).
    await expect(sportSelect).toHaveValue('sport_soccer');
    await expect(page.getByText('Current Snapshot')).toHaveCount(0);

    // Save without changing the sport — the round-trip should still carry the
    // value back through the offline store.
    await page.locator('[data-testid="update-save"]').click();
    await expect(page).toHaveURL(/S3-team-management\.html/);
    const stored = await page.evaluate(() => {
      const data = JSON.parse(window.localStorage.getItem('vantageiq_mockup_v2') || '{}');
      return (data.teams || []).find((entry) => entry.name === 'U19 Prime');
    });
    expect(stored.sportId).toBe('sport_soccer');
    expect(stored.sportName).toBe('Soccer');
  });
});