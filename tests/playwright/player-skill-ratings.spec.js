const { test, expect } = require('@playwright/test');

// Feature 015/016 — S2/S5 player skill ratings with Any Position baseline.

test.describe('S2/S5 Player Skill Ratings', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      window.__USE_MOCK_LOCAL__ = true;
      window.__USE_BACKEND__ = false;
    });

    await page.goto('/S0-login.html');
    await page.evaluate(() => {
      window.localStorage.removeItem('vantageiq_mockup_v2');
      window.localStorage.removeItem('vantageiq_s2_dashboard_sections');
    });
    await page.fill('#email', 'joao@vantageiq.club');
    await page.fill('#password', 'SecurePass123');
    await page.locator('#loginForm button[type="submit"]').click();
    await expect(page).toHaveURL(/S1-player-list\.html|S1-player-list$/);

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

  test('S2 shows Any Position then ST role skills', async ({ page }) => {
    await page.goto('/S2-player-dashboard.html?player=Skill%20Rating%20Probe');
    await page.getByTestId('dashboard-section-toggle-skill-ratings').click();
    await expect(page.getByTestId('skill-ratings-section')).toBeVisible();
    await expect(page.getByTestId('skill-ratings-any-section')).toBeVisible();
    await expect(page.getByTestId('skill-ratings-role-section')).toBeVisible();

    await expect(page.getByTestId('skill-rating-row-s_passing')).toBeVisible();
    await expect(page.getByTestId('skill-rating-row-s_finishing')).toBeVisible();
    // Ball Control overlaps Any Position + ST — listed only under Any.
    await expect(page.getByTestId('skill-rating-row-s_ball_control')).toHaveCount(1);
    await expect(page.getByTestId('skill-rating-not-rated').first()).toBeVisible();
  });

  test('S5 edit + same-save position change preserves Any Position rating', async ({ page }) => {
    await page.goto('/S5-player-edit.html?playerId=997');
    await expect(page.locator('#playerEditForm')).toBeVisible();
    await expect(page.getByTestId('skill-ratings-any-section')).toBeVisible();
    await expect(page.getByTestId('skill-ratings-role-section')).toBeVisible();

    await page.getByTestId('skill-rating-toggle-s_passing').check();
    await page.getByTestId('skill-rating-value-s_passing').fill('70');
    await page.getByTestId('skill-rating-value-s_passing').blur();

    await page.getByTestId('skill-rating-toggle-s_finishing').check();
    await page.getByTestId('skill-rating-value-s_finishing').fill('78');
    await page.getByTestId('skill-rating-value-s_finishing').blur();

    await page.getByTestId('field-position').selectOption('GK – Goalkeeper');
    await page.locator('#saveEdit').click();
    await expect(page).toHaveURL(/S2-player-dashboard\.html\?player=Skill%20Rating%20Probe/);

    await page.getByTestId('dashboard-section-toggle-skill-ratings').click();
    await expect(page.getByTestId('skill-rating-value-s_passing')).toHaveText('70%');
    await expect(page.getByTestId('skill-rating-row-s_shot_stopping')).toBeVisible();
    await expect(page.getByTestId('skill-rating-row-s_finishing')).toHaveCount(0);
    await expect(page.getByTestId('skill-ratings-role-section')).toBeVisible();
  });

  test('player with unset position still shows Any Position skills', async ({ page }) => {
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
    await page.getByTestId('dashboard-section-toggle-skill-ratings').click();
    await expect(page.getByTestId('skill-ratings-any-section')).toBeVisible();
    await expect(page.getByTestId('skill-rating-row-s_passing')).toBeVisible();
    await expect(page.getByTestId('skill-ratings-role-section')).toBeHidden();
    await expect(page.getByTestId('skill-ratings-empty')).toBeHidden();
  });
});
