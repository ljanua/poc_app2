const { test, expect } = require('@playwright/test');

test.describe('S7 Admin User Management', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/S0-login.html');
    await page.evaluate(() => window.localStorage.removeItem('vantageiq_mockup_v2'));
    await page.goto('/S7-admin-user-management.html');
    await expect(page.getByText('User & Role Management')).toBeVisible();
  });

  test('creates a user from modal and updates table and KPI counts', async ({ page }) => {
    await page.getByRole('button', { name: 'Create User' }).click();

    await page.fill('#createName', 'Daniel Rocha');
    await page.fill('#createEmail', 'daniel@vantageiq.club');
    await page.selectOption('#createRole', 'Coach');
    await page.fill('#createPassword', 'SecurePass123');
    await page.getByRole('button', { name: 'Save User' }).click();

    await expect(page.getByRole('cell', { name: 'Daniel Rocha' })).toBeVisible();
    await expect(page.locator('#kpiCoach')).toContainText('3');
  });

  test('switching to Coach view disables admin actions', async ({ page }) => {
    await page.getByRole('button', { name: 'Switch to Coach View' }).click();

    await expect(page.locator('.role-badge')).toContainText('Coach');
    await expect(page.getByRole('button', { name: 'Create User' })).toBeDisabled();
    await expect(page.getByText('Coach view: admin actions are disabled')).toBeVisible();
  });

  test('updates user role from role-change modal', async ({ page }) => {
    await page.getByRole('button', { name: 'Change Role' }).nth(1).click();
    await page.selectOption('#updatedRole', 'SystemAdmin');
    await page.getByRole('button', { name: 'Update Role' }).click();

    const row = page.locator('tr[data-name="Joao Lima"]');
    await expect(row).toContainText('SystemAdmin');
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

  test('filters table by role and status', async ({ page }) => {
    await page.selectOption('#roleFilter', 'SystemAdmin');
    await page.selectOption('#statusFilter', 'active');

    await expect(page.locator('tbody tr:visible')).toHaveCount(1);
    await expect(page.locator('tbody tr:visible')).toContainText('Maria Alves');
  });
});
