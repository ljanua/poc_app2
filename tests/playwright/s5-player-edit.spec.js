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
    // Always sign in as coach joao@vantageiq.club before every test in this suite.
    await page.fill('#email', 'joao@vantageiq.club');
    await page.fill('#password', 'SecurePass123');
    await page.locator('#loginForm button[type="submit"]').click();
    await expect(page).toHaveURL(/S1-player-list\.html|S1-player-list$/);
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
    // No stats yet: rating and score controls show toggles off and inputs disabled.
    await expect(page.locator('#fieldTotalMinutes')).toHaveValue('0');
    await expect(page.locator('#ctrlCurrentLevel .ctrl-toggle')).not.toBeChecked();
    await expect(page.locator('#ctrlCurrentLevel .ctrl-box')).toBeDisabled();
    await expect(page.locator('#ctrlAverageScore .ctrl-toggle')).not.toBeChecked();
    await expect(page.locator('#ctrlAverageScore .ctrl-box')).toBeDisabled();
  });

  test('saving stats clears the no-stats notice and shows full dashboard on return', async ({ page }) => {
    await page.goto('/S5-player-edit.html?playerId=999');
    await expect(page.locator('#playerEditForm')).toBeVisible();

    await page.locator('#fieldGrowthStatus').selectOption('on_track');
    await page.locator('#ctrlCurrentLevel .ctrl-toggle').check();
    await page.locator('#ctrlCurrentLevel .ctrl-box').fill('80');
    await page.locator('#ctrlFitness .ctrl-toggle').check();
    await page.locator('#ctrlFitness .ctrl-box').fill('75');
    await page.locator('#ctrlSkillProgress .ctrl-toggle').check();
    await page.locator('#ctrlSkillProgress .ctrl-box').fill('82');
    await page.locator('#fieldTotalMinutes').fill('120');
    await page.locator('#fieldAppearances').fill('4');
    await page.locator('#fieldRecentAvg').fill("30'");
    await page.locator('#ctrlAverageScore .ctrl-toggle').check();
    await page.locator('#ctrlAverageScore .ctrl-box').fill('7.5');
    await page.locator('#ctrlLastMatchScore .ctrl-toggle').check();
    await page.locator('#ctrlLastMatchScore .ctrl-box').fill('8');
    await page.locator('#fieldLastMatchSummary').fill('Sharp movement off the ball.');

    await page.locator('#saveEdit').click();

    await expect(page).toHaveURL(/S2-player-dashboard\.html\?player=Rookie%20Carter/);
    await expect(page.locator('#dashboardPlayerName')).toHaveText('Rookie Carter');

    // The no-stats notice is gone and every stats section title is visible now.
    await expect(page.locator('#noStatsNotice')).toBeHidden();
    await expect(page.getByText('Development Progress')).toBeVisible();
    await expect(page.getByText('Match Time History')).toBeVisible();
    await expect(page.getByText('Recent Performance')).toBeVisible();

    await page.getByTestId('dashboard-section-toggle-development-progress').click();
    await page.getByTestId('dashboard-section-toggle-match-time').click();
    await page.getByTestId('dashboard-section-toggle-recent-performance').click();

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

  test('toggling a rating on seeds midpoint (50), not zero (U1)', async ({ page }) => {
    await page.goto('/S5-player-edit.html?playerId=999');
    const toggle = page.locator('#ctrlCurrentLevel .ctrl-toggle');
    const box = page.locator('#ctrlCurrentLevel .ctrl-box');
    await expect(box).toBeDisabled();
    await toggle.check();
    await expect(box).toBeEnabled();
    const v = await box.inputValue();
    expect(Number(v)).toBeGreaterThan(0);
  });

  test('filling the rating box syncs the slider value (AE1)', async ({ page }) => {
    await page.goto('/S5-player-edit.html?playerId=999');
    await page.locator('#ctrlCurrentLevel .ctrl-toggle').check();
    const slider = page.locator('#ctrlCurrentLevel .ctrl-slider');
    const box = page.locator('#ctrlCurrentLevel .ctrl-box');
    await box.fill('75');
    const sliderVal = await slider.inputValue();
    expect(Number(sliderVal)).toBe(75);
  });

  test('out-of-range rating clamps to upper bound on blur (AE5)', async ({ page }) => {
    await page.goto('/S5-player-edit.html?playerId=999');
    await page.locator('#ctrlCurrentLevel .ctrl-toggle').check();
    const box = page.locator('#ctrlCurrentLevel .ctrl-box');
    await box.fill('140');
    await box.blur();
    await expect(box).toHaveValue('100');
  });

  test('rating set to 0 with toggle on serializes as "0%" not null (AE3)', async ({ page }) => {
    await page.goto('/S5-player-edit.html?playerId=999');
    await page.locator('#ctrlCurrentLevel .ctrl-toggle').check();
    const box = page.locator('#ctrlCurrentLevel .ctrl-box');
    await box.fill('0');
    await box.blur();
    await page.locator('#saveEdit').click();
    const saved = await page.evaluate(() => {
      const store = JSON.parse(window.localStorage.getItem('vantageiq_mockup_v2'));
      return (store.playerStats && store.playerStats[999]) ? store.playerStats[999].currentLevel : undefined;
    });
    expect(saved).toBe('0%');
  });

  test('score control clears to null when toggle is off (AE4)', async ({ page }) => {
    await page.goto('/S5-player-edit.html?playerId=999');
    // Enable score and fill a value, then clear it via the toggle
    await page.locator('#ctrlAverageScore .ctrl-toggle').check();
    await page.locator('#ctrlAverageScore .ctrl-box').fill('7.5');
    await page.locator('#ctrlAverageScore .ctrl-toggle').uncheck();
    await page.locator('#saveEdit').click();
    const saved = await page.evaluate(() => {
      const store = JSON.parse(window.localStorage.getItem('vantageiq_mockup_v2'));
      return (store.playerStats && store.playerStats[999]) ? store.playerStats[999].averageScore : 'missing';
    });
    expect(saved).toBeNull();
  });

  test('saving without any rating recorded keeps the no-stats notice on S2 (R8)', async ({ page }) => {
    await page.goto('/S5-player-edit.html?playerId=999');
    await expect(page.locator('#playerEditForm')).toBeVisible();
    // Save with all rating toggles off (no development ratings recorded)
    await page.locator('#saveEdit').click();
    await expect(page).toHaveURL(/S2-player-dashboard\.html\?player=Rookie%20Carter/);
    await expect(page.locator('#noStatsNotice')).toBeVisible();
  });

  test('save with score but no rating keeps the no-stats notice (score-only edge case)', async ({ page }) => {
    await page.goto('/S5-player-edit.html?playerId=999');
    await expect(page.locator('#playerEditForm')).toBeVisible();
    await page.locator('#ctrlAverageScore .ctrl-toggle').check();
    await page.locator('#ctrlAverageScore .ctrl-box').fill('7.5');
    await page.locator('#saveEdit').click();
    await expect(page).toHaveURL(/S2-player-dashboard\.html\?player=Rookie%20Carter/);
    // Score recorded but no development ratings: notice stays visible
    await expect(page.locator('#noStatsNotice')).toBeVisible();
  });

  test('saving birth month and year makes the S2 dashboard show the derived age', async ({ page }) => {
    await page.goto('/S5-player-edit.html?playerId=999');
    await expect(page.locator('#playerEditForm')).toBeVisible();
    await page.selectOption('#fieldBirthMonth', '3');
    await page.fill('#fieldBirthYear', '2005');
    await page.locator('#saveEdit').click();
    await expect(page).toHaveURL(/S2-player-dashboard\.html\?player=Rookie%20Carter/);
    // The S2 meta line picks up the derived age from the offline store.
    const meta = await page.locator('#dashboardPlayerMeta').textContent();
    expect(meta).toMatch(/Age \d+/);
  });

  test('saving a partial birth pair (only month) shows a validation error and does not navigate', async ({ page }) => {
    await page.goto('/S5-player-edit.html?playerId=999');
    await expect(page.locator('#playerEditForm')).toBeVisible();
    await page.selectOption('#fieldBirthMonth', '3');
    // Clear the year (a previous test may have left a value here) so we
    // exercise the strict-pair rejection with only month set.
    await page.fill('#fieldBirthYear', '');
    await page.locator('#saveEdit').click();
    // The error notice appears and the URL has not changed.
    await expect(page.locator('#editFormError')).toBeVisible();
    await expect(page.locator('#editFormError')).toContainText(/set together|blank/i);
    expect(page.url()).toContain('S5-player-edit.html');
  });

  test('clearing both birth fields removes the age segment from the S2 meta line', async ({ page }) => {
    // Seed a birth date via the store so we have something to clear.
    await page.goto('/S2-player-dashboard.html?player=Rookie%20Carter');
    await page.evaluate(() => {
      const store = JSON.parse(window.localStorage.getItem('vantageiq_mockup_v2'));
      const player = store.players.find((p) => p.id === 999);
      player.birthMonth = 6;
      player.birthYear = 1990;
      window.localStorage.setItem('vantageiq_mockup_v2', JSON.stringify(store));
    });

    await page.goto('/S5-player-edit.html?playerId=999');
    await expect(page.locator('#fieldBirthMonth')).toHaveValue('6');
    await expect(page.locator('#fieldBirthYear')).toHaveValue('1990');

    await page.selectOption('#fieldBirthMonth', '');
    await page.fill('#fieldBirthYear', '');
    await page.locator('#saveEdit').click();
    await expect(page).toHaveURL(/S2-player-dashboard\.html\?player=Rookie%20Carter/);
    // The S2 meta line omits the "Age" segment once the birth date is cleared.
    const meta = await page.locator('#dashboardPlayerMeta').textContent();
    expect(meta).not.toMatch(/Age \d+/);
  });
});
