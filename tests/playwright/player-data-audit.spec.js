const { test, expect } = require('@playwright/test');

async function loginAsCoach(page) {
  await page.goto('/S0-login.html');
  await page.evaluate(() => window.localStorage.removeItem('vantageiq_mockup_v2'));
  await page.fill('#email', 'joao@vantageiq.club');
  await page.fill('#password', 'SecurePass123');
  await page.locator('#loginForm button[type="submit"]').click();
  await expect(page).toHaveURL(/S1-player-list\.html|S1-player-list$/);
}

test.describe('S2 player change history (Feature 036)', () => {
  test('coach can open Change History section', async ({ page }) => {
    await loginAsCoach(page);
    const playerName = await page.evaluate(() => {
      const players = window.MockupApi.listPlayers({ teamName: 'all' }) || [];
      return players[0] ? players[0].name : null;
    });
    if (!playerName) {
      test.skip(true, 'no players');
      return;
    }

    await page.goto('/S2-player-dashboard.html?player=' + encodeURIComponent(playerName));
    const section = page.getByTestId('change-history-section');
    await expect(section).toBeVisible();
    await page.getByTestId('dashboard-section-toggle-change-history').click();
    const emptyVisible = await page.getByTestId('change-history-empty').isVisible();
    const tableVisible = await page.getByTestId('change-history-table-wrap').isVisible();
    expect(emptyVisible || tableVisible).toBe(true);
  });

  test('guest share hides Change History', async ({ page, browser }) => {
    await loginAsCoach(page);
    const setup = await page.evaluate(() => {
      const players = window.MockupApi.listPlayers({ teamName: 'all' }) || [];
      const target = players[0];
      if (!target) {
        return { skipped: true };
      }
      const created = window.MockupApi.createPlayerShare(target.id);
      if (!created || created.status !== 200 || !created.data) {
        return { skipped: false, error: created };
      }
      return { skipped: false, token: created.data.token, playerId: target.id };
    });
    if (setup.skipped) {
      test.skip(true, 'no players');
      return;
    }
    expect(setup.error).toBeUndefined();

    const guest = await browser.newContext();
    const guestPage = await guest.newPage();
    await guestPage.goto('/S2-player-dashboard.html?share=' + encodeURIComponent(setup.token));
    await expect(guestPage.locator('#dashboardHeaderMeta')).toHaveText('Guest View');
    await expect(guestPage.getByTestId('change-history-section')).toBeHidden();
    await guest.close();

    await page.evaluate((playerId) => window.MockupApi.revokePlayerShare(playerId), setup.playerId);
  });
});
