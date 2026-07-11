const { test, expect } = require('@playwright/test');

test.describe('S4 Video Capture and Submission', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/S0-login.html');
    await page.evaluate(() => window.localStorage.removeItem('vantageiq_mockup_v2'));
    // Always sign in as coach joao@vantageiq.club before every test in this suite.
    await page.fill('#email', 'joao@vantageiq.club');
    await page.fill('#password', 'SecurePass123');
    await page.locator('#loginForm button[type="submit"]').click();
    await expect(page).toHaveURL(/S1-player-list\.html|S1-player-list$/);
    await page.goto('/S4-video-capture.html');
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
    await page.goto('/S4-video-capture.html?playerId=does-not-exist');
    await expect(page.locator('#player')).toHaveValue('');
  });
});
