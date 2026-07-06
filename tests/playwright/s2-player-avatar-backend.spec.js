const { test, expect } = require('@playwright/test');

// Regression: avatar upload used to fail with 400 "Player name must be 2-60
// chars..." because MockupApi.updatePlayerAvatar PATCHed only {avatarUrl} and
// the backend's parseUpdateProfilePayload rejects payloads missing name /
// teamName / trend. The fix merges the existing player profile into the PATCH
// body so the contract (required: name, teamName, position, trend) is honored.
//
// These tests run against the live backend (no __USE_BACKEND__ = false) so
// they catch the round-trip through scripts/serve-mockup.js.

const TINY_JPEG_DATA_URL = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAAEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQH/2wBDAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQH/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwA/8A//2Q==';

async function loginAsCoach(page) {
  await page.goto('/S0-login.html');
  await page.evaluate(() => window.localStorage.removeItem('vantageiq_mockup_v2'));
  await page.fill('#email', 'joao@vantageiq.club');
  await page.fill('#password', 'SecurePass123');
  await page.locator('#loginForm button[type="submit"]').click();
  await expect(page).toHaveURL(/S1-player-list\.html|S1-player-list$/);
}

test.describe('S2 Player avatar upload against backend', () => {
  test.beforeEach(async ({ page }) => {
    // Explicitly do NOT force offline mode — these tests exercise the
    // PATCH /api/v1/players/{id} round-trip through the live backend.
    await loginAsCoach(page);
  });

  test('uploadPlayerAvatar persists the avatar without validation errors', async ({ page }) => {
    const result = await page.evaluate(async (dataUrl) => {
      const players = await window.MockupApi.listPlayers({ teamName: 'all' });
      const target = (players || [])[0];
      if (!target) {
        return { skipped: true, reason: 'no players seeded in backend' };
      }
      // Build a minimal File-like object the client canvas code can read.
      const bytes = Uint8Array.from(atob(dataUrl.split(',')[1]), (c) => c.charCodeAt(0));
      const file = new File([bytes], 'avatar.jpg', { type: 'image/jpeg' });
      return await window.MockupApi.uploadPlayerAvatar(target.id, file);
    }, TINY_JPEG_DATA_URL);

    if (result && result.skipped) {
      test.skip(true, result.reason);
    }

    expect(result.error, `upload returned an error: ${result.error}`).toBeUndefined();
    expect(result.status, `status should be 200, got ${result.status}`).toBe(200);
    expect(result.avatarUrl).toMatch(/^data:image\/jpeg/);
  });

  test('uploaded avatar URL is readable back through getPlayerProfile', async ({ page }) => {
    const result = await page.evaluate(async (dataUrl) => {
      const players = await window.MockupApi.listPlayers({ teamName: 'all' });
      const target = (players || [])[0];
      if (!target) {
        return { skipped: true, reason: 'no players seeded in backend' };
      }
      const bytes = Uint8Array.from(atob(dataUrl.split(',')[1]), (c) => c.charCodeAt(0));
      const file = new File([bytes], 'avatar.jpg', { type: 'image/jpeg' });
      const upload = await window.MockupApi.uploadPlayerAvatar(target.id, file);
      const profile = await window.MockupApi.getPlayerProfile(target.id);
      return { upload, profile, targetId: target.id };
    }, TINY_JPEG_DATA_URL);

    if (result && result.skipped) {
      test.skip(true, result.reason);
    }

    expect(result.upload.error).toBeUndefined();
    expect(result.profile && result.profile.data && result.profile.data.player).toBeTruthy();
    expect(result.profile.data.player.avatarUrl).toMatch(/^data:image\/jpeg/);
  });
});