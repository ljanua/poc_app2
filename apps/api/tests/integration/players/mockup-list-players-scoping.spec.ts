import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

describe('MockupApi.listPlayers coach scoping', () => {
  const source = fs.readFileSync(
    path.join(process.cwd(), 'docs', 'ux', 'mockup', 'js', 'mockup-api-client.js'),
    'utf8'
  );

  it('forwards actorEmail and onlyMine query params in backend mode', () => {
    const fnStart = source.indexOf('listPlayers(options) {');
    expect(fnStart, 'listPlayers should be defined').toBeGreaterThanOrEqual(0);
    // Slice up to the next MockupApi method declaration to keep the boundary tight.
    const nextFn = source.indexOf('\n    getSuggestions(', fnStart);
    const fnEnd = nextFn > fnStart ? nextFn : fnStart + 6000;
    const block = source.slice(fnStart, fnEnd);

    // Backend-mode branch (first conditional)
    expect(block).toContain("params.set('actorEmail'");
    expect(block).toContain("params.set('onlyMine', 'true')");
  });

  it('mirrors the coach scoping offline via coach_clubs + teams.clubId', () => {
    const fnStart = source.indexOf('listPlayers(options) {');
    const nextFn = source.indexOf('\n    getSuggestions(', fnStart);
    const fnEnd = nextFn > fnStart ? nextFn : fnStart + 6000;
    const block = source.slice(fnStart, fnEnd);

    // The offline branch must read coach_clubs and intersect with the team's club_id.
    expect(block).toMatch(/store\.coachClubs/);
    expect(block).toMatch(/store\.teams/);
    expect(block).toContain('allowedClubIds');
    expect(block).toContain('allowedTeamNames');
  });

  it('only applies the offline filter when actor is an active Coach', () => {
    const fnStart = source.indexOf('listPlayers(options) {');
    const nextFn = source.indexOf('\n    getSuggestions(', fnStart);
    const fnEnd = nextFn > fnStart ? nextFn : fnStart + 6000;
    const block = source.slice(fnStart, fnEnd);

    expect(block).toMatch(/actor\s*&&\s*actor\.role\s*===\s*'Coach'/);
    expect(block).toMatch(/actor\.status\s*===\s*'active'/);
    // SystemAdmin bypasses scoping: the onlyMine filter must be a no-op for admins.
    expect(block).not.toMatch(/actor\.role\s*===\s*'SystemAdmin'\s*&&\s*actor\.status\s*===\s*'active'/);
  });

  it('combines coach scoping with the existing teamName + query filters', () => {
    const fnStart = source.indexOf('listPlayers(options) {');
    const nextFn = source.indexOf('\n    getSuggestions(', fnStart);
    const fnEnd = nextFn > fnStart ? nextFn : fnStart + 6000;
    const block = source.slice(fnStart, fnEnd);

    // The filter chain must still apply teamName + query in addition to the
    // coach-scoped allowedTeamNames check.
    expect(block).toContain('teamMatches');
    expect(block).toContain('queryMatches');
    expect(block).toContain('clubScopeMatches');
    expect(block).toMatch(/teamMatches\s*&&\s*queryMatches\s*&&\s*clubScopeMatches/);
  });
});