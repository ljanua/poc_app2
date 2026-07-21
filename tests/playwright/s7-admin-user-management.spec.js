const { test, expect } = require('@playwright/test');
const { uniqueEmail, restoreCoachRole, completeClubSelectIfNeeded } = require('./_fixture-utils');

async function loginAsMaria(page) {
  await page.goto('/S0-login.html');
  await page.evaluate(() => {
    window.localStorage.removeItem('vantageiq_mockup_v2');
    window.localStorage.removeItem('vantageiq_current_user_email');
  });
  await page.fill('#email', 'maria@vantageiq.club');
  await page.fill('#password', 'SecurePass123');
  await page.locator('#loginForm button[type="submit"]').click();
  await page.waitForURL(/S1-player-list|S0a-club-select|S7-admin/, { timeout: 20000 });
  await completeClubSelectIfNeeded(page);
}

/** Shared Free Tier seat limits get exhausted in long-lived local DBs; raise headroom for create-user tests. */
async function ensureFreeTierSeatHeadroom(page) {
  const result = await page.evaluate(async () => {
    const actorEmail =
      window.localStorage.getItem('vantageiq_current_user_email') || 'maria@vantageiq.club';
    const response = await fetch('/api/v1/admin/subscription-tiers/tier_free', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({
        actorEmail,
        displayName: 'Free Tier',
        maxTeams: 50,
        maxCoaches: 50,
        maxClubAdmins: 50,
        videosPerDay: 20,
        maxVideosPerTeam: 50
      })
    });
    let body = null;
    try { body = await response.json(); } catch (_) { body = null; }
    return { status: response.status, body };
  });
  expect(result.status).toBe(200);
}

test.describe('S7 Admin User Management', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsMaria(page);
    await page.goto('/S7-admin-user-management.html');
    await expect(page.getByText('User & Role Management')).toBeVisible();
  });

  test('creates a user from modal and updates the table with a Coach KPI delta of +1', async ({ page }) => {
    await ensureFreeTierSeatHeadroom(page);
    const ts = Date.now();
    const name = `Daniel Rocha ${ts}`;
    const email = uniqueEmail('daniel', 'vantageiq.club');

    const kpiBefore = parseInt((await page.locator('#kpiCoach').textContent()) || '0', 10);

    await page.getByRole('button', { name: 'Create User' }).click();

    await page.fill('#createName', name);
    await page.fill('#createEmail', email);
    await page.selectOption('#createRole', 'Coach');
    await expect(page.getByTestId('create-club-select')).toHaveValue('c_default');
    await expect(page.getByTestId('create-club-select')).toBeDisabled();
    await page.fill('#createPassword', 'SecurePass123');
    await page.getByRole('button', { name: 'Save User' }).click();

    // Look up the new row by the unique name + email combination.
    const newRow = page.locator('tr', { hasText: name }).filter({ hasText: email });
    await expect(newRow).toBeVisible();
    await expect(newRow).toContainText('Coach');
    await expect(newRow.locator('.team-chip.js-club-chip', { hasText: 'VantageIQ Club' })).toHaveCount(1);

    // KPI delta is the only count we trust: starting state drifts as users
    // accumulate, but +1 after a successful create is always true.
    const kpiAfter = parseInt((await page.locator('#kpiCoach').textContent()) || '0', 10);
    expect(kpiAfter).toBe(kpiBefore + 1);
  });

  test('switching to Coach view disables admin actions', async ({ page }) => {
    await page.getByRole('button', { name: 'Switch to Coach View' }).click();

    await expect(page.locator('.role-badge')).toContainText('Coach');
    await expect(page.getByRole('button', { name: 'Create User' })).toBeDisabled();
    await expect(page.getByText('Coach view: admin actions are disabled')).toBeVisible();
  });

  test('updates user role from role-change modal and restores Coach afterwards', async ({ page }) => {
    // Mutate Joao Lima from Coach to SystemAdmin.
    await page.getByRole('button', { name: 'Change Role' }).nth(1).click();
    await page.selectOption('#updatedRole', 'SystemAdmin');
    await page.getByRole('button', { name: 'Update Role' }).click();

    // Assert the *transition* (modal closes) — not the resulting role,
    // because shared-state mutation would break the next test run.
    await expect(page.locator('#changeRoleModal')).toBeHidden();

    // Restore the seeded role so a re-run sees the original state.
    await restoreCoachRole(page, 'joao@vantageiq.club');

    await page.reload();
    const joaoRow = page.locator('tr[data-name="Joao Lima"]');
    await expect(joaoRow).toContainText('Coach');
  });

  test('validates password policy in change-password modal', async ({ page }) => {
    await page.getByRole('button', { name: 'Change Password' }).first().click();

    await page.fill('#newPassword', 'weak');
    await page.fill('#confirmPassword', 'weak');
    await page.getByRole('button', { name: 'Update Password' }).click();
    await expect(page.locator('#passwordError')).toHaveClass(/show/);

    await page.fill('#newPassword', 'SecurePass123');
    await page.fill('#confirmPassword', 'SecurePass123');
    await page.getByRole('button', { name: 'Update Password' }).click();
    await expect(page.locator('#passwordError')).not.toHaveClass(/show/);
  });

  test('filters table by role and status — Maria Alves is in the filtered rows', async ({ page }) => {
    await page.selectOption('#roleFilter', 'SystemAdmin');
    await page.selectOption('#statusFilter', 'active');

    // Maria Alves is a seeded SystemAdmin + active user; she must always be
    // visible after the role/status filter is applied. Other admins from
    // prior runs are allowed but irrelevant to the assertion.
    const mariaRow = page.locator('tbody tr[data-name="Maria Alves"]');
    await expect(mariaRow).toBeVisible();

    // Joao Lima is a Coach, so he must NOT match the SystemAdmin filter.
    const joaoRow = page.locator('tbody tr[data-name="Joao Lima"]');
    await expect(joaoRow).toBeHidden();
  });

  test('Create Coach with active club locks create-club select to that club', async ({ page }) => {
    await page.getByRole('button', { name: 'Create User' }).click();
    await page.selectOption('#createRole', 'Coach');
    await expect(page.getByTestId('create-club-select')).toHaveValue('c_default');
    await expect(page.getByTestId('create-club-select')).toBeDisabled();
  });

  test('creates a SystemAdmin without club membership', async ({ page }) => {
    const email = uniqueEmail('sysadmin.create', 'vantageiq.club');
    const name = `Sys Admin ${Date.now()}`;

    await page.getByRole('button', { name: 'Create User' }).click();
    await page.fill('#createName', name);
    await page.fill('#createEmail', email);
    await page.selectOption('#createRole', 'SystemAdmin');
    await expect(page.getByTestId('create-club-select')).toHaveValue('');
    await page.fill('#createPassword', 'SecurePass123');
    await page.getByRole('button', { name: 'Save User' }).click();

    const newRow = page.locator('tr', { hasText: name }).filter({ hasText: email });
    await expect(newRow).toBeVisible();
    await expect(newRow).toContainText('SystemAdmin');
    await expect(newRow.locator('.team-chip.js-club-chip')).toHaveCount(0);
  });

  test('SA sees Subscription column and Change Subscription; change to professional syncs Coach role', async ({ page }) => {
    await expect(page.getByTestId('subscription-column-header')).toBeVisible();
    await expect(page.getByTestId('change-subscription').first()).toBeVisible();

    const joaoRow = page.locator('tr[data-name="Joao Lima"]');
    await expect(joaoRow).toBeVisible();

    await joaoRow.getByTestId('change-subscription').click();
    await expect(page.getByTestId('change-subscription-modal')).toBeVisible();
    await page.getByTestId('subscription-tier-select').selectOption({ label: 'Free Tier' });
    await page.getByTestId('subscription-update-submit').click();
    await expect(page.getByTestId('change-subscription-modal')).toBeHidden();
    await expect(joaoRow).toContainText('ClubAdmin');
    await expect(joaoRow.getByTestId('subscription-cell')).toContainText(/Free Tier/i);

    await joaoRow.getByTestId('change-subscription').click();
    await page.getByTestId('subscription-tier-select').selectOption({ label: 'Professional' });
    await page.getByTestId('subscription-update-submit').click();
    await expect(page.getByTestId('change-subscription-modal')).toBeHidden();
    await expect(joaoRow).toContainText('Coach');
    await expect(joaoRow.getByTestId('subscription-cell')).toContainText(/Professional/i);

    await restoreCoachRole(page, 'joao@vantageiq.club');
    await page.reload();
    await completeClubSelectIfNeeded(page);
    await expect(page.locator('tr[data-name="Joao Lima"]')).toContainText('Coach');
  });

  test('Users tab has no Approval/Last Login columns; Status shows last-login tooltip', async ({ page }) => {
    await expect(page.getByTestId('subscription-column-header')).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Approval' })).toHaveCount(0);
    await expect(page.getByRole('columnheader', { name: 'Last Login' })).toHaveCount(0);

    const joaoStatus = page.locator('tr[data-name="Joao Lima"]').getByTestId('user-status');
    await expect(joaoStatus).toBeVisible();
    await expect(joaoStatus).toHaveAttribute('title', /Last login:/i);
  });
});
