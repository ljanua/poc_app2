import { describe, expect, it } from 'vitest';
import { canAccessAdminSkills } from '../../../../src/features/admin-skills/access';

describe('AdminSkillsPage access gate', () => {
  it('allows SystemAdmin actors', () => {
    expect(canAccessAdminSkills('SystemAdmin')).toBe(true);
  });

  it('forbids Coach actors', () => {
    expect(canAccessAdminSkills('Coach')).toBe(false);
  });
});

describe('AdminSkillsPage smoke', () => {
  it('access module exposes the gate function', () => {
    expect(typeof canAccessAdminSkills).toBe('function');
  });

  it('ApiClient interface includes the contract surface', async () => {
    const mod = await import(
      '../../../../src/features/admin-skills/services/skills-api-client'
    );
    const proto = mod.HttpSkillsApiClient.prototype as unknown as Record<string, unknown>;
    [
      'listSports',
      'createSport',
      'updateSport',
      'setSportStatus',
      'listPositions',
      'createPosition',
      'updatePosition',
      'setPositionStatus',
      'listSkills',
      'createSkill',
      'updateSkill',
      'deleteSkill',
      'listPositionSkills',
      'assignSkillToPosition',
      'removeSkillFromPosition'
    ].forEach((method) => {
      expect(typeof proto[method]).toBe('function');
    });
  });
});