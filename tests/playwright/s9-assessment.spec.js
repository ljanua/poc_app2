const { test, expect } = require('@playwright/test');

test.describe('S9 Assessment', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      window.__USE_MOCK_LOCAL__ = true;
      window.__USE_BACKEND__ = false;
    });

    await page.goto('/S0-login.html');
    await page.evaluate(() => {
      window.localStorage.removeItem('vantageiq_mockup_v2');
    });
    await page.fill('#email', 'joao@vantageiq.club');
    await page.fill('#password', 'SecurePass123');
    await page.locator('#loginForm button[type="submit"]').click();
    await expect(page).toHaveURL(/S1-player-list\.html|S1-player-list$/);
  });

  test('S2 Assessment CTA sits after Edit and opens blank S9 form', async ({ page }) => {
    await page.goto('/S2-player-dashboard.html?player=' + encodeURIComponent('Lionel Messi'));
    await expect(page.getByText('Player Development')).toBeVisible();

    const edit = page.locator('#editPlayerLink');
    const assessment = page.getByTestId('assessment-link');
    await expect(edit).toBeVisible();
    await expect(assessment).toBeVisible();

    const orderOk = await page.evaluate(() => {
      const toolbar = document.querySelector('.toolbar-icon-actions');
      if (!toolbar) return false;
      const editEl = document.getElementById('editPlayerLink');
      const assessEl = document.querySelector('[data-testid="assessment-link"]');
      if (!editEl || !assessEl) return false;
      const children = Array.from(toolbar.children);
      return children.indexOf(editEl) < children.indexOf(assessEl);
    });
    expect(orderOk).toBe(true);

    await assessment.click();
    await expect(page).toHaveURL(/S9-assessment\.html/);
    await expect(page.getByTestId('assessment-form')).toBeVisible();

    const firstInput = page.locator('input[data-testid^="assessment-rating-"]').first();
    await expect(firstInput).toBeVisible();
    await expect(firstInput).toHaveValue('');
  });

  test('partial save updates live ratings and Assessment History', async ({ page }) => {
    await page.goto('/S2-player-dashboard.html?player=' + encodeURIComponent('Lionel Messi'));
    await page.getByTestId('assessment-link').click();
    await expect(page.getByTestId('assessment-form')).toBeVisible();

    await page.getByTestId('assessment-rating-s_ball_control').fill('91');
    await page.getByTestId('assessment-save').click();
    await expect(page).toHaveURL(/S2-player-dashboard\.html/);

    await page.getByTestId('dashboard-section-toggle-assessment-history').click();
    await expect(page.getByTestId('assessment-history-section')).toBeVisible();
    await expect(page.getByTestId('assessment-history-event').first()).toBeVisible();
    await expect(page.getByTestId('assessment-history-user').first()).toHaveText('joao@vantageiq.club');

    const live = await page.evaluate(() => {
      const profile = window.MockupApi.getPlayerProfile(10);
      const row = (profile.data.skillRatings || []).find(function (r) {
        return String(r.skillId) === 's_ball_control';
      });
      return row && row.rating;
    });
    expect(live).toBe(91);
  });
});
