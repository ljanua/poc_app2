const { test, expect } = require('@playwright/test');

async function loginAsCoach(page) {
  await page.goto('/S0-login.html');
  await page.evaluate(() => window.localStorage.removeItem('vantageiq_mockup_v2'));
  await page.fill('#email', 'joao@vantageiq.club');
  await page.fill('#password', 'SecurePass123');
  await page.locator('#loginForm button[type="submit"]').click();
  await expect(page).toHaveURL(/S1-player-list\.html|S1-player-list$/);
}

async function createShareForPlayablePlayer(page) {
  return page.evaluate(() => {
    const players = window.MockupApi.listPlayers({ teamName: 'all' }) || [];
    for (let i = 0; i < players.length; i++) {
      const target = players[i];
      const clips = window.MockupApi.listClips({ playerId: target.id }) || [];
      const playable = clips.some(function (clip) {
        return Boolean(window.MockupApi.resolveClipMediaSource(clip));
      });
      if (!playable) {
        continue;
      }
      const created = window.MockupApi.createPlayerShare(target.id);
      if (!created || created.status !== 200 || !created.data) {
        return { skipped: false, error: created };
      }
      return {
        skipped: false,
        playerId: target.id,
        playerName: target.name,
        token: created.data.token,
        hasPlayableClip: true
      };
    }
    if (!players.length) {
      return { skipped: true, reason: 'no players' };
    }
    return { skipped: true, reason: 'no player with playable clip media' };
  });
}

// Serial so create/revoke on the same player cannot race other guest-share specs.
test.describe.configure({ mode: 'serial' });

test.describe('S2/S6 guest share (backend)', () => {
  test('coach creates share; guest loads read-only; revoke kills access', async ({ page, browser }) => {
    await loginAsCoach(page);

    const setup = await createShareForPlayablePlayer(page);

    if (setup.skipped) {
      test.skip(true, setup.reason || 'skipped');
      return;
    }
    expect(setup.error, JSON.stringify(setup.error)).toBeUndefined();
    expect(setup.token).toBeTruthy();

    await page.goto('/S2-player-dashboard.html?player=' + encodeURIComponent(setup.playerName));
    await expect(page.getByTestId('share-link-button')).toBeVisible();

    const guest = await browser.newContext();
    const guestPage = await guest.newPage();
    await guestPage.goto('/S2-player-dashboard.html?share=' + encodeURIComponent(setup.token));
    await expect(guestPage.locator('#dashboardHeaderMeta')).toHaveText('Guest View');
    await expect(guestPage.locator('#dashboardPlayerName')).toHaveText(setup.playerName);
    await expect(guestPage.locator('#editPlayerLink')).toHaveAttribute('aria-disabled', 'true');

    const revoke = await page.evaluate((playerId) => {
      return window.MockupApi.revokePlayerShare(playerId);
    }, setup.playerId);
    expect(revoke.status).toBe(200);
    expect(revoke.data && revoke.data.revoked).toBe(true);

    const afterRevoke = await guestPage.evaluate((token) => {
      return window.MockupApi.getDashboardByShareToken(token);
    }, setup.token);
    expect(afterRevoke).toBeNull();

    await guestPage.goto('/S2-player-dashboard.html?share=' + encodeURIComponent(setup.token));
    await expect(guestPage.locator('#dashboardNotice')).toBeVisible();
    await expect(guestPage.locator('.player-summary')).toBeHidden();

    await guest.close();
  });

  test('View Results opens guest S6; filters locked; Back keeps share; revoke closes', async ({ page, browser }) => {
    await loginAsCoach(page);
    const setup = await createShareForPlayablePlayer(page);

    if (setup.skipped) {
      test.skip(true, setup.reason || 'skipped');
      return;
    }
    expect(setup.error, JSON.stringify(setup.error)).toBeUndefined();
    expect(setup.token).toBeTruthy();

    const guest = await browser.newContext();
    const guestPage = await guest.newPage();
    await guestPage.goto('/S2-player-dashboard.html?share=' + encodeURIComponent(setup.token));
    await expect(guestPage.locator('#dashboardHeaderMeta')).toHaveText('Guest View');
    await expect(guestPage.locator('#dashboardNotice')).toBeHidden();

    // View Results lives inside the collapsed Video Assessments section.
    const videoToggle = guestPage.getByTestId('dashboard-section-toggle-video-assessments');
    await expect(videoToggle).toBeVisible();
    await videoToggle.click();

    const viewResults = guestPage.getByTestId('view-results-link');
    await expect(viewResults).toBeVisible();
    await expect(viewResults).not.toHaveAttribute('aria-disabled', 'true');
    const href = await viewResults.getAttribute('href');
    expect(href).toContain('share=');
    expect(href).toMatch(/S6-assessment-list/);

    await viewResults.click();
    await expect(guestPage).toHaveURL(new RegExp('S6-assessment-list\\.html.*share='));
    await expect(guestPage.locator('#roleMeta')).toHaveText('Guest View');
    await expect(guestPage.getByTestId('guest-share-unavailable')).toHaveCount(0);

    await expect(guestPage.getByTestId('preselected-player-filter')).toBeDisabled();
    await expect(guestPage.locator('#teamFilter')).toBeDisabled();

    const cards = guestPage.locator('.result-card');
    await expect(cards.first()).toBeVisible();
    const cardCount = await cards.count();
    for (let i = 0; i < cardCount; i++) {
      await expect(cards.nth(i).locator('.result-player')).toHaveText(setup.playerName);
    }

    const playButton = guestPage.getByTestId('clip-play-button').first();
    await playButton.click();
    await expect(guestPage.getByTestId('clip-player-modal')).toHaveClass(/open/);
    await expect.poll(async () => {
      return guestPage.getByTestId('clip-player-video').getAttribute('src');
    }).toContain('/share/');
    const videoSrc = await guestPage.getByTestId('clip-player-video').getAttribute('src');
    expect(videoSrc || '').toContain('/media');
    await guestPage.getByTestId('clip-player-close').click();

    const back = guestPage.getByTestId('back-link').first();
    await expect(back).toBeVisible();
    const backHref = await back.getAttribute('href');
    expect(backHref).toContain('share=');
    expect(backHref).toMatch(/S2-player-dashboard/);
    await back.click();
    await expect(guestPage).toHaveURL(new RegExp('S2-player-dashboard\\.html.*share='));
    await expect(guestPage.locator('#dashboardHeaderMeta')).toHaveText('Guest View');

    await guestPage.goto('/S6-assessment-list.html?share=' + encodeURIComponent(setup.token));
    await expect(guestPage.locator('.bottom-nav a.nav-item').first()).toHaveAttribute('aria-disabled', 'true');

    const revoke = await page.evaluate((playerId) => {
      return window.MockupApi.revokePlayerShare(playerId);
    }, setup.playerId);
    expect(revoke.status).toBe(200);

    await guestPage.goto('/S6-assessment-list.html?share=' + encodeURIComponent(setup.token));
    await expect(guestPage.getByTestId('guest-share-unavailable')).toBeVisible();
    await expect(guestPage.locator('.result-card')).toHaveCount(0);

    await guest.close();
  });
});
