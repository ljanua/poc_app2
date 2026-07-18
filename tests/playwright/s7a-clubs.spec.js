const { test, expect } = require('@playwright/test');
const { completeClubSelectIfNeeded } = require('./_fixture-utils');

async function loginAs(page, email) {
  await page.goto('/S0-login.html');
  await page.evaluate(() => {
    window.localStorage.removeItem('vantageiq_mockup_v2');
    window.localStorage.removeItem('vantageiq_current_user_email');
    window.localStorage.removeItem('vantageiq_active_club_id');
  });
  await page.fill('#email', email);
  await page.fill('#password', 'SecurePass123');
  await page.locator('#loginForm button[type="submit"]').click();
  await page.waitForURL(/S1-player-list|S7-admin-user-management|S0a-club-select/);
  await completeClubSelectIfNeeded(page);
  await expect(page).toHaveURL(/S1-player-list\.html|S1-player-list$|S7-admin-user-management\.html|S7-admin-user-management$/);
}

async function createClubViaApi(page, name) {
  const result = await page.evaluate(async ({ name }) => {
    const response = await fetch('/api/v1/clubs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name,
        actorEmail: 'maria@vantageiq.club'
      })
    });
    return { status: response.status, body: await response.json() };
  }, { name });
  return result;
}

test.describe('S7a Clubs page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/S0-login.html');
    await page.evaluate(() => window.localStorage.removeItem('vantageiq_mockup_v2'));
    await loginAs(page, 'maria@vantageiq.club');
  });

  test('SystemAdmin sees the seeded club and the page actions', async ({ page }) => {
    await page.goto('/S7a-clubs.html');
    // Scope to the page header: the page also has KPI labels and a nav item
    // labelled "Clubs", so getByText alone would match all four strict-mode elements.
    await expect(page.getByRole('banner').getByText('Clubs')).toBeVisible();
    await expect(page.getByTestId('open-create-club')).toBeVisible();
    await expect(page.locator('tbody tr', { hasText: 'VantageIQ Club' })).toHaveCount(1);
  });

  test('Add Club flow creates a new club and appears in the table', async ({ page }) => {
    const name = 'QA ' + Date.now().toString(36) + ' FC';
    const created = await createClubViaApi(page, name);
    expect(created.status).toBe(201);
    expect(created.body.data.name).toBe(name);
    expect(created.body.data.defaultSportId).toBe('sport_soccer');

    await page.goto('/S7a-clubs.html');
    await expect(page.locator('tbody tr', { hasText: name })).toHaveCount(1);
    await expect(page.locator('tbody tr', { hasText: name }).getByTestId('club-default-sport')).toContainText(/Soccer/i);
  });

  test('Add Club UI persists Default sport', async ({ page }) => {
    const name = 'QA Sport ' + Date.now().toString(36);
    await page.goto('/S7a-clubs.html');
    await page.getByTestId('open-create-club').click();
    await page.fill('#createClubName', name);
    await expect(page.getByTestId('create-club-default-sport')).toBeVisible();
    await page.getByTestId('create-club-default-sport').selectOption('sport_soccer');
    await page.locator('#createClubForm button[type="submit"]').click();
    await expect(page.locator('tbody tr', { hasText: name })).toHaveCount(1);
    await expect(page.locator('tbody tr', { hasText: name }).getByTestId('club-default-sport')).toContainText(/Soccer/i);
  });

  test('Add Club rejects a duplicate name with 409', async ({ page }) => {
    const name = 'Duplicate ' + Date.now().toString(36);
    await createClubViaApi(page, name);
    const second = await createClubViaApi(page, name);
    expect(second.status).toBe(409);
    expect(second.body.code).toBe('conflict');
  });

  test('Deactivate hides the club from the default active filter', async ({ page }) => {
    const name = 'QA Inactive ' + Date.now().toString(36);
    const created = await createClubViaApi(page, name);
    const clubId = created.body.data.id;

    const deactivate = await page.evaluate(async ({ clubId }) => {
      const response = await fetch('/api/v1/clubs/' + encodeURIComponent(clubId) + '/status', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'inactive', actorEmail: 'maria@vantageiq.club' })
      });
      return response.status;
    }, { clubId });
    expect(deactivate).toBe(200);

    await page.goto('/S7a-clubs.html');
    await expect(page.locator('tbody tr', { hasText: name })).toHaveCount(0);

    await page.selectOption('#statusFilter', 'inactive');
    await expect(page.locator('tbody tr', { hasText: name })).toHaveCount(1);
  });
});
