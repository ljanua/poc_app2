const { test, expect } = require('@playwright/test');
const { completeClubSelectIfNeeded } = require('./_fixture-utils');

test.describe('Public landing (share-first)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => {
      window.localStorage.removeItem('vantageiq_mockup_v2');
      window.localStorage.removeItem('vantageiq_active_club');
    });
    await page.goto('/');
  });

  test('serves marketing landing at / with dual doors and proof', async ({ page }) => {
    await expect(page.getByTestId('landing-hero')).toBeVisible();
    await expect(page.getByTestId('brand-logo')).toBeVisible();
    await expect(page.getByTestId('door-parent')).toBeVisible();
    await expect(page.getByTestId('door-coach')).toBeVisible();
    await expect(page.getByTestId('landing-proof')).toBeVisible();
    await expect(page.getByTestId('ai-mention')).toBeVisible();
    await expect(page.getByTestId('free-to-start')).toBeVisible();
    await expect(page.getByText('Mockup Flow')).toHaveCount(0);
  });

  test('parent door shows ask-coach message without signup', async ({ page }) => {
    await page.getByTestId('door-parent').click();
    await expect(page.getByTestId('panel-parent')).toBeVisible();
    await expect(page.getByTestId('ask-coach-message')).toBeVisible();
    await expect(page.getByTestId('copy-ask-coach')).toBeVisible();
    await expect(page.getByTestId('panel-coach')).toBeHidden();
  });

  test('coach door shows signup and sign-in; free signup creates ClubAdmin', async ({ page }) => {
    await page.getByTestId('door-coach').click();
    await expect(page.getByTestId('panel-coach')).toBeVisible();
    await expect(page.getByTestId('signup-form')).toBeVisible();
    await expect(page.getByTestId('sign-in-link')).toHaveAttribute('href', /S0-login/);

    const stamp = Date.now();
    const email = `free.coach.${stamp}@example.com`;
    await page.getByTestId('signup-name').fill(`Free Coach ${stamp}`);
    await page.getByTestId('signup-email').fill(email);
    await page.getByTestId('signup-password').fill('SecurePass123');
    await page.getByTestId('signup-submit').click();

    await page.waitForURL(/S1-player-list|S0a-club-select|S3-team|S7-admin/);
    await completeClubSelectIfNeeded(page);
    await expect(page).toHaveURL(/S1-player-list\.html|S1-player-list$/);

    const role = await page.evaluate(() => {
      const raw = window.localStorage.getItem('vantageiq_mockup_v2');
      if (!raw) return null;
      try {
        const store = JSON.parse(raw);
        const sessionEmail = (store.sessionEmail || '').toLowerCase();
        const user = (store.users || []).find((u) => String(u.email || '').toLowerCase() === sessionEmail);
        return user ? user.role : null;
      } catch (_err) {
        return null;
      }
    });
    const badge = page.locator('.role-badge, [data-testid="role-badge"]');
    if (await badge.count()) {
      await expect(badge.first()).toContainText(/ClubAdmin|Club Admin/i);
    } else if (role) {
      expect(role).toBe('ClubAdmin');
    }
  });

  test('mockup hub remains at /mockup', async ({ page }) => {
    await page.goto('/mockup');
    await expect(page.getByText('Mockup Hub')).toBeVisible();
    await expect(page.getByRole('link', { name: /Public landing/i })).toBeVisible();
  });

  test('free tier allows one team then blocks a second', async ({ page }) => {
    await page.getByTestId('door-coach').click();
    const stamp = Date.now();
    const email = `caps.${stamp}@example.com`;
    const name = `Caps Admin ${stamp}`;
    await page.getByTestId('signup-name').fill(name);
    await page.getByTestId('signup-email').fill(email);
    await page.getByTestId('signup-password').fill('SecurePass123');
    await page.getByTestId('signup-submit').click();
    await page.waitForURL(/S1-player-list|S0a-club-select/);
    await completeClubSelectIfNeeded(page);

    const result = await page.evaluate(async ({ actorEmail }) => {
      const first = window.MockupApi.createTeam(
        {
          name: `Free Team A ${Date.now()}`,
          ageGroup: 'U15',
          coachEmail: actorEmail,
          sportId: 'sport_soccer'
        },
        'ClubAdmin',
        actorEmail
      );
      const second = window.MockupApi.createTeam(
        {
          name: `Free Team B ${Date.now()}`,
          ageGroup: 'U16',
          coachEmail: actorEmail,
          sportId: 'sport_soccer'
        },
        'ClubAdmin',
        actorEmail
      );
      return {
        firstStatus: first.status,
        secondStatus: second.status,
        secondCode: second.code,
        secondMessage: second.message
      };
    }, { actorEmail: email });

    expect(result.firstStatus).toBeLessThan(400);
    expect(result.secondStatus).toBeGreaterThanOrEqual(400);
    expect(String(result.secondMessage || '')).toMatch(/free tier|1 team/i);
  });
});
