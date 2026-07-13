import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

describe('GET /v1/players coach scoping', () => {
  const servePath = path.join(process.cwd(), 'scripts', 'serve-mockup.js');
  const source = fs.readFileSync(servePath, 'utf8');

  it('declares actorEmail and onlyMine query parameters on the players list handler', () => {
    const start = source.indexOf("if (req.method === 'GET' && requestUrl.pathname === `${apiPrefix}/players`) {");
    expect(start, 'GET /v1/players handler should exist').toBeGreaterThanOrEqual(0);
    const block = source.slice(start, start + 1500);
    expect(block).toContain("requestUrl.searchParams.get('actorEmail')");
    expect(block).toContain("requestUrl.searchParams.get('onlyMine')");
  });

  it('listPlayers applies the coach_clubs predicate for active Coach actors only', () => {
    // Find the listPlayers function definition and inspect its body.
    const fnStart = source.indexOf('async function listPlayers(');
    expect(fnStart, 'listPlayers function should exist').toBeGreaterThanOrEqual(0);
    // Slice up to the next top-level "async function" declaration.
    const nextFn = source.indexOf('\nasync function ', fnStart + 1);
    const fnEnd = nextFn > fnStart ? nextFn : fnStart + 4000;
    const fnBody = source.slice(fnStart, fnEnd);

    expect(fnBody).toContain("actor && actor.role === 'Coach'");
    expect(fnBody).toContain("actor.status === 'active'");
    expect(fnBody).toContain('SELECT club_id FROM coach_clubs WHERE user_id');
    // The predicate must be appended to the existing predicate list (it joins
    // the other WHERE conditions via AND, not a bare WHERE).
    expect(fnBody).toMatch(/t\.club_id IN \(SELECT club_id FROM coach_clubs/);
  });

  it('resolveActorForPlayersList resolves Coach and SystemAdmin actors and bypasses unknown emails', () => {
    const fnStart = source.indexOf('async function resolveActorForPlayersList(');
    expect(fnStart, 'resolveActorForPlayersList function should exist').toBeGreaterThanOrEqual(0);
    const fnEnd = source.indexOf('\nasync function ', fnStart + 1);
    const fnEndSafe = fnEnd > fnStart ? fnEnd : fnStart + 1500;
    const fnBody = source.slice(fnStart, fnEndSafe);

    expect(fnBody).toContain("SELECT id, role, status FROM users");
    expect(fnBody).toMatch(/status\s*!==\s*'active'/);
    // No role-specific rejection: SystemAdmin and Coach both pass through;
    // listPlayers decides whether to scope.
    expect(fnBody).not.toContain("actor.role !== 'Coach'");
    expect(fnBody).not.toContain("actor.role !== 'SystemAdmin'");
  });

  it('SystemAdmin and unknown actors bypass scoping (no coach_clubs predicate in their handler path)', () => {
    const fnStart = source.indexOf('async function listPlayers(');
    const nextFn = source.indexOf('\nasync function ', fnStart + 1);
    const fnEnd = nextFn > fnStart ? nextFn : fnStart + 4000;
    const fnBody = source.slice(fnStart, fnEnd);

    // The coach_clubs predicate must be inside an "if (actor && actor.role === 'Coach' && actor.status === 'active')" guard.
    // If that guard is missing, the predicate would always be applied and admins would be locked out of the global roster.
    expect(fnBody).toMatch(/if \(actor && actor\.role === 'Coach' && actor\.status === 'active'\)/);
  });

  it('enriches list players with anySkillRatings (Feature 038)', () => {
    expect(source).toContain('async function listAnySkillRatingsByPlayerIds(');
    expect(source).toContain('anySkillRatings');
    const fnStart = source.indexOf('async function listPlayers(');
    const nextFn = source.indexOf('\nasync function ', fnStart + 1);
    const fnBody = source.slice(fnStart, nextFn > fnStart ? nextFn : fnStart + 5000);
    expect(fnBody).toContain('listAnySkillRatingsByPlayerIds');
  });
});
