import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

describe('S2/S5 — player skill ratings UI', () => {
  const s2 = fs.readFileSync(
    path.join(process.cwd(), 'docs', 'ux', 'mockup', 'S2-player-dashboard.html'),
    'utf8'
  );
  const s5 = fs.readFileSync(
    path.join(process.cwd(), 'docs', 'ux', 'mockup', 'S5-player-edit.html'),
    'utf8'
  );

  it('S2 has Skill Ratings section before Development Progress', () => {
    expect(s2).toContain('data-testid="skill-ratings-section"');
    expect(s2).toContain('data-testid="skill-ratings-any-section"');
    expect(s2).toContain('data-testid="skill-ratings-role-section"');
    expect(s2).toContain('stats-section');
    const skillIdx = s2.indexOf('Skill Ratings');
    const progressIdx = s2.indexOf('Development Progress');
    expect(skillIdx).toBeGreaterThanOrEqual(0);
    expect(progressIdx).toBeGreaterThan(skillIdx);
  });

  it('S2 Any Position section appears before role section', () => {
    const anyIdx = s2.indexOf('skill-ratings-any-section');
    const roleIdx = s2.indexOf('skill-ratings-role-section');
    expect(anyIdx).toBeGreaterThanOrEqual(0);
    expect(roleIdx).toBeGreaterThan(anyIdx);
  });

  it('S2 empty-state helper text is present', () => {
    expect(s2).toContain('No skills are tracked for this player yet — pick a position in Edit Player (S5).');
    expect(s2).toContain('data-testid="skill-ratings-empty"');
    expect(s2).toContain('Not rated');
  });

  it('S5 has Skill Ratings section before Development Progress', () => {
    expect(s5).toContain('data-testid="skill-ratings-section"');
    expect(s5).toContain('data-testid="skill-ratings-any-section"');
    expect(s5).toContain('data-testid="skill-ratings-role-section"');
    const skillIdx = s5.indexOf('Skill Ratings');
    const progressIdx = s5.indexOf('Development Progress');
    expect(skillIdx).toBeGreaterThanOrEqual(0);
    expect(progressIdx).toBeGreaterThan(skillIdx);
  });

  it('S5 save handler calls profile then skill-ratings update', () => {
    expect(s5).toContain('MockupApi.updatePlayerProfile');
    expect(s5).toContain('MockupApi.updatePlayerSkillRatings');
    const profileIdx = s5.indexOf('MockupApi.updatePlayerProfile');
    const ratingsIdx = s5.indexOf('MockupApi.updatePlayerSkillRatings');
    expect(ratingsIdx).toBeGreaterThan(profileIdx);
    expect(s5).toContain('readSkillRatingsPayload(true)');
  });

  it('S5 skill rating controls use 0–100 slider options', () => {
    expect(s5).toContain('buildSliderControl(container.id, { min: 0, max: 100, step: 1, midpoint: 50 })');
    expect(s5).toContain('No skills are tracked for this player yet — pick a position above.');
  });
});
