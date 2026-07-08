const { test, expect } = require('@playwright/test');

// Feature 015 — S2/S5 player skill ratings.
// Offline mode so CI does not depend on DATABASE_URL / migration 018.

test.describe('S2/S5 Player Skill Ratings', () => {
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

    // Hydrate the offline store, then inject a Soccer ST player with real
    // stats so the Skill Ratings section is not hidden by missingDataMessage.
    await page.goto('/S2-player-dashboard.html');
    await expect(page.getByText('Player Development')).toBeVisible();

    await page.evaluate(() => {
      const store = JSON.parse(window.localStorage.getItem('vantageiq_mockup_v2'));
      store.players.push({
        id: 997,
        name: 'Skill Rating Probe',
        normalizedName: 'skill rating probe',
        teamName: 'U19 Prime',
        position: 'ST – Striker',
        trend: 'plateau',
        updated: 'Updated just now',
        birthMonth: 5,
        birthYear: 2005
      });
      store.playerStats = store.playerStats || {};
      store.playerStats[997] = {
        growthStatus: 'on_track',
        currentLevel: '80%',
        fitness: '75%',
        skillProgress: '70%',
        totalMinutes: 120,
        appearances: 4,
        recentAvg: "30'",
        averageScore: 7.5,
        trend: 'plateau',
        lastMatchScore: 8,
        lastMatchSummary: 'Solid shift.',
        clipSubmittedCount: 1,
        clipAssessedCount: 1,
        clipPendingCount: 0,
        missingDataMessage: null,
        currentLevelChange: null,
        fitnessChange: null,
        skillProgressChange: null
      };
      store.playerSkillRatings = store.playerSkillRatings || [];
      window.localStorage.setItem('vantageiq_mockup_v2', JSON.stringify(store));
    });
  });

  test('S2 shows ST skill rows as Not rated above Development Progress', async ({ page }) => {
    await page.goto('/S2-player-dashboard.html?player=Skill%20Rating%20Probe');
    await expect(page.getByTestId('skill-ratings-section')).toBeVisible();

    const section = page.getByTestId('skill-ratings-section');
    const progress = page.locator('.section-title', { hasText: 'Development Progress' });
    const sectionBox = await section.boundingBox();
    const progressBox = await progress.boundingBox();
    expect(sectionBox.y).toBeLessThan(progressBox.y);

    await expect(page.getByTestId('skill-ratings-table')).toBeVisible();
    await expect(page.getByTestId('skill-rating-row-s_finishing')).toBeVisible();
    await expect(page.getByTestId('skill-rating-row-s_heading')).toBeVisible();
    await expect(page.getByTestId('skill-rating-row-s_positioning')).toBeVisible();
    await expect(page.getByTestId('skill-rating-row-s_strength')).toBeVisible();
    await expect(page.getByTestId('skill-rating-row-s_ball_control')).toBeVisible();
    await expect(page.getByTestId('skill-rating-not-rated')).toHaveCount(5);
  });

  test('S5 edit + save updates S2 percentages; position change resets to GK skills', async ({ page }) => {
    await page.goto('/S5-player-edit.html?playerId=997');
    await expect(page.locator('#playerEditForm')).toBeVisible();
    await expect(page.getByTestId('skill-ratings-table')).toBeVisible();
    await expect(page.getByTestId('skill-rating-row-s_finishing')).toBeVisible();

    await page.getByTestId('skill-rating-toggle-s_finishing').check();
    await page.getByTestId('skill-rating-value-s_finishing').fill('78');
    await page.getByTestId('skill-rating-value-s_finishing').blur();

    await page.getByTestId('skill-rating-toggle-s_heading').check();
    await page.getByTestId('skill-rating-value-s_heading').fill('65');
    await page.getByTestId('skill-rating-value-s_heading').blur();

    await page.locator('#saveEdit').click();
    await expect(page).toHaveURL(/S2-player-dashboard\.html\?player=Skill%20Rating%20Probe/);

    await expect(page.getByTestId('skill-rating-value-s_finishing')).toHaveText('78%');
    await expect(page.getByTestId('skill-rating-value-s_heading')).toHaveText('65%');
    await expect(page.getByTestId('skill-rating-not-rated')).toHaveCount(3);

    await page.goto('/S5-player-edit.html?playerId=997');
    await expect(page.locator('#playerEditForm')).toBeVisible();
    await page.getByTestId('field-position').selectOption('GK – Goalkeeper');
    await page.locator('#saveEdit').click();
    await expect(page).toHaveURL(/S2-player-dashboard\.html\?player=Skill%20Rating%20Probe/);

    await expect(page.getByTestId('skill-rating-row-s_shot_stopping')).toBeVisible();
    await expect(page.getByTestId('skill-rating-row-s_reflexes')).toBeVisible();
    await expect(page.getByTestId('skill-rating-row-s_handling')).toBeVisible();
    await expect(page.getByTestId('skill-rating-row-s_positioning')).toBeVisible();
    await expect(page.getByTestId('skill-rating-row-s_aerial_control')).toBeVisible();
    await expect(page.getByTestId('skill-rating-row-s_finishing')).toHaveCount(0);
    await expect(page.getByTestId('skill-rating-not-rated')).toHaveCount(5);
  });

  test('player with no position shows the empty helper on S2 and S5', async ({ page }) => {
    await page.evaluate(() => {
      const store = JSON.parse(window.localStorage.getItem('vantageiq_mockup_v2'));
      store.players.push({
        id: 996,
        name: 'No Position Player',
        normalizedName: 'no position player',
        teamName: 'U19 Prime',
        position: 'Position not set',
        trend: 'plateau',
        updated: 'Updated just now'
      });
      store.playerStats = store.playerStats || {};
      store.playerStats[996] = {
        growthStatus: 'watch',
        currentLevel: '50%',
        fitness: '50%',
        skillProgress: '50%',
        totalMinutes: 10,
        appearances: 1,
        recentAvg: "10'",
        averageScore: 5,
        trend: 'plateau',
        lastMatchScore: 5,
        lastMatchSummary: 'Warm-up.',
        clipSubmittedCount: 1,
        clipAssessedCount: 1,
        clipPendingCount: 0,
        missingDataMessage: null,
        currentLevelChange: null,
        fitnessChange: null,
        skillProgressChange: null
      };
      window.localStorage.setItem('vantageiq_mockup_v2', JSON.stringify(store));
    });

    await page.goto('/S2-player-dashboard.html?player=No%20Position%20Player');
    await expect(page.getByTestId('skill-ratings-empty')).toBeVisible();
    await expect(page.getByTestId('skill-ratings-empty')).toContainText(
      'No skills are tracked for this player yet — pick a position in Edit Player (S5).'
    );

    await page.goto('/S5-player-edit.html?playerId=996');
    await expect(page.getByTestId('skill-ratings-empty')).toBeVisible();
  });
});
