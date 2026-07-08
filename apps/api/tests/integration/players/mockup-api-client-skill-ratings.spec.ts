import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

describe('mockup-api-client.js — player skill ratings', () => {
  const clientSource = fs.readFileSync(
    path.join(process.cwd(), 'docs', 'ux', 'mockup', 'js', 'mockup-api-client.js'),
    'utf8'
  );

  it('declares listPlayerSkillRatings and updatePlayerSkillRatings', () => {
    expect(clientSource).toMatch(/listPlayerSkillRatings\s*\(\s*playerId\s*\)/);
    expect(clientSource).toMatch(/updatePlayerSkillRatings\s*\(\s*playerId,\s*payload\s*\)/);
  });

  it('both methods have backend and offline branches', () => {
    ['listPlayerSkillRatings', 'updatePlayerSkillRatings'].forEach(function (name) {
      const idx = clientSource.indexOf(name + '(');
      expect(idx, name + ' definition not found').toBeGreaterThanOrEqual(0);
      const block = clientSource.slice(idx, idx + 5000);
      expect(block, name + ' missing backend branch').toContain('shouldUseBackendPlayersMode()');
      expect(block, name + ' missing offline loadStore').toContain('loadStore()');
    });
  });

  it('createSeed includes playerSkillRatings: []', () => {
    const idx = clientSource.indexOf('function createSeed');
    expect(idx).toBeGreaterThanOrEqual(0);
    const body = clientSource.slice(idx, idx + 24000);
    const closeIdx = body.indexOf('function loadStore');
    const seedBody = closeIdx > 0 ? body.slice(0, closeIdx) : body;
    expect(seedBody).toMatch(/playerSkillRatings:\s*\[\]/);
  });

  it('loadStore validator requires playerSkillRatings array', () => {
    const idx = clientSource.indexOf('function loadStore');
    expect(idx).toBeGreaterThanOrEqual(0);
    const body = clientSource.slice(idx, idx + 3000);
    expect(body).toContain('Array.isArray(parsed.playerSkillRatings)');
  });

  it('offline helpers list and replace skill ratings for position', () => {
    expect(clientSource).toContain('function listSkillsForPlayerOffline');
    expect(clientSource).toContain('function replaceSkillRatingsForPositionOffline');
  });

  it('updatePlayerProfile offline path replaces ratings on position change', () => {
    const idx = clientSource.indexOf('updatePlayerProfile(playerId, payload)');
    expect(idx).toBeGreaterThanOrEqual(0);
    const block = clientSource.slice(idx, idx + 8000);
    expect(block).toContain('replaceSkillRatingsForPositionOffline');
    expect(block).toContain('previousPosition');
  });

  it('dashboard/profile payloads include skillRatings', () => {
    expect(clientSource).toMatch(/skillRatings:\s*Array\.isArray\(skillRatings\)\s*\?\s*skillRatings\s*:\s*\[\]/);
    const profileIdx = clientSource.indexOf('getPlayerProfile(playerId)');
    expect(profileIdx).toBeGreaterThanOrEqual(0);
    const profileBlock = clientSource.slice(profileIdx, profileIdx + 2500);
    expect(profileBlock).toContain('skillRatings');
  });
});
