import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

describe('skills/positions/sports handlers in serve-mockup.js', () => {
  const source = fs.readFileSync(path.join(process.cwd(), 'scripts', 'serve-mockup.js'), 'utf8');

  it('declares the four payload mappers', () => {
    expect(source).toContain('function toSportPayload(');
    expect(source).toContain('function toPositionPayload(');
    expect(source).toContain('function toSkillPayload(');
    expect(source).toContain('function toPositionSkillPayload(');
  });

  it('declares the four lookup helpers', () => {
    expect(source).toContain('async function findSportByName(');
    expect(source).toContain('async function findPositionByName(');
    expect(source).toContain('async function findSkillByName(');
    expect(source).toContain('async function listPositionSkills(');
  });

  it('declares the three with-count list helpers', () => {
    expect(source).toContain('async function listSportsWithCounts(');
    expect(source).toContain('async function listPositionsWithCounts(');
    expect(source).toContain('async function listSkillsWithCounts(');
  });

  it('handles every endpoint declared in the OpenAPI contract', () => {
    // Sports
    expect(source).toContain('${apiPrefix}/sports');
    expect(source).toContain('${apiPrefix}/positions');
    expect(source).toContain('${apiPrefix}/skills');
    // Path-regex based handlers cover the {id} and {id}/skills variants
    expect(source).toContain('/^\\/api\\/v1\\/positions\\/[^/]+\\/status$/');
    expect(source).toContain('/^\\/api\\/v1\\/skills\\/[^/]+$/');
    expect(source).toContain('/^\\/api\\/v1\\/sports\\/[^/]+$/');
    expect(source).toContain('/^\\/api\\/v1\\/positions\\/[^/]+\\/skills\\/[^/]+$/');
  });

  it('every write handler enforces SystemAdmin via assertSystemAdminActor', () => {
    // Count distinct write blocks that resolve actor and gate on assertSystemAdminActor.
    // Each block resolves actor + checks before doing the write — that's the
    // SystemAdmin gate. Expect >=10 (sports x3, positions x3, skills x3,
    // position_skills x2).
    const gateOccurrences = source.match(/assertSystemAdminActor\(actor\)/g) ?? [];
    expect(gateOccurrences.length).toBeGreaterThanOrEqual(11);
  });

  it('uses ON DELETE RESTRICT semantics by checking assignment count before delete', () => {
    expect(source).toMatch(/DELETE.*skills.*skill_id.*\$1|DELETE FROM skills WHERE id = \$1/s);
    // The pre-check before delete:
    expect(source).toMatch(/SELECT COUNT\(\*\)::int AS n FROM position_skills WHERE skill_id = \$1/);
    expect(source).toContain('Cannot delete skill');
  });

  it('POST /positions/:id/skills has the 200/201 idempotent split', () => {
    const block = source.match(/POST.*positions.*skills[\s\S]*?sendJson\(res, 201[\s\S]*?\);[\s\S]*?return;\s*}/);
    expect(block).not.toBeNull();
    expect(block![0]).toContain('sendJson(res, 200');
    expect(block![0]).toContain('sendJson(res, 201');
  });

  it('DELETE /positions/:id/skills/:skillId is non-idempotent (204 / 404)', () => {
    expect(source).toContain("sendJson(res, 404, appError(404, 'not_found', 'Assignment not found.'))");
  });

  it('validates name length 2-40/2-80/2-60 for sport/position/skill', () => {
    expect(source).toContain("validateName(payload.name, 2, 40, 'Sport')");
    expect(source).toContain("validateName(payload.name, 2, 80, 'Position')");
    expect(source).toContain("validateName(payload.name, 2, 60, 'Skill')");
  });

  it('rejects non-active sport when creating a position', () => {
    expect(source).toContain('Cannot add a position under an inactive sport.');
  });

  it('rejects non-active skill when assigning to a position', () => {
    expect(source).toContain('Cannot assign an inactive skill.');
  });

  it('enforces sportId on POST /positions', () => {
    expect(source).toContain('Position requires a sportId.');
  });
});