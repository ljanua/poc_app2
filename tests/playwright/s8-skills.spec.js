const { test, expect } = require('@playwright/test');
const { Pool } = require('pg');
const path = require('node:path');
const { purgeSoccerPositionOrphans } = require('../../scripts/purge-soccer-position-orphans.js');
const { purgeQaSkills } = require('../../scripts/purge-qa-skills.js');

try {
  require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env') });
} catch (err) {
  // optional when DATABASE_URL is already set
}

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

async function createSkillViaApi(page, name, abbreviation) {
  const result = await page.evaluate(async ({ name, abbreviation }) => {
    const body = {
      name,
      actorEmail: 'maria@vantageiq.club'
    };
    if (abbreviation) {
      body.abbreviation = abbreviation;
    }
    const response = await fetch('/api/v1/skills', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    return { status: response.status, body: await response.json() };
  }, { name, abbreviation: abbreviation || null });
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

async function removeSkillFromPositionViaApi(page, positionId, skillId) {
  const result = await page.evaluate(async ({ positionId, skillId }) => {
    const url =
      '/api/v1/positions/' +
      encodeURIComponent(positionId) +
      '/skills/' +
      encodeURIComponent(skillId);
    const response = await fetch(url, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ actorEmail: 'maria@vantageiq.club' })
    });
    return { status: response.status };
  }, { positionId, skillId });
  return result;
}

async function deleteSkillViaApi(page, skillId) {
  const result = await page.evaluate(async ({ skillId }) => {
    const response = await fetch('/api/v1/skills/' + encodeURIComponent(skillId), {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ actorEmail: 'maria@vantageiq.club' })
    });
    return { status: response.status, body: response.status === 204 ? null : await response.json() };
  }, { skillId });
  return result;
}

test.describe('S8 Skills page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/S0-login.html');
    await page.evaluate(() => window.localStorage.removeItem('vantageiq_mockup_v2'));
    await loginAs(page, 'maria@vantageiq.club');
  });

  test.afterAll(async () => {
    if (!process.env.DATABASE_URL) {
      return;
    }
    const pool = new Pool({ connectionString: process.env.DATABASE_URL });
    try {
      await purgeSoccerPositionOrphans(pool);
      await purgeQaSkills(pool);
    } finally {
      await pool.end();
    }
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

  test('Add Position flow creates a position under a disposable QA sport', async ({ page }) => {
    const suffix = Date.now().toString(36);
    const sportName = 'QA Pos Sport ' + suffix;
    const positionName = 'QA Position ' + suffix;

    const sportCreated = await createSportViaApi(page, sportName);
    expect(sportCreated.status).toBe(201);
    const sportId = sportCreated.body.data && sportCreated.body.data.id;
    expect(sportId).toBeTruthy();
    expect(sportId).not.toBe('sport_soccer');

    const created = await createPositionViaApi(page, positionName, sportId);
    expect(created.status).toBe(201);
    expect(created.body.data.name).toBe(positionName);
    expect(created.body.data.sportId).toBe(sportId);

    await page.goto('/S8-skills.html');
    await page.getByRole('tab', { name: 'Positions', exact: true }).click();
    await page.selectOption('#positionSportFilter', sportId);
    await expect(page.locator('#positionsTableBody tr', { hasText: positionName })).toHaveCount(1);
  });

  test('Add Skill flow creates a new skill and collision returns 409', async ({ page }) => {
    const name = 'QA Skill ' + Date.now().toString(36);
    const first = await createSkillViaApi(page, name);
    expect(first.status).toBe(201);
    expect(first.body.data.name).toBe(name);
    expect(first.body.data.abbreviation).toBeTruthy();
    expect(String(first.body.data.abbreviation).length).toBeLessThanOrEqual(3);

    await page.goto('/S8-skills.html');
    await page.getByRole('tab', { name: 'Skills', exact: true }).click();
    await page.getByTestId('skill-sport-filter').selectOption('all');
    await expect(page.locator('#skillsTableBody tr', { hasText: name })).toHaveCount(1);
    await expect(
      page.locator('#skillsTableBody tr', { hasText: name }).getByTestId('skill-abbreviation-cell')
    ).toHaveText(first.body.data.abbreviation);

    // Second POST with the same name returns 409 conflict
    const second = await createSkillViaApi(page, name);
    expect(second.status).toBe(409);
    expect(second.body.code).toBe('conflict');
  });

  test('Add Skill UI suggests abbreviation and rename can override it', async ({ page }) => {
    const suffix = Date.now().toString(36);
    const name = 'Long shots QA ' + suffix;
    await page.goto('/S8-skills.html');
    await page.getByRole('tab', { name: 'Skills', exact: true }).click();
    await page.getByTestId('add-skill').click();
    await page.getByTestId('skill-name-input').fill(name);
    await expect(page.getByTestId('skill-abbreviation-input')).toHaveValue(/^[A-Z0-9]{1,3}$/);
    const suggested = await page.getByTestId('skill-abbreviation-input').inputValue();
    await page.getByTestId('skill-abbreviation-input').fill('LSQ');
    await page.getByTestId('create-skill-submit').click();
    await page.getByTestId('skill-sport-filter').selectOption('all');
    await expect(page.locator('#skillsTableBody tr', { hasText: name })).toHaveCount(1);
    await expect(
      page.locator('#skillsTableBody tr', { hasText: name }).getByTestId('skill-abbreviation-cell')
    ).toHaveText('LSQ');
    expect(suggested).not.toBe('');

    const row = page.locator('#skillsTableBody tr', { hasText: name });
    await row.getByRole('button', { name: 'Rename' }).click();
    await page.getByTestId('rename-skill-abbreviation-input').fill('ZZ1');
    await page.getByTestId('rename-skill-submit').click();
    await expect(row.getByTestId('skill-abbreviation-cell')).toHaveText('ZZ1');
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
    const skill1Id = skill1.body.data.id;
    const skill2Id = skill2.body.data.id;

    // Assign to the seeded GK position
    const assign1 = await assignSkillToPositionViaApi(page, 'pos_gk', skill1Id);
    const assign2 = await assignSkillToPositionViaApi(page, 'pos_gk', skill2Id);
    expect([200, 201]).toContain(assign1.status);
    expect([200, 201]).toContain(assign2.status);

    await page.goto('/S8-skills.html');
    // Filter the position-skills table to GK then verify both newly assigned rows are rendered
    await page.selectOption('#positionSkillsFilter', 'pos_gk');
    await expect(page.locator('#positionSkillsTableBody tr', { hasText: skill1Name })).toHaveCount(1);
    await expect(page.locator('#positionSkillsTableBody tr', { hasText: skill2Name })).toHaveCount(1);

    // Teardown: do not leave QA skills on Soccer GK
    expect((await removeSkillFromPositionViaApi(page, 'pos_gk', skill1Id)).status).toBe(204);
    expect((await removeSkillFromPositionViaApi(page, 'pos_gk', skill2Id)).status).toBe(204);
    expect((await deleteSkillViaApi(page, skill1Id)).status).toBe(204);
    expect((await deleteSkillViaApi(page, skill2Id)).status).toBe(204);
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
    await page.getByRole('tab', { name: 'Skills', exact: true }).click();
    await page.getByTestId('skill-sport-filter').selectOption('all');
    await expect(page.locator('#skillsTableBody tr', { hasText: skillName })).toHaveCount(0);
  });

  test('Role gating: Coach visiting S8 sees read-only catalog and write controls hidden', async ({ page }) => {
    await loginAs(page, 'joao@vantageiq.club');
    await page.goto('/S8-skills.html');

    await expect(page.locator('#roleNotice')).toBeVisible();
    await expect(page.locator('#roleNotice')).toContainText(/Read-only/i);
    await expect(page.locator('#skillPanels')).toBeVisible();
    await expect(page.getByTestId('position-sport-filter')).toHaveValue('sport_soccer');
    await page.getByRole('tab', { name: 'Skills', exact: true }).click();
    await expect(page.getByTestId('skill-sport-filter')).toHaveValue('sport_soccer');

    await expect(page.locator('[data-testid="add-sport"]')).toBeHidden();
    await expect(page.locator('[data-testid="add-position"]')).toBeHidden();
    await expect(page.locator('[data-testid="add-skill"]')).toBeHidden();
    await expect(page.locator('#assignSkillsButton')).toBeHidden();
  });

  test('Skills tab Sport filter defaults to Soccer and scopes by assignment', async ({ page }) => {
    const suffix = Date.now().toString(36);
    const sportName = 'QA Skill Sport ' + suffix;
    const skillName = 'QA Only QA Sport ' + suffix;
    const positionName = 'QA Skill Pos ' + suffix;

    const sportCreated = await createSportViaApi(page, sportName);
    expect(sportCreated.status).toBe(201);
    const sportId = sportCreated.body.data.id;
    expect(sportId).not.toBe('sport_soccer');

    const positionCreated = await createPositionViaApi(page, positionName, sportId);
    expect(positionCreated.status).toBe(201);
    const positionId = positionCreated.body.data.id;

    const skillCreated = await createSkillViaApi(page, skillName);
    expect(skillCreated.status).toBe(201);
    const skillId = skillCreated.body.data.id;

    const assigned = await assignSkillToPositionViaApi(page, positionId, skillId);
    expect([200, 201]).toContain(assigned.status);

    await page.goto('/S8-skills.html');
    await page.getByRole('tab', { name: 'Skills', exact: true }).click();
    await expect(page.getByTestId('skill-sport-filter')).toHaveValue('sport_soccer');
    await expect(page.locator('#skillsTableBody tr', { hasText: 'Ball Control' })).toHaveCount(1);
    await expect(page.locator('#skillsTableBody tr', { hasText: skillName })).toHaveCount(0);

    await page.getByTestId('skill-sport-filter').selectOption(sportId);
    await expect(page.locator('#skillsTableBody tr', { hasText: skillName })).toHaveCount(1);

    await page.getByTestId('skill-sport-filter').selectOption('all');
    await expect(page.locator('#skillsTableBody tr', { hasText: skillName })).toHaveCount(1);

    const emptySport = await createSportViaApi(page, 'QA Empty Skill Sport ' + suffix);
    expect(emptySport.status).toBe(201);
    await page.goto('/S8-skills.html');
    await page.getByRole('tab', { name: 'Skills', exact: true }).click();
    await page.getByTestId('skill-sport-filter').selectOption(emptySport.body.data.id);
    await expect(page.locator('#skillsTableBody tr')).toHaveCount(0);
  });

  test('GET /skills sportId filters API list', async ({ page }) => {
    await loginAs(page, 'maria@vantageiq.club');
    const soccer = await page.evaluate(async () => {
      const response = await fetch('/api/v1/skills?status=active&sportId=sport_soccer');
      return { status: response.status, body: await response.json() };
    });
    expect(soccer.status).toBe(200);
    expect(soccer.body.data.some((s) => s.name === 'Ball Control')).toBe(true);

    const unknown = await page.evaluate(async () => {
      const response = await fetch('/api/v1/skills?status=active&sportId=sport_nonexistent');
      return { status: response.status, body: await response.json() };
    });
    expect(unknown.status).toBe(200);
    expect(unknown.body.data).toEqual([]);
  });

  test('Nav item role gating: Skills nav is visible for Coach and SystemAdmin', async ({ page }) => {
    await loginAs(page, 'joao@vantageiq.club');
    await page.goto('/S1-player-list.html');
    await expect(page.getByTestId('nav-skills')).toBeVisible();
    await expect(page.getByTestId('nav-sports')).toBeVisible();
    await expect(page.getByRole('link', { name: 'Capture' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'My Clips' })).toBeVisible();

    await loginAs(page, 'maria@vantageiq.club');
    await page.goto('/S1-player-list.html');
    await expect(page.getByTestId('nav-skills')).toBeVisible();
    await expect(page.getByTestId('nav-sports')).toBeVisible();
    await expect(page.getByRole('link', { name: 'Capture' })).toBeHidden();
    await expect(page.getByRole('link', { name: 'My Clips' })).toBeHidden();
  });

  test('SystemAdmin S8 Positions sport filter defaults to Soccer', async ({ page }) => {
    await loginAs(page, 'maria@vantageiq.club');
    await page.goto('/S8-skills.html');
    await page.getByRole('tab', { name: 'Positions', exact: true }).click();
    await expect(page.getByTestId('position-sport-filter')).toHaveValue('sport_soccer');
  });

  test('SystemAdmin Sports nav opens S8 Sports tab (AE1)', async ({ page }) => {
    await loginAs(page, 'maria@vantageiq.club');
    await page.goto('/S1-player-list.html');
    await page.getByTestId('nav-sports').click();
    await expect(page).toHaveURL(/S8-skills\.html/);
    await expect(page.locator('#tabpanel-sports')).toBeVisible();
  });

  test('SystemAdmin can create sport with Duration and Number of players (AE3)', async ({ page }) => {
    await page.addInitScript(() => {
      window.__USE_MOCK_LOCAL__ = true;
      window.__USE_BACKEND__ = false;
    });
    await page.goto('/S0-login.html');
    await page.evaluate(() => {
      window.localStorage.removeItem('vantageiq_mockup_v2');
      window.localStorage.removeItem('vantageiq_current_user_email');
    });
    await page.fill('#email', 'maria@vantageiq.club');
    await page.fill('#password', 'SecurePass123');
    await page.locator('#loginForm button[type="submit"]').click();
    await expect(page).toHaveURL(/S1-player-list\.html|S1-player-list$|S7-admin-user-management/);

    await page.goto('/S8-skills.html?tab=sports');
    await expect(page.locator('#tabpanel-sports')).toBeVisible();

    const sportName = 'Futsal QA ' + Date.now().toString(36);
    await page.getByTestId('add-sport').click();
    await page.getByTestId('sport-name-input').fill(sportName);
    await page.getByTestId('sport-duration-input').fill('70');
    await page.getByTestId('sport-players-input').fill('7');
    await page.getByTestId('create-sport-submit').click();

    const row = page.locator('#sportsTableBody tr', { hasText: sportName });
    await expect(row).toBeVisible();
    await expect(row).toContainText('70');
    await expect(row).toContainText('7');
  });
});
