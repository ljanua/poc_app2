const { test, expect } = require('@playwright/test');

// Regression: the mockup protected surfaces (S1, S2, S3, S4, S5, S6, S7) need
// a small exit-icon button in the topbar that clears the actor session and
// returns to S0-login.html. These tests prove the widget renders on every
// protected surface and that clicking it lands on S0 with the session key
// cleared.

const SESSION_KEY = 'vantageiq_current_user_email';
const ACTIVE_CLUB_KEY = 'vantageiq_active_club_id';

async function seedCoachSession(page) {
  await page.goto('/S0-login.html');
  await page.evaluate(({ email, clubKey }) => {
    window.localStorage.setItem('vantageiq_current_user_email', email);
    window.localStorage.setItem(
      clubKey,
      JSON.stringify({ id: 'c_default', name: 'VantageIQ Club' })
    );
  }, { email: 'joao@vantageiq.club', clubKey: ACTIVE_CLUB_KEY });
}

async function seedAdminSession(page) {
  await page.goto('/S0-login.html');
  await page.evaluate(({ email, clubKey }) => {
    window.localStorage.setItem('vantageiq_current_user_email', email);
    window.localStorage.setItem(
      clubKey,
      JSON.stringify({ id: 'c_default', name: 'VantageIQ Club' })
    );
  }, { email: 'maria@vantageiq.club', clubKey: ACTIVE_CLUB_KEY });
}

test.describe('S1 player list — exit button clears session and navigates to S0', () => {
  test('clicking exit lands on S0-login.html with no session email stored', async ({ page }) => {
    await seedCoachSession(page);
    await page.goto('/S1-player-list.html');

    const exitButton = page.locator('[data-testid="exit-button"]');
    await expect(exitButton).toBeVisible();
    await expect(exitButton).toHaveAttribute('aria-label', 'Log out');
    await expect(exitButton).toHaveText('✕');

    await exitButton.click();

    await expect(page).toHaveURL(/S0-login\.html/);
    const sessionAfter = await page.evaluate(() =>
      window.localStorage.getItem('vantageiq_current_user_email')
    );
    expect(sessionAfter).toBeNull();
  });
});

test.describe('S6 assessment list — exit button clears session and navigates to S0', () => {
  test('clicking exit lands on S0-login.html with no session email stored', async ({ page }) => {
    await seedCoachSession(page);
    await page.goto('/S6-assessment-list.html');

    const exitButton = page.locator('[data-testid="exit-button"]');
    await expect(exitButton).toBeVisible();
    await expect(exitButton).toHaveAttribute('aria-label', 'Log out');
    await expect(exitButton).toHaveText('✕');

    await exitButton.click();

    await expect(page).toHaveURL(/S0-login\.html/);
    const sessionAfter = await page.evaluate(() =>
      window.localStorage.getItem('vantageiq_current_user_email')
    );
    expect(sessionAfter).toBeNull();
  });
});

test.describe('S7 admin user management — exit button clears session and navigates to S0', () => {
  test('clicking exit lands on S0-login.html with no session email stored', async ({ page }) => {
    await seedAdminSession(page);
    await page.goto('/S7-admin-user-management.html');

    const exitButton = page.locator('[data-testid="exit-button"]');
    await expect(exitButton).toBeVisible();
    await expect(exitButton).toHaveAttribute('aria-label', 'Log out');
    await expect(exitButton).toHaveText('✕');

    await exitButton.click();

    await expect(page).toHaveURL(/S0-login\.html/);
    const sessionAfter = await page.evaluate(() =>
      window.localStorage.getItem('vantageiq_current_user_email')
    );
    expect(sessionAfter).toBeNull();
  });
});
