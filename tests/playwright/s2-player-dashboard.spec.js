const { test, expect } = require('@playwright/test');

test.describe('S2 Player Development Dashboard', () => {
  test.beforeEach(async ({ page }) => {
    // Force the offline/local fallback client, matching the pattern used by
    // tests/playwright/s1-player-list.spec.js. Without this, these tests
    // depend on whether the machine running them happens to have
    // DATABASE_URL configured for scripts/serve-mockup.js: with it configured
    // (as in local dev), requests hit the real backend unauthenticated (no
    // session email set here) and get a 403, which the dashboard cannot tell
    // apart from "unavailable" -- hiding the page instead of exercising the
    // seeded fixtures these tests assert against.
    await page.addInitScript(() => {
      window.__USE_MOCK_LOCAL__ = true;
      window.__USE_BACKEND__ = false;
    });

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

  test('shows real per-player metric change badges instead of static placeholders', async ({ page }) => {
    const currentLevelChange = page.locator('#metricCurrentLevelChange');
    const fitnessChange = page.locator('#metricFitnessChange');
    const skillChange = page.locator('#metricSkillChange');

    await expect(currentLevelChange).toBeVisible();
    await expect(fitnessChange).toBeVisible();
    await expect(skillChange).toBeVisible();

    // Default player (Lionel Messi) resolves through the offline/local fallback
    // client in CI (no DATABASE_URL configured), which mirrors the exact seeded
    // values used by the Postgres-backed path for this named profile.
    await expect(currentLevelChange).toHaveText(/Up 5%/);
    await expect(currentLevelChange).toHaveClass(/badge-improving/);
    await expect(fitnessChange).toHaveText(/Stable/);
    await expect(fitnessChange).toHaveClass(/badge-plateau/);
    await expect(skillChange).toHaveText(/Up 3%/);
    await expect(skillChange).toHaveClass(/badge-improving/);
  });

  test('provides actions to view results and submit clips', async ({ page }) => {
    await page.getByRole('link', { name: 'View Results' }).click();
    await expect(page).toHaveURL(/S6-assessment-list\.html|S6-assessment-list$/);

    await page.goto('/S2-player-dashboard.html');
    await page.getByRole('link', { name: /Submit New Clip|Submit a Clip/ }).first().click();
    await expect(page).toHaveURL(/S4-video-capture\.html|S4-video-capture$/);
  });

  test('shows the player card only, and never fabricated stats, for a player with no recorded stats', async ({ page }) => {
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

    await page.goto('/S2-player-dashboard.html?player=' + encodeURIComponent('Rookie Carter'));

    await expect(page.getByText('Player Development')).toBeVisible();
    await expect(page.locator('#dashboardPlayerName')).toHaveText('Rookie Carter');
    await expect(page.locator('#dashboardTeamChip')).toHaveText('U19 Prime');

    await expect(page.locator('#noStatsNotice')).toBeVisible();
    await expect(page.locator('#noStatsNotice')).toContainText('Performance metrics are not available yet.');

    await expect(page.getByText('Development Progress')).toBeHidden();
    await expect(page.getByText('Match Time History')).toBeHidden();
    await expect(page.getByText('Recent Performance')).toBeHidden();
    await expect(page.getByText('Video Assessments')).toBeHidden();

    // Never shows another player's borrowed numbers or narrative text.
    await expect(page.getByText('Pace was strong, timing can improve.')).toHaveCount(0);
    await expect(page.getByText('Confident execution under pressure.')).toHaveCount(0);

    // The final CTA row stays available even with no stats yet.
    await expect(page.getByRole('link', { name: 'Submit a Clip' })).toBeVisible();

    // Editing is still reachable for a no-stats player -- it is how the coach
    // records their first real stats.
    const editLink = page.locator('#editPlayerLink');
    await expect(editLink).toBeVisible();
    await expect(editLink).toHaveAttribute('href', /S5-player-edit\.html\?playerId=999/);
  });

  test('exposes an Edit Player link that targets the viewed player', async ({ page }) => {
    const editLink = page.locator('#editPlayerLink');
    await expect(editLink).toBeVisible();
    // Default player (Lionel Messi) has seed id 10 in the offline store.
    await expect(editLink).toHaveAttribute('href', /S5-player-edit\.html\?playerId=10/);
  });
});
