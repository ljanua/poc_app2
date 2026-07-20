const { test, expect } = require('@playwright/test');
const { completeClubSelectIfNeeded } = require('./_fixture-utils');

test.describe('S4 Video Capture and Submission', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/S0-login.html');
    await page.evaluate(() => window.localStorage.removeItem('vantageiq_mockup_v2'));
    // Always sign in as coach joao@vantageiq.club before every test in this suite.
    await page.fill('#email', 'joao@vantageiq.club');
    await page.fill('#password', 'SecurePass123');
    await page.locator('#loginForm button[type="submit"]').click();
    await page.waitForURL(/S1-player-list|S0a-club-select/, { timeout: 20000 });
    await completeClubSelectIfNeeded(page);
    await page.goto('/S4-video-capture.html');
    await completeClubSelectIfNeeded(page);
    await expect(page.getByText('Submit a Clip')).toBeVisible();
  });

  test('validates required player and situation before submit', async ({ page }) => {
    let dialogShown = false;
    page.on('dialog', async (dialog) => {
      dialogShown = true;
      await dialog.dismiss();
    });

    await page.getByRole('button', { name: 'Submit for Assessment' }).click();

    const playerIsValid = await page.locator('#player').evaluate((el) => el.checkValidity());
    const situationIsValid = await page.locator('#situation').evaluate((el) => el.checkValidity());

    expect(playerIsValid).toBe(false);
    expect(situationIsValid).toBe(false);
    expect(dialogShown).toBe(false);
  });

  test('accepts file selection and submits valid clip flow', async ({ page }) => {
    page.on('dialog', (dialog) => dialog.accept());

    await page.locator('#fileInput').setInputFiles({
      name: 'training-clip.mp4',
      mimeType: 'video/mp4',
      buffer: Buffer.from('fake-video-content')
    });

    await expect(page.locator('#videoPreview')).toContainText('training-clip.mp4');

    await page.selectOption('#player', { label: 'Lionel Messi' });
    await page.fill('#situation', 'Penalty kick attempt under pressure');
    await page.getByRole('button', { name: 'Submit for Assessment' }).click();

    await expect(page.locator('#playerError')).not.toHaveClass(/show/);
    await expect(page.locator('#situationError')).not.toHaveClass(/show/);
  });

  test('auto-selects player from playerId query param', async ({ page }) => {
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
    // Offline seed Messi id is 10.
    await page.goto('/S4-video-capture.html?playerId=10');
    await expect(page.locator('#player')).toHaveValue('10');
  });

  test('leaves player unselected when playerId is missing or unknown', async ({ page }) => {
    await expect(page.locator('#player')).toHaveValue('');
    await expect(page.locator('input[name="skill"]')).toHaveCount(0);
    await expect(page.getByTestId('skill-focus-hint')).toBeVisible();
    await page.goto('/S4-video-capture.html?playerId=does-not-exist');
    await expect(page.locator('#player')).toHaveValue('');
    await expect(page.locator('input[name="skill"]')).toHaveCount(0);
  });

  test('skill focus lists Any Position skills for the selected player', async ({ page }) => {
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
    await page.goto('/S4-video-capture.html?playerId=10');
    await expect(page.locator('#player')).toHaveValue('10');
    await expect(page.getByTestId('skill-focus-hint')).toBeHidden();
    await expect(page.getByLabel('Ball Control')).toBeVisible();
    await expect(page.getByLabel('Passing')).toBeVisible();
    await expect(page.getByLabel('Game Awareness')).toBeVisible();
    await expect(page.getByLabel('Fitness')).toBeVisible();
    await expect(page.getByLabel('Speed')).toBeVisible();
    // Legacy hard-coded short codes are gone.
    await expect(page.locator('input[name="skill"][value="decision"]')).toHaveCount(0);
  });

  test('skill focus includes role-unique skills for a goalkeeper', async ({ page }) => {
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
    await page.evaluate(() => {
      const raw = window.localStorage.getItem('vantageiq_mockup_v2');
      const store = raw ? JSON.parse(raw) : null;
      if (!store) return;
      const messi = store.players.find((p) => p.id === 10 || p.id === '10');
      if (messi) {
        messi.position = 'GK – Goalkeeper';
      }
      window.localStorage.setItem('vantageiq_mockup_v2', JSON.stringify(store));
    });
    await page.goto('/S4-video-capture.html?playerId=10');
    await expect(page.getByLabel('Ball Control')).toBeVisible();
    await expect(page.getByLabel('Shot stopping')).toBeVisible();
    await expect(page.getByLabel('Reflexes')).toBeVisible();
  });

  test('changing player refreshes skill focus options', async ({ page }) => {
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
    await page.evaluate(() => {
      const raw = window.localStorage.getItem('vantageiq_mockup_v2');
      const store = raw ? JSON.parse(raw) : null;
      if (!store) return;
      const messi = store.players.find((p) => p.id === 10 || p.id === '10');
      const neymar = store.players.find((p) => String(p.name).toLowerCase() === 'neymar jr');
      if (messi) messi.position = 'GK – Goalkeeper';
      if (neymar) {
        neymar.teamName = 'U19 Prime';
        neymar.position = 'Any Position';
      }
      window.localStorage.setItem('vantageiq_mockup_v2', JSON.stringify(store));
    });
    await page.goto('/S4-video-capture.html');
    await page.selectOption('#player', { label: 'Lionel Messi' });
    await expect(page.getByLabel('Shot stopping')).toBeVisible();
    await page.selectOption('#player', { label: 'Neymar Jr' });
    await expect(page.getByLabel('Ball Control')).toBeVisible();
    await expect(page.getByLabel('Shot stopping')).toHaveCount(0);
  });

  test('analysis window defaults to 00:30 on both modes and rejects over 00:30', async ({ page }) => {
    await expect(page.getByTestId('analysis-window-fields')).toBeVisible();
    await expect(page.getByTestId('analysis-window-alert')).toContainText('30 seconds');
    await expect(page.getByTestId('start-mmss')).toHaveValue('00:00');
    await expect(page.getByTestId('duration-mmss')).toHaveValue('00:30');

    await page.getByTestId('source-mode-link').click();
    await expect(page.getByTestId('link-source-panel')).toBeVisible();
    await expect(page.getByTestId('upload-source-panel')).toBeHidden();
    await expect(page.getByTestId('analysis-window-fields')).toBeVisible();
    await expect(page.getByTestId('duration-mmss')).toHaveValue('00:30');

    await page.fill('#videoUrl', 'https://example.com/clip.mp4');
    await page.fill('#startMmSs', '00:10');
    await page.fill('#durationMmSs', '00:31');
    await page.selectOption('#player', { label: 'Lionel Messi' });
    await page.fill('#situation', 'Counter attack');
    await page.getByRole('button', { name: 'Submit for Assessment' }).click();
    await expect(page.locator('#videoError')).toHaveClass(/show/);
    await expect(page.locator('#videoError')).toContainText('00:30');
  });

  test('upload mode shows start/duration and rejects duration over 00:30', async ({ page }) => {
    await expect(page.getByTestId('upload-source-panel')).toBeVisible();
    await expect(page.getByTestId('analysis-window-alert')).toContainText('start point');
    await page.locator('#fileInput').setInputFiles({
      name: 'training-clip.mp4',
      mimeType: 'video/mp4',
      buffer: Buffer.from('fake-video-content')
    });
    await page.fill('#startMmSs', '00:05');
    await page.fill('#durationMmSs', '01:00');
    await page.selectOption('#player', { label: 'Lionel Messi' });
    await page.fill('#situation', 'Penalty kick');
    await page.getByRole('button', { name: 'Submit for Assessment' }).click();
    await expect(page.locator('#videoError')).toHaveClass(/show/);
    await expect(page.locator('#videoError')).toContainText('00:30');
  });

  test('Find player is off and disabled when the player has no photo', async ({ page }) => {
    await page.selectOption('#player', { label: 'Lionel Messi' });
    await expect(page.getByTestId('find-player-toggle')).toBeDisabled();
    await expect(page.getByTestId('find-player-toggle')).not.toBeChecked();
  });

  test('Find player defaults on when the selected player has an avatar', async ({ page }) => {
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
    await expect(page).toHaveURL(/S1-player-list/);
    await page.evaluate(() => {
      const raw = window.localStorage.getItem('vantageiq_mockup_v2');
      const store = raw ? JSON.parse(raw) : null;
      if (!store) return;
      const messi = store.players.find((p) => p.id === 10 || p.id === '10');
      if (messi) {
        messi.avatarUrl = 'data:image/png;base64,aaa';
      }
      store.playerAvatars = store.playerAvatars || {};
      store.playerAvatars['10'] = 'data:image/png;base64,aaa';
      window.localStorage.setItem('vantageiq_mockup_v2', JSON.stringify(store));
    });
    await page.goto('/S4-video-capture.html');
    await page.selectOption('#player', { label: 'Lionel Messi' });
    await expect(page.getByTestId('find-player-toggle')).toBeEnabled();
    await expect(page.getByTestId('find-player-toggle')).toBeChecked();
  });
});
