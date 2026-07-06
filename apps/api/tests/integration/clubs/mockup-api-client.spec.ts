import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

describe('MockupApi clubs + user-club surface', () => {
  const source = fs.readFileSync(
    path.join(process.cwd(), 'docs', 'ux', 'mockup', 'js', 'mockup-api-client.js'),
    'utf8'
  );

  it('exposes the seven new methods on the public MockupApi object', () => {
    const expected = [
      'createClub',
      'updateClub',
      'setClubStatus',
      'listUserClubs',
      'assignUserToClub',
      'removeUserFromClub',
      'assignTeamToClub'
    ];
    for (const method of expected) {
      const regex = new RegExp(`\\b${method}\\s*\\(`, 'g');
      const matches = source.match(regex) || [];
      expect(matches.length, `MockupApi.${method} should be defined`).toBeGreaterThan(0);
    }
  });

  it('uses an additivity + 201/200 split for assignUserToClub', () => {
    const idx = source.indexOf('assignUserToClub(userId, clubId, actorRole, actorEmail) {');
    expect(idx, 'assignUserToClub should be defined').toBeGreaterThanOrEqual(0);
    const nextIdx = source.indexOf('removeUserFromClub(userId, clubId, actorRole, actorEmail) {', idx);
    expect(nextIdx).toBeGreaterThan(idx);
    const block = source.slice(idx, nextIdx);
    expect(block).toContain("status: 201");
    expect(block).toContain("status: 200");
  });

  it('removeUserFromClub returns 204 on success and 404 when no row existed', () => {
    const idx = source.indexOf('removeUserFromClub(userId, clubId, actorRole, actorEmail) {');
    expect(idx).toBeGreaterThanOrEqual(0);
    const nextIdx = source.indexOf('assignTeamToClub(teamId, clubId, actorRole, actorEmail) {', idx);
    expect(nextIdx).toBeGreaterThan(idx);
    const block = source.slice(idx, nextIdx);
    expect(block).toContain("status: 204");
    expect(block).toContain("status: 404");
  });
});