const { test, expect } = require('@playwright/test');
const { completeClubSelectIfNeeded } = require('./_fixture-utils');

const PUBLIC = 'http://127.0.0.1:5501';
const APP = 'http://127.0.0.1:5500';
const ADMIN_EMAIL = 'maria@vantageiq.club';
const CLUB_ADMIN_EMAIL = 'rita@vantageiq.club';

async function loginAs(page, email) {
  await page.goto(APP + '/S0-login.html');
  await page.evaluate(() => {
    window.localStorage.removeItem('vantageiq_mockup_v2');
    window.localStorage.removeItem('vantageiq_current_user_email');
  });
  await page.fill('#email', email);
  await page.fill('#password', 'SecurePass123');
  await page.locator('#loginForm button[type="submit"]').click();
  await page.waitForURL(/S1-player-list|S0a-club-select|S7-admin/, { timeout: 20000 });
  await completeClubSelectIfNeeded(page);
}

test.describe('S7 Approvals & Tiers (SystemAdmin)', () => {
  test('AE1: SystemAdmin approves pending user from Approvals tab', async ({ page, request }) => {
    const stamp = Date.now();
    const email = `s7.pending.${stamp}@example.com`;
    const register = await request.post(PUBLIC + '/api/v1/auth/register', {
      data: {
        name: `S7 Pending ${stamp}`,
        email,
        password: 'SecurePass123',
        tierCode: 'free',
        intent: 'create',
        teamName: `S7 Team ${stamp}`,
        clubName: `S7 Team ${stamp}`
      }
    });
    expect(register.status()).toBe(201);
    const registered = await register.json();
    const userId = registered.user && registered.user.id;
    expect(userId).toBeTruthy();

    await loginAs(page, ADMIN_EMAIL);
    await page.goto(APP + '/S7-admin-user-management.html');
    await expect(page.getByTestId('tab-approvals')).toBeVisible();
    await page.getByTestId('tab-approvals').click();
    await expect(page.getByTestId('tabpanel-approvals')).toBeVisible();

    const row = page.getByTestId('pending-row-' + userId);
    await expect(row).toBeVisible({ timeout: 15000 });
    await page.getByTestId('approve-' + userId).click();
    await expect(row).toHaveCount(0);

    const login = await request.post(APP + '/api/v1/auth/login', {
      data: { email, password: 'SecurePass123' }
    });
    expect(login.ok()).toBeTruthy();
  });

  test('AE2: SystemAdmin can open Tiers tab and see tier forms', async ({ page }) => {
    await loginAs(page, ADMIN_EMAIL);
    await page.goto(APP + '/S7-admin-user-management.html');
    await page.getByTestId('tab-tiers').click();
    await expect(page.getByTestId('tabpanel-tiers')).toBeVisible();
    await expect(page.getByTestId('tier-form-free')).toBeVisible();
    await expect(page.getByTestId('tier-form-club_basic')).toBeVisible();
  });

  test('AE3: ClubAdmin does not see Approvals or Tiers tabs', async ({ page, request }) => {
    const denied = await request.get(APP + '/api/v1/admin/pending-users', {
      headers: { 'X-Actor-Email': CLUB_ADMIN_EMAIL }
    });
    expect(denied.status()).toBe(403);

    await loginAs(page, CLUB_ADMIN_EMAIL);
    await page.goto(APP + '/S7-admin-user-management.html');
    await expect(page.getByTestId('tab-users')).toBeVisible();
    await expect(page.getByTestId('tab-approvals')).toBeHidden();
    await expect(page.getByTestId('tab-tiers')).toBeHidden();
    await expect(page.getByTestId('tabpanel-approvals')).toBeHidden();
    await expect(page.getByTestId('tabpanel-tiers')).toBeHidden();
  });

  test('AE4: ClubAdmin sees subscription under Role but cannot change subscription', async ({ page, request }) => {
    const denied = await request.post(APP + '/api/v1/admin/users/u_coach_joao/subscription', {
      headers: { 'X-Actor-Email': CLUB_ADMIN_EMAIL, 'Content-Type': 'application/json' },
      data: { actorEmail: CLUB_ADMIN_EMAIL, tierCode: 'professional' }
    });
    expect(denied.status()).toBe(403);

    await loginAs(page, CLUB_ADMIN_EMAIL);
    await page.goto(APP + '/S7-admin-user-management.html');
    await expect(page.getByRole('columnheader', { name: 'Subscription' })).toHaveCount(0);
    await expect(page.getByTestId('subscription-cell').first()).toBeVisible();
    await expect(page.getByTestId('change-subscription')).toHaveCount(0);
  });

  test('AE5: pending registrant appears on Approvals but not on Users', async ({ page, request }) => {
    const stamp = Date.now();
    const email = `s7.users.hide.${stamp}@example.com`;
    const register = await request.post(PUBLIC + '/api/v1/auth/register', {
      data: {
        name: `S7 Hide ${stamp}`,
        email,
        password: 'SecurePass123',
        tierCode: 'free',
        intent: 'create',
        teamName: `S7 Hide Team ${stamp}`,
        clubName: `S7 Hide Club ${stamp}`
      }
    });
    expect(register.status()).toBe(201);
    const registered = await register.json();
    const userId = registered.user && registered.user.id;
    expect(userId).toBeTruthy();

    await loginAs(page, ADMIN_EMAIL);
    await page.goto(APP + '/S7-admin-user-management.html');
    await expect(page.locator('#usersTableBody tr').filter({ hasText: email })).toHaveCount(0);

    await page.getByTestId('tab-approvals').click();
    await expect(page.getByTestId('pending-row-' + userId)).toBeVisible({ timeout: 15000 });
  });
});
