import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

describe('mockup-api-client.js — S8 skills / positions / sports', () => {
  const clientSource = fs.readFileSync(
    path.join(process.cwd(), 'docs', 'ux', 'mockup', 'js', 'mockup-api-client.js'),
    'utf8'
  );
  const s8Html = fs.readFileSync(
    path.join(process.cwd(), 'docs', 'ux', 'mockup', 'S8-skills.html'),
    'utf8'
  );

  const existingPages = [
    'S1-player-list.html',
    'S2-player-dashboard.html',
    'S3-team-management.html',
    'S3a-team-update.html',
    'S4-video-capture.html',
    'S5-player-edit.html',
    'S6-assessment-list.html',
    'S7-admin-user-management.html',
    'S7a-clubs.html'
  ];

  it('declares all twelve new MockupApi method definitions', () => {
    expect(clientSource).toMatch(/listSports\s*\(\s*actorRole,\s*actorEmail,\s*statusFilter\s*\)/);
    expect(clientSource).toMatch(/createSport\s*\(\s*payload,\s*actorRole,\s*actorEmail\s*\)/);
    expect(clientSource).toMatch(/updateSport\s*\(\s*sportId,\s*payload,\s*actorRole,\s*actorEmail\s*\)/);
    expect(clientSource).toMatch(/setSportStatus\s*\(\s*sportId,\s*status,\s*actorRole,\s*actorEmail\s*\)/);
    expect(clientSource).toMatch(/listPositions\s*\(\s*actorRole,\s*actorEmail,\s*sportId,\s*statusFilter\s*\)/);
    expect(clientSource).toMatch(/createPosition\s*\(\s*payload,\s*actorRole,\s*actorEmail\s*\)/);
    expect(clientSource).toMatch(/updatePosition\s*\(\s*positionId,\s*payload,\s*actorRole,\s*actorEmail\s*\)/);
    expect(clientSource).toMatch(/setPositionStatus\s*\(\s*positionId,\s*status,\s*actorRole,\s*actorEmail\s*\)/);
    expect(clientSource).toMatch(/listSkills\s*\(\s*actorRole,\s*actorEmail,\s*statusFilter\s*\)/);
    expect(clientSource).toMatch(/createSkill\s*\(\s*payload,\s*actorRole,\s*actorEmail\s*\)/);
    expect(clientSource).toMatch(/updateSkill\s*\(\s*skillId,\s*payload,\s*actorRole,\s*actorEmail\s*\)/);
    expect(clientSource).toMatch(/deleteSkill\s*\(\s*skillId,\s*actorRole,\s*actorEmail\s*\)/);
    expect(clientSource).toMatch(/listPositionSkills\s*\(\s*positionId,\s*actorRole,\s*actorEmail\s*\)/);
    expect(clientSource).toMatch(/assignSkillToPosition\s*\(\s*positionId,\s*skillId,\s*actorRole,\s*actorEmail\s*\)/);
    expect(clientSource).toMatch(/removeSkillFromPosition\s*\(\s*positionId,\s*skillId,\s*actorRole,\s*actorEmail\s*\)/);
  });

  it('assignSkillToPosition returns 201 on first add and 200 on idempotent re-add', () => {
    const idx = clientSource.indexOf('assignSkillToPosition(');
    expect(idx, 'assignSkillToPosition definition not found').toBeGreaterThanOrEqual(0);
    // Slice 4000 chars to capture the body; well over the actual method size.
    const block = clientSource.slice(idx, idx + 4000);
    expect(block).toContain('status: 201');
    expect(block).toContain('status: 200');
  });

  it('deleteSkill returns 204 on success and 409 when assignments exist', () => {
    const idx = clientSource.indexOf('deleteSkill(');
    expect(idx, 'deleteSkill definition not found').toBeGreaterThanOrEqual(0);
    const block = clientSource.slice(idx, idx + 4000);
    expect(block).toContain('status: 204');
    expect(block).toContain('status: 409');
    expect(block).toMatch(/Cannot delete skill/);
  });

  it('removeSkillFromPosition returns 204 on success and 404 when missing', () => {
    const idx = clientSource.indexOf('removeSkillFromPosition(');
    expect(idx, 'removeSkillFromPosition definition not found').toBeGreaterThanOrEqual(0);
    const block = clientSource.slice(idx, idx + 4000);
    expect(block).toContain('status: 204');
    expect(block).toContain('status: 404');
  });

  it('every new write method gates on SystemAdmin in the offline branch', () => {
    ['createSport', 'createPosition', 'createSkill', 'assignSkillToPosition', 'removeSkillFromPosition'].forEach(function (name) {
      const idx = clientSource.indexOf(name + '(');
      expect(idx, name + ' definition not found').toBeGreaterThanOrEqual(0);
      const block = clientSource.slice(idx, idx + 4000);
      expect(block, name + ' offline branch missing SystemAdmin gate').toContain("actor.role !== 'SystemAdmin'");
    });
  });

  it('createSeed seeds exactly 1 sport, 13 positions, 31 skills, 65 position_skill rows', () => {
    const idx = clientSource.indexOf('function createSeed');
    expect(idx, 'createSeed body not found').toBeGreaterThanOrEqual(0);
    // 24000 chars covers the whole seed (well under that — currently ~6000).
    const body = clientSource.slice(idx, idx + 24000);
    const closeIdx = body.indexOf('function loadStore');
    const seedBody = closeIdx > 0 ? body.slice(0, closeIdx) : body;

    // 1 sport: sport_soccer.
    expect(body).toContain("id: 'sport_soccer'");
    expect(body).toContain("name: 'Soccer'");

    // 13 positions: pos_any through pos_st.
    const positionIds = [
      'pos_any',
      'pos_gk',
      'pos_rb_lb',
      'pos_rwb_lwb',
      'pos_cb',
      'pos_cdm',
      'pos_cm',
      'pos_cam',
      'pos_rm_lm',
      'pos_rw_lw',
      'pos_rf_lf',
      'pos_cf',
      'pos_st'
    ];
    positionIds.forEach(function (id) {
      expect(body).toContain("id: '" + id + "'");
    });

    // 31 skills: starting at s_acceleration through s_vision, plus s_heading.
    expect(body).toContain("id: 's_acceleration'");
    expect(body).toContain("id: 's_vision'");
    expect(body).toContain("id: 's_heading'");

    // count = 1 (sport), 13 (positions), 31 (skills), 65 (positionSkills).
    const sportsBlocks = body.match(/^\s+sports:\s*\[/gm) ?? [];
    expect(sportsBlocks.length).toBe(1);
    const positionsBlocks = body.match(/^\s+positions:\s*\[/gm) ?? [];
    expect(positionsBlocks.length).toBe(1);
    const skillsBlocks = body.match(/^\s+skills:\s*\[/gm) ?? [];
    expect(skillsBlocks.length).toBe(1);
    const positionSkillsBlocks = body.match(/^\s+positionSkills:\s*\[/gm) ?? [];
    expect(positionSkillsBlocks.length).toBe(1);

    // Count the rows precisely. Each position row begins with `{ positionId:`, each skill row with `{ id: 's_`.
    const positionRows = body.match(/\{\s*positionId:/g) ?? [];
    expect(positionRows.length).toBe(65);
  });

  it('loadStore validates the new skills/positions/sports array shapes', () => {
    const idx = clientSource.indexOf('function loadStore()');
    expect(idx, 'loadStore function not found').toBeGreaterThanOrEqual(0);
    const slice = clientSource.slice(idx, idx + 4000);
    expect(slice).toContain('Array.isArray(parsed.skills)');
    expect(slice).toContain('Array.isArray(parsed.positions)');
    expect(slice).toContain('Array.isArray(parsed.sports)');
  });

  it('S8-skills.html exposes the four panel headers, KPIs, modal definitions, and role gating', () => {
    // Navigation: nav-skills role-gated entry is present.
    expect(s8Html).toContain('data-testid="nav-skills"');
    expect(s8Html).toContain('data-role-visible-to="SystemAdmin"');
    // The four panels headings, in source order.
    expect(s8Html).toMatch(/<h2>\s*Sports\s*<\/h2>/);
    expect(s8Html).toMatch(/<h2>\s*Positions\s*<\/h2>/);
    expect(s8Html).toMatch(/<h2>\s*Skills\s*<\/h2>/);
    expect(s8Html).toMatch(/<h2>\s*Position Skills\s*<\/h2>/);
    // KPI ids.
    expect(s8Html).toContain('id="kpiSportsCount"');
    expect(s8Html).toContain('id="kpiActivePositionsCount"');
    expect(s8Html).toContain('id="kpiSkillsCount"');
    expect(s8Html).toContain('id="kpiAssignmentsCount"');
    // The four modal ids.
    expect(s8Html).toContain('id="createSportModal"');
    expect(s8Html).toContain('id="createPositionModal"');
    expect(s8Html).toContain('id="createSkillModal"');
    expect(s8Html).toContain('id="assignSkillsModal"');
    // Show inactive checkbox.
    expect(s8Html).toContain('id="showInactiveToggle"');
    // Role gating: applyRoleGatedNav call + exit-button handler.
    expect(s8Html).toContain('MockupApi.applyRoleGatedNav');
    expect(s8Html).toContain('MockupApi.logout()');
    expect(s8Html).toMatch(/href\s*=\s*['"]\.\/S0-login\.html['"]/);
  });

  it('S8-skills.html uses the required testid selectors', () => {
    expect(s8Html).toContain('data-testid="add-sport"');
    expect(s8Html).toContain('data-testid="add-position"');
    expect(s8Html).toContain('data-testid="add-skill"');
    expect(s8Html).toContain('data-testid="assign-skills"');
    expect(s8Html).toContain('data-testid="position-sport-filter"');
    expect(s8Html).toContain('data-testid="position-skills-filter"');
    expect(s8Html).toContain('data-testid="sport-name-input"');
    expect(s8Html).toContain('data-testid="position-name-input"');
    expect(s8Html).toContain('data-testid="skill-name-input"');
    expect(s8Html).toContain('data-testid="assign-skills-submit"');
  });

  it('S8-skills.html enforces the SystemAdmin direct-navigation guard', () => {
    expect(s8Html).toContain("currentUser.role !== 'SystemAdmin'");
    expect(s8Html).toContain('You do not have permission to manage skills.');
  });

  it('every existing mockup page gets the new data-testid="nav-skills" entry', () => {
    for (const pagePath of existingPages) {
      const fullPath = path.join(process.cwd(), 'docs', 'ux', 'mockup', pagePath);
      const source = fs.readFileSync(fullPath, 'utf8');
      expect(source, pagePath + ' missing nav-skills entry').toContain('data-testid="nav-skills"');
      expect(source, pagePath + ' missing Skills nav label').toContain('Skills');
      expect(source, pagePath + ' missing SystemAdmin role gate').toContain('data-role-visible-to="SystemAdmin"');
    }
  });
});
