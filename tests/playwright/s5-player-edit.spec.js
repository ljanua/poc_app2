const { test, expect } = require('@playwright/test');

test.describe('S5 Edit Player', () => {
  test.beforeEach(async ({ page }) => {
    // Force the offline/local fallback client so the edit flow round-trips
    // against the seeded localStorage store regardless of whether the machine
    // running the tests has DATABASE_URL configured. Matches the pattern used
    // by tests/playwright/s2-player-dashboard.spec.js.
    await page.addInitScript(() => {
      window.__USE_MOCK_LOCAL__ = true;
      window.__USE_BACKEND__ = false;
    });

    await page.goto('/S0-login.html');
    await page.evaluate(() => window.localStorage.removeItem('vantageiq_mockup_v2'));
    // Seed the store, then add a player with no recorded stats to edit.
    await page.goto('/S2-player-dashboard.html');
    await expect(page.getByText('Player Development')).toBeVisible();
    await page.evaluate(() => {
      const store = JSON.parse(window.localStorage.getItem('vantageiq_mockup_v2'));
      store.players.push({
        id: 999,
        name: 'Rookie Carter',
        normalizedName: 'rookie carter',
        teamName: 'U19 Prime',
        position: 'Position not set',
        trend: 'plateau',
        updated: 'Updated just now'
      });
      window.localStorage.setItem('vantageiq_mockup_v2', JSON.stringify(store));
    });
  });

  test('shows a clear error state when no player is selected', async ({ page }) => {
    await page.goto('/S5-player-edit.html');
    await expect(page.locator('#editNotice')).toBeVisible();
    await expect(page.locator('#editNotice')).toContainText('No player was selected');
    await expect(page.locator('#playerEditForm')).toBeHidden();
  });

  test('populates the form from the profile for a no-stats player', async ({ page }) => {
    await page.goto('/S5-player-edit.html?playerId=999');

    await expect(page.locator('#playerEditForm')).toBeVisible();
    await expect(page.locator('#fieldName')).toHaveValue('Rookie Carter');
    await expect(page.locator('#fieldTeam')).toHaveValue('U19 Prime');
    await expect(page.locator('#fieldTrend')).toHaveValue('plateau');
    // No stats yet: numeric fields default to zero and text ratings are blank.
    await expect(page.locator('#fieldTotalMinutes')).toHaveValue('0');
    await expect(page.locator('#fieldCurrentLevel')).toHaveValue('');
    await expect(page.locator('#fieldAverageScore')).toHaveValue('');
  });

  test('saving stats clears the no-stats notice and shows full dashboard on return', async ({ page }) => {
    await page.goto('/S5-player-edit.html?playerId=999');
    await expect(page.locator('#playerEditForm')).toBeVisible();

    await page.locator('#fieldGrowthStatus').selectOption('on_track');
    await page.locator('#fieldCurrentLevel').fill('80%');
    await page.locator('#fieldFitness').fill('75%');
    await page.locator('#fieldSkillProgress').fill('82%');
    await page.locator('#fieldTotalMinutes').fill('120');
    await page.locator('#fieldAppearances').fill('4');
    await page.locator('#fieldRecentAvg').fill("30'");
    await page.locator('#fieldAverageScore').fill('7.5');
    await page.locator('#fieldLastMatchScore').fill('8');
    await page.locator('#fieldLastMatchSummary').fill('Sharp movement off the ball.');

    await page.locator('#saveEdit').click();

    await expect(page).toHaveURL(/S2-player-dashboard\.html\?player=Rookie%20Carter/);
    await expect(page.locator('#dashboardPlayerName')).toHaveText('Rookie Carter');

    // The no-stats notice is gone and every stats section is visible now.
    await expect(page.locator('#noStatsNotice')).toBeHidden();
    await expect(page.getByText('Development Progress')).toBeVisible();
    await expect(page.getByText('Match Time History')).toBeVisible();
    await expect(page.getByText('Recent Performance')).toBeVisible();

    await expect(page.locator('#metricCurrentLevel')).toHaveText('80%');
    await expect(page.locator('#metricMinutes')).toHaveText('120');
    await expect(page.locator('#metricAvgScore')).toHaveText('7.5');
    await expect(page.locator('#metricLastMatchSub')).toHaveText('Sharp movement off the ball.');
  });

  test('renaming a player carries the new name back to the dashboard', async ({ page }) => {
    await page.goto('/S5-player-edit.html?playerId=999');
    await expect(page.locator('#playerEditForm')).toBeVisible();

    await page.locator('#fieldName').fill('Rookie Carter Jr');
    await page.locator('#fieldTotalMinutes').fill('60');
    await page.locator('#saveEdit').click();

    await expect(page).toHaveURL(/player=Rookie%20Carter%20Jr/);
    await expect(page.locator('#dashboardPlayerName')).toHaveText('Rookie Carter Jr');
  });

  test('rejects a name that collides with another player', async ({ page }) => {
    await page.goto('/S5-player-edit.html?playerId=999');
    await expect(page.locator('#playerEditForm')).toBeVisible();

    // Lionel Messi already exists in the seeded store.
    await page.locator('#fieldName').fill('Lionel Messi');
    await page.locator('#saveEdit').click();

    await expect(page.locator('#editFormError')).toBeVisible();
    await expect(page.locator('#editFormError')).toContainText('already uses that name');
    // Stayed on the edit page rather than navigating away on failure.
    await expect(page).toHaveURL(/S5-player-edit\.html/);
  });
});
