const { test, expect } = require('@playwright/test');

async function loginAs(page, email) {
  await page.goto('/S0-login.html');
  await page.evaluate(() => {
    window.localStorage.removeItem('vantageiq_mockup_v2');
    window.localStorage.removeItem('vantageiq_current_user_email');
  });
  await page.fill('#email', email);
  await page.fill('#password', 'SecurePass123');
  await page.locator('#loginForm button[type="submit"]').click();
  await expect(page).toHaveURL(/S1-player-list\.html|S1-player-list$|S7-admin-user-management\.html|S7-admin-user-management$/);
}

test.describe('S7 Per-User Club Assignment', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/S0-login.html');
    await page.evaluate(() => window.localStorage.removeItem('vantageiq_mockup_v2'));
    await loginAs(page, 'maria@vantageiq.club');
  });

  test('assigns a club to a coach via the API and reflects it in the S7 inline list', async ({ page }) => {
    const createClub = await page.evaluate(async () => {
      const response = await fetch('/api/v1/clubs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'QA Assign ' + Date.now().toString(36), actorEmail: 'maria@vantageiq.club' })
      });
      return await response.json();
    });
    const clubId = createClub.data.id;
    const clubName = createClub.data.name;

    const assign = await page.evaluate(async ({ clubId }) => {
      const response = await fetch('/api/v1/users/u_coach_joao/clubs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clubId, actorEmail: 'maria@vantageiq.club' })
      });
      return response.status;
    }, { clubId });
    expect(assign).toBe(201);

    await page.goto('/S7-admin-user-management.html');
    const row = page.locator('tr', { hasText: 'Joao Lima' });
    await expect(row.locator('.team-chip.js-club-chip', { hasText: clubName })).toHaveCount(1);
  });

  test('re-assigning the same club is idempotent and returns 200', async ({ page }) => {
    const createClub = await page.evaluate(async () => {
      const response = await fetch('/api/v1/clubs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'QA Idempotent ' + Date.now().toString(36), actorEmail: 'maria@vantageiq.club' })
      });
      return await response.json();
    });
    const clubId = createClub.data.id;

    const first = await page.evaluate(async ({ clubId }) => {
      const response = await fetch('/api/v1/users/u_coach_joao/clubs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clubId, actorEmail: 'maria@vantageiq.club' })
      });
      return response.status;
    }, { clubId });
    const second = await page.evaluate(async ({ clubId }) => {
      const response = await fetch('/api/v1/users/u_coach_joao/clubs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clubId, actorEmail: 'maria@vantageiq.club' })
      });
      return response.status;
    }, { clubId });
    expect(first).toBe(201);
    expect(second).toBe(200);
  });

  test('removing a club membership via DELETE returns 204', async ({ page }) => {
    const createClub = await page.evaluate(async () => {
      const response = await fetch('/api/v1/clubs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'QA Remove ' + Date.now().toString(36), actorEmail: 'maria@vantageiq.club' })
      });
      return await response.json();
    });
    const clubId = createClub.data.id;

    await page.evaluate(async ({ clubId }) => {
      await fetch('/api/v1/users/u_coach_joao/clubs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clubId, actorEmail: 'maria@vantageiq.club' })
      });
    }, { clubId });

    const remove = await page.evaluate(async ({ clubId }) => {
      const response = await fetch('/api/v1/users/u_coach_joao/clubs/' + encodeURIComponent(clubId) + '?actorEmail=' + encodeURIComponent('maria@vantageiq.club'), {
        method: 'DELETE'
      });
      return response.status;
    }, { clubId });
    expect(remove).toBe(204);

    const memberships = await page.evaluate(async () => {
      const response = await fetch('/api/v1/users/u_coach_joao/clubs?actorEmail=' + encodeURIComponent('maria@vantageiq.club'));
      return await response.json();
    });
    expect((memberships.data || []).some((row) => row.clubId === clubId)).toBe(false);
  });

  test('shows existing clubIds from GET /users on S7 without a fresh assign', async ({ page }) => {
    await page.goto('/S7-admin-user-management.html');
    const row = page.locator('tr', { hasText: 'Joao Lima' });
    await expect(row.locator('.clubs-cell .muted-text')).toHaveCount(0);
    await expect(row.locator('.team-chip.js-club-chip')).not.toHaveCount(0);
  });
});
