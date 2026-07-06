const { test, expect } = require('@playwright/test');

async function loginAs(page, email) {
  await page.goto('/S0-login.html');
  await page.fill('#email', email);
  await page.fill('#password', 'SecurePass123');
  await page.locator('#loginForm button[type="submit"]').click();
}

test.describe('Manage Club — admin surface shows clubs and filter', () => {
  test('admin sees club column populated, filter dropdown lists VantageIQ Club, only-my-clubs hidden', async ({ page }) => {
    await loginAs(page, 'maria@vantageiq.club');
    await page.goto('/S3-team-management.html');

    const clubHeader = page.locator('table.data-table thead th', { hasText: 'Club' });
    await expect(clubHeader).toBeVisible();

    const clubCells = page.locator('table.data-table tbody td:nth-child(5)');
    const cellCount = await clubCells.count();
    expect(cellCount).toBeGreaterThanOrEqual(3);
    const cellTexts = await clubCells.allTextContents();
    cellTexts.forEach((text) => expect(text.trim()).toBe('VantageIQ Club'));

    const filter = page.locator('[data-testid="club-filter"]');
    await expect(filter).toBeVisible();
    const filterOptions = await filter.locator('option').allTextContents();
    expect(filterOptions).toContain('All Clubs');
    expect(filterOptions).toContain('VantageIQ Club');

    const onlyMine = page.locator('[data-testid="only-my-clubs"]');
    await expect(onlyMine).toBeHidden();

    const directApi = await page.evaluate(async () => {
      const response = await fetch('/api/v1/teams?actorEmail=maria@vantageiq.club');
      const body = await response.json();
      return body.data;
    });
    expect(directApi.length).toBeGreaterThanOrEqual(3);
    directApi.forEach((team) => {
      expect(team.clubId).toBe('c_default');
      expect(team.clubName).toBe('VantageIQ Club');
    });
  });

  test('filtering by VantageIQ Club narrows the admin table to club-only rows', async ({ page }) => {
    await loginAs(page, 'maria@vantageiq.club');
    await page.goto('/S3-team-management.html');

    await page.locator('[data-testid="club-filter"]').selectOption('c_default');
    const rows = page.locator('table.data-table tbody tr');
    await expect(rows.first()).toBeVisible();
    const visibleCount = await rows.count();
    expect(visibleCount).toBeGreaterThanOrEqual(3);
    const clubCells = page.locator('table.data-table tbody td:nth-child(5)');
    const clubNames = await clubCells.allTextContents();
    clubNames.forEach((name) => expect(name.trim()).toBe('VantageIQ Club'));
  });
});

test.describe('Manage Club — coach surface shows only-my-clubs toggle on by default', () => {
  test('coach lands on S3 with toggle checked and sees the club column', async ({ page }) => {
    await loginAs(page, 'joao@vantageiq.club');
    await page.goto('/S3-team-management.html');

    const onlyMine = page.locator('[data-testid="only-my-clubs"]');
    await expect(onlyMine).toBeChecked();
    await expect(onlyMine).toBeVisible();

    const rows = page.locator('table.data-table tbody tr');
    const rowCount = await rows.count();
    expect(rowCount).toBeGreaterThanOrEqual(3);

    const clubCells = page.locator('table.data-table tbody td:nth-child(5)');
    const clubTexts = await clubCells.allTextContents();
    clubTexts.forEach((text) => expect(text.trim()).toBe('VantageIQ Club'));

    const directApi = await page.evaluate(async () => {
      const response = await fetch('/api/v1/teams?actorEmail=joao@vantageiq.club');
      const body = await response.json();
      return body.data;
    });
    expect(directApi.length).toBeGreaterThanOrEqual(3);
    directApi.forEach((team) => expect(team.clubId).toBe('c_default'));

    const clubsApi = await page.evaluate(async () => {
      const response = await fetch('/api/v1/clubs?actorEmail=joao@vantageiq.club');
      const body = await response.json();
      return body.data;
    });
    expect(clubsApi.map((c) => c.id)).toEqual(['c_default']);
  });

  test('unchecking the toggle widens the coach view to still-only-clubs-they-belong-to', async ({ page }) => {
    await loginAs(page, 'joao@vantageiq.club');
    await page.goto('/S3-team-management.html');

    const toggle = page.locator('[data-testid="only-my-clubs"]');
    await toggle.uncheck();
    await expect(toggle).not.toBeChecked();

    const rows = page.locator('table.data-table tbody tr');
    const rowCount = await rows.count();
    expect(rowCount).toBeGreaterThanOrEqual(3);
  });
});

test.describe('Manage Club — server-side coach scoping is authoritative', () => {
  test('unknown coach gets zero teams even with default clubs seeded', async ({ page }) => {
    await page.goto('/S0-login.html');
    const direct = await page.evaluate(async () => {
      const response = await fetch('/api/v1/teams?actorEmail=ghost@vantageiq.club');
      const body = await response.json();
      return body.data;
    });
    expect(direct).toEqual([]);
  });
});