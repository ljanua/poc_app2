const { test, expect } = require('@playwright/test');
const { uniqueTeamName } = require('./_fixture-utils');

test.describe('S3 Team Management', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/S0-login.html');
    await page.evaluate(() => window.localStorage.removeItem('vantageiq_mockup_v2'));
    await page.fill('#email', 'joao@vantageiq.club');
    await page.fill('#password', 'SecurePass123');
    await page.locator('#loginForm button[type="submit"]').click();
    await expect(page).toHaveURL(/S1-player-list\.html|S1-player-list$/);
    await page.goto('/S3-team-management.html');
    await expect(page.getByText('Team Management')).toBeVisible();
  });

  test('shows team KPIs and the at-least-3 seeded roster table', async ({ page }) => {
    await expect(page.getByText(/^Active Teams$/)).toBeVisible();
    await expect(page.getByText(/^Assigned Players$/)).toBeVisible();
    await expect(page.getByText(/^Unassigned Players$/)).toBeVisible();

    // Invariant: at least 3 teams must be available (Senior Squad, U19 Prime,
    // U17 Elite). Anything beyond those three is opportunistic and accepted.
    const rows = page.locator('tbody tr');
    await expect(await rows.count()).toBeGreaterThanOrEqual(3);

    await expect(page.getByRole('cell', { name: 'Senior Squad' })).toBeVisible();
    await expect(page.getByRole('cell', { name: 'U19 Prime' })).toBeVisible();
    await expect(page.getByRole('cell', { name: 'U17 Elite' })).toBeVisible();
  });

  test('routes view and assign actions back to player list flow', async ({ page }) => {
    await page.getByRole('link', { name: /^View$/ }).first().click();
    await expect(page).toHaveURL(/S1-player-list\.html\?team=|S1-player-list\?team=/);

    await page.goto('/S3-team-management.html');
    await page.getByRole('link', { name: /^Assign$/ }).first().click();
    await expect(page).toHaveURL(/S1-player-list\.html\?team=|S1-player-list\?team=/);
  });

  test('coach creates a team and is auto-assigned as lead coach', async ({ page }) => {
    await expect(page.locator('#roleBadge')).toContainText('Coach');

    const rowsBefore = await page.locator('tbody tr').count();
    const kpiBefore = parseInt((await page.locator('#kpiActiveTeams').textContent()) || '0', 10);

    const teamName = uniqueTeamName('U15 Rising');

    await page.getByRole('button', { name: 'Create Team' }).click();
    await expect(page.locator('#coachSelfNotice')).toBeVisible();
    await expect(page.locator('#coachPickerWrap')).toBeHidden();

    await page.fill('#teamNameInput', teamName);
    await page.fill('#teamAgeGroupInput', 'U15');
    await page.getByRole('button', { name: 'Save Team' }).click();

    const createdRow = page.locator('tbody tr', { hasText: teamName });
    await expect(createdRow).toContainText('Joao Lima');

    // Invariant holds: at least 3 teams remain visible after the create.
    const rowsAfter = await page.locator('tbody tr').count();
    expect(rowsAfter).toBeGreaterThanOrEqual(3);
    expect(rowsAfter).toBeGreaterThanOrEqual(rowsBefore);

    const kpiAfter = parseInt((await page.locator('#kpiActiveTeams').textContent()) || '0', 10);
    expect(kpiAfter).toBe(kpiBefore + 1);
  });

  test('system admin creates team selecting coach and can reassign coach', async ({ page }) => {
    await page.goto('/S0-login.html');
    await page.fill('#email', 'maria@vantageiq.club');
    await page.fill('#password', 'SecurePass123');
    await page.locator('#loginForm button[type="submit"]').click();
    await expect(page).toHaveURL(/S7-admin-user-management\.html|S7-admin-user-management$/);

    await page.goto('/S3-team-management.html');
    await expect(page.locator('#roleBadge')).toContainText('SystemAdmin');

    const teamName = uniqueTeamName('U16 Select');

    await page.getByRole('button', { name: 'Create Team' }).click();
    await expect(page.locator('#coachPickerWrap')).toBeVisible();
    await expect(page.locator('#clubPickerWrap')).toBeVisible();
    await page.fill('#teamNameInput', teamName);
    await page.fill('#teamAgeGroupInput', 'U16');
    await page.selectOption('#teamCoachSelect', 'joao@vantageiq.club');
    await page.selectOption('#teamClubSelect', 'c_default');
    await page.getByRole('button', { name: 'Save Team' }).click();

    const createdRow = page.locator('tbody tr', { hasText: teamName });
    await expect(createdRow).toContainText('Joao Lima');

    const seniorSquadRow = page.locator('tbody tr', { hasText: 'Senior Squad' });
    await seniorSquadRow.getByRole('button', { name: 'Change Coach' }).click();
    await page.selectOption('#changeCoachSelect', 'joao@vantageiq.club');
    await page.getByRole('button', { name: 'Update Coach' }).click();
    await expect(seniorSquadRow).toContainText('Joao Lima');
  });

  test('coach cannot access change-coach action', async ({ page }) => {
    await expect(page.locator('#roleBadge')).toContainText('Coach');
    await expect(page.getByRole('button', { name: 'Change Coach' })).toHaveCount(0);
  });
});