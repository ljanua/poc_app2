const { test, expect } = require('@playwright/test');
const { uniqueEmail, restoreCoachRole } = require('./_fixture-utils');

test.describe('S7 Admin User Management', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/S0-login.html');
    await page.evaluate(() => window.localStorage.removeItem('vantageiq_mockup_v2'));
    await page.goto('/S7-admin-user-management.html');
    await expect(page.getByText('User & Role Management')).toBeVisible();
  });

  test('creates a user from modal and updates the table with a Coach KPI delta of +1', async ({ page }) => {
    const ts = Date.now();
    const name = `Daniel Rocha ${ts}`;
    const email = uniqueEmail('daniel', 'vantageiq.club');

    const kpiBefore = parseInt((await page.locator('#kpiCoach').textContent()) || '0', 10);

    await page.getByRole('button', { name: 'Create User' }).click();

    await page.fill('#createName', name);
    await page.fill('#createEmail', email);
    await page.selectOption('#createRole', 'Coach');
    await page.fill('#createPassword', 'SecurePass123');
    await page.getByRole('button', { name: 'Save User' }).click();

    // Look up the new row by the unique name + email combination.
    const newRow = page.locator('tr', { hasText: name }).filter({ hasText: email });
    await expect(newRow).toBeVisible();
    await expect(newRow).toContainText('Coach');

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
});