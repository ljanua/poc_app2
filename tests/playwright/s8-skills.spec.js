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

async function createSportViaApi(page, name) {
  const result = await page.evaluate(async ({ name }) => {
    const response = await fetch('/api/v1/sports', {
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

async function createPositionViaApi(page, name, sportId) {
  const result = await page.evaluate(async ({ name, sportId }) => {
    const response = await fetch('/api/v1/positions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name,
        sportId,
        actorEmail: 'maria@vantageiq.club'
      })
    });
    return { status: response.status, body: await response.json() };
  }, { name, sportId });
  return result;
}

async function createSkillViaApi(page, name) {
  const result = await page.evaluate(async ({ name }) => {
    const response = await fetch('/api/v1/skills', {
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

async function assignSkillToPositionViaApi(page, positionId, skillId) {
  const result = await page.evaluate(async ({ positionId, skillId }) => {
    const url = '/api/v1/positions/' + encodeURIComponent(positionId) + '/skills';
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        skillId,
        actorEmail: 'maria@vantageiq.club'
      })
    });
    return { status: response.status, body: await response.json() };
  }, { positionId, skillId });
  return result;
}

test.describe('S8 Skills page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/S0-login.html');
    await page.evaluate(() => window.localStorage.removeItem('vantageiq_mockup_v2'));
    await loginAs(page, 'maria@vantageiq.club');
  });

  test('SystemAdmin sees the seeded Soccer catalog', async ({ page }) => {
    await page.goto('/S8-skills.html');

    // Page title is "Skills" in the header banner
    await expect(page.getByRole('banner').getByText('Skills')).toBeVisible();

    // Soccer seed row appears in the sports panel
    await expect(page.locator('#sportsTableBody tr', { hasText: 'Soccer' })).toHaveCount(1);

    // 13 positions and ~31 skills are seeded (lower-bound checks so other tests' leftovers don't fail this one)
    const positionRows = page.locator('#positionsTableBody tr');
    expect(await positionRows.count()).toBeGreaterThanOrEqual(13);
    const skillRows = page.locator('#skillsTableBody tr');
    expect(await skillRows.count()).toBeGreaterThanOrEqual(31);

    // Position Skills panel is filtered by selected position; pick a position and verify the 5 seeded skills (lower-bound so leftover assignments don't fail the assertion)
    await page.selectOption('#positionSkillsFilter', 'pos_gk');
    const assignmentRows = page.locator('#positionSkillsTableBody tr');
    expect(await assignmentRows.count()).toBeGreaterThanOrEqual(5);
  });

  test('Add Sport flow creates a new sport and appears in the table', async ({ page }) => {
    const name = 'QA Sport ' + Date.now().toString(36);
    const created = await createSportViaApi(page, name);
    expect(created.status).toBe(201);
    expect(created.body.data.name).toBe(name);

    await page.goto('/S8-skills.html');
    await expect(page.locator('#sportsTableBody tr', { hasText: name })).toHaveCount(1);
  });

  test('Add Position flow creates a position under sport_soccer', async ({ page }) => {
    const name = 'QA Position ' + Date.now().toString(36);
    const created = await createPositionViaApi(page, name, 'sport_soccer');
    expect(created.status).toBe(201);
    expect(created.body.data.name).toBe(name);
    expect(created.body.data.sportId).toBe('sport_soccer');

    await page.goto('/S8-skills.html');
    await expect(page.locator('#positionsTableBody tr', { hasText: name })).toHaveCount(1);
  });

  test('Add Skill flow creates a new skill and collision returns 409', async ({ page }) => {
    const name = 'QA Skill ' + Date.now().toString(36);
    const first = await createSkillViaApi(page, name);
    expect(first.status).toBe(201);
    expect(first.body.data.name).toBe(name);

    await page.goto('/S8-skills.html');
    await expect(page.locator('#skillsTableBody tr', { hasText: name })).toHaveCount(1);

    // Second POST with the same name returns 409 conflict
    const second = await createSkillViaApi(page, name);
    expect(second.status).toBe(409);
    expect(second.body.code).toBe('conflict');
  });

  test('Assign Skills flow adds two new skills to a position', async ({ page }) => {
    // Create two fresh skills to assign
    const suffix = Date.now().toString(36);
    const skill1Name = 'QA Assign 1 ' + suffix;
    const skill2Name = 'QA Assign 2 ' + suffix;
    const skill1 = await createSkillViaApi(page, skill1Name);
    const skill2 = await createSkillViaApi(page, skill2Name);
    expect(skill1.status).toBe(201);
    expect(skill2.status).toBe(201);

    // Assign to the seeded GK position
    const assign1 = await assignSkillToPositionViaApi(page, 'pos_gk', skill1.body.data.id);
    const assign2 = await assignSkillToPositionViaApi(page, 'pos_gk', skill2.body.data.id);
    expect([200, 201]).toContain(assign1.status);
    expect([200, 201]).toContain(assign2.status);

    await page.goto('/S8-skills.html');
    // Filter the position-skills table to GK then verify both newly assigned rows are rendered
    await page.selectOption('#positionSkillsFilter', 'pos_gk');
    await expect(page.locator('#positionSkillsTableBody tr', { hasText: skill1Name })).toHaveCount(1);
    await expect(page.locator('#positionSkillsTableBody tr', { hasText: skill2Name })).toHaveCount(1);
  });

  test('Delete Skill flow removes assignments first then deletes the skill', async ({ page }) => {
    // Create a fresh skill, assign to a position, then exercise the delete path
    const suffix = Date.now().toString(36);
    const skillName = 'QA Delete ' + suffix;
    const created = await createSkillViaApi(page, skillName);
    expect(created.status).toBe(201);
    const skillId = created.body.data.id;

    const assigned = await assignSkillToPositionViaApi(page, 'pos_gk', skillId);
    expect([200, 201]).toContain(assigned.status);

    // Attempting to delete a skill with assignments must return 409 conflict
    const blockedDelete = await page.evaluate(async ({ skillId }) => {
      const response = await fetch('/api/v1/skills/' + encodeURIComponent(skillId), {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ actorEmail: 'maria@vantageiq.club' })
      });
      return { status: response.status, body: await response.json() };
    }, { skillId });
    expect(blockedDelete.status).toBe(409);
    expect(blockedDelete.body.code).toBe('conflict');

    // Remove the assignment first
    const removed = await page.evaluate(async ({ skillId }) => {
      const url = '/api/v1/positions/pos_gk/skills/' + encodeURIComponent(skillId);
      const response = await fetch(url, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ actorEmail: 'maria@vantageiq.club' })
      });
      return response.status;
    }, { skillId });
    expect(removed).toBe(204);

    // Now delete should succeed
    const deleted = await page.evaluate(async ({ skillId }) => {
      const response = await fetch('/api/v1/skills/' + encodeURIComponent(skillId), {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ actorEmail: 'maria@vantageiq.club' })
      });
      return response.status;
    }, { skillId });
    expect(deleted).toBe(204);

    await page.goto('/S8-skills.html');
    await expect(page.locator('#skillsTableBody tr', { hasText: skillName })).toHaveCount(0);
  });

  test('Role gating: Coach visiting S8 sees the 403 notice and panels are hidden', async ({ page }) => {
    await loginAs(page, 'joao@vantageiq.club');
    await page.goto('/S8-skills.html');

    // 403 notice is visible
    await expect(page.locator('#roleNotice')).toBeVisible();

    // The four admin panels are hidden from a Coach actor
    await expect(page.locator('[data-testid="add-sport"]')).toBeHidden();
    await expect(page.locator('[data-testid="add-position"]')).toBeHidden();
    await expect(page.locator('[data-testid="add-skill"]')).toBeHidden();
    await expect(page.locator('#assignSkillsButton')).toBeHidden();
  });

  test('Nav item role gating: Skills nav is hidden for Coach, visible for SystemAdmin', async ({ page }) => {
    // Coach view: Skills nav item should be hidden
    await loginAs(page, 'joao@vantageiq.club');
    await page.goto('/S1-player-list.html');
    await expect(page.getByTestId('nav-skills')).toBeHidden();

    // SystemAdmin view: Skills nav item should be visible
    await loginAs(page, 'maria@vantageiq.club');
    await page.goto('/S1-player-list.html');
    await expect(page.getByTestId('nav-skills')).toBeVisible();
  });
});
