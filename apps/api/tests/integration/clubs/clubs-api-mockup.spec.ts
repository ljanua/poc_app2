import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

describe('clubs-admin mockup handlers', () => {
  const servePath = path.join(process.cwd(), 'scripts', 'serve-mockup.js');
  const source = fs.readFileSync(servePath, 'utf8');

  it('GET /v1/clubs honours a ?status=active|inactive|all filter', () => {
    const start = source.indexOf("if (req.method === 'GET' && requestUrl.pathname === `${apiPrefix}/clubs`) {");
    expect(start, 'GET /v1/clubs handler should exist').toBeGreaterThanOrEqual(0);
    const block = source.slice(start, start + 4000);
    expect(block).toContain("requestUrl.searchParams.get('status')");
    expect(block).toMatch(/statusFilter\s*===\s*'all'/);
    expect(block).toContain("statusFilterRaw");
  });

  it('POST /v1/clubs is SystemAdmin-gated and rejects duplicate names with 409', () => {
    const start = source.indexOf("if (req.method === 'POST' && requestUrl.pathname === `${apiPrefix}/clubs`) {");
    expect(start).toBeGreaterThanOrEqual(0);
    const block = source.slice(start, start + 4000);
    expect(block).toContain("assertSystemAdminActor");
    expect(block).toMatch(/sendJson\(res,\s*409,/);
    expect(block).toMatch(/sendJson\(res,\s*201,/);
  });

  it('PATCH /v1/clubs/{id} supports rename with 404 and 409 handling', () => {
    const start = source.indexOf("if (req.method === 'PATCH' && requestUrl.pathname.match(/^\\/api\\/v1\\/clubs\\/([^/]+)$/))");
    expect(start).toBeGreaterThanOrEqual(0);
    const block = source.slice(start, start + 4000);
    expect(block).toContain("assertSystemAdminActor");
    expect(block).toMatch(/sendJson\(res,\s*404,/);
    expect(block).toMatch(/sendJson\(res,\s*409,/);
  });

  it('PATCH /v1/clubs/{id}/status flips lifecycle with 400 on bad value', () => {
    const start = source.indexOf("if (req.method === 'PATCH' && requestUrl.pathname.match(/^\\/api\\/v1\\/clubs\\/([^/]+)\\/status$/))");
    expect(start).toBeGreaterThanOrEqual(0);
    const block = source.slice(start, start + 3000);
    expect(block).toMatch(/'active', 'inactive'/);
    expect(block).toMatch(/sendJson\(res,\s*400,/);
    expect(block).toMatch(/sendJson\(res,\s*200,/);
  });

  it('POST /v1/clubs/{id}/coaches inserts idempotent coach_clubs row', () => {
    const start = source.indexOf("if (req.method === 'POST' && requestUrl.pathname.match(/^\\/api\\/v1\\/clubs\\/([^/]+)\\/coaches$/))");
    expect(start).toBeGreaterThanOrEqual(0);
    const block = source.slice(start, start + 2500);
    expect(block).toContain("INSERT INTO coach_clubs (user_id, club_id) VALUES ($1, $2) ON CONFLICT (user_id, club_id) DO NOTHING");
    expect(block).toMatch(/sendJson\(res,\s*201,/);
    expect(block).toContain("Inactive users cannot be assigned to a club.");
    expect(block).toContain("Inactive clubs cannot accept new members.");
  });

  it('POST /v1/clubs/{id}/teams moves a team in an atomic transaction and seeds coach_clubs', () => {
    const start = source.indexOf("if (req.method === 'POST' && requestUrl.pathname.match(/^\\/api\\/v1\\/clubs\\/([^/]+)\\/teams$/))");
    expect(start).toBeGreaterThanOrEqual(0);
    const block = source.slice(start, start + 6000);
    expect(block).toContain("await pool.query('BEGIN')");
    expect(block).toContain("await pool.query('COMMIT')");
    expect(block).toContain("await pool.query('ROLLBACK')");
    expect(block).toMatch(/UPDATE teams SET club_id = \$1, updated_at = NOW\(\) WHERE id = \$2/);
    expect(block).toContain("INSERT INTO coach_clubs (user_id, club_id) VALUES ($1, $2) ON CONFLICT (user_id, club_id) DO NOTHING");
    expect(block).toMatch(/sendJson\(res,\s*200,/);
  });

  it('GET /v1/users/{id}/clubs is SystemAdmin-gated and returns memberships', () => {
    const start = source.indexOf("if (req.method === 'GET' && requestUrl.pathname.match(/^\\/api\\/v1\\/users\\/([^/]+)\\/clubs$/))");
    expect(start).toBeGreaterThanOrEqual(0);
    const block = source.slice(start, start + 3000);
    expect(block).toContain("assertSystemAdminActor");
    expect(block).toContain("FROM coach_clubs cc");
    expect(block).toMatch(/sendJson\(res,\s*200,/);
  });

  it('POST /v1/users/{id}/clubs returns 200 on idempotent re-insert and 201 on first add', () => {
    const start = source.indexOf("if (req.method === 'POST' && requestUrl.pathname.match(/^\\/api\\/v1\\/users\\/([^/]+)\\/clubs$/))");
    expect(start).toBeGreaterThanOrEqual(0);
    const nextBoundary = source.indexOf("if (req.method === 'DELETE' && requestUrl.pathname.match(/^\\/api\\/v1\\/users\\/([^/]+)\\/clubs\\/([^/]+)$/))", start);
    expect(nextBoundary).toBeGreaterThan(start);
    const block = source.slice(start, nextBoundary);
    expect(block).toContain("const status = alreadyMember ? 200 : 201;");
    expect(block).toContain("sendJson(res, status, {");
    expect(block).toContain("INSERT INTO coach_clubs (user_id, club_id) VALUES ($1, $2) ON CONFLICT (user_id, club_id) DO NOTHING");
  });

  it('DELETE /v1/users/{id}/clubs/{id} is SystemAdmin-gated and 404s when no row existed', () => {
    const start = source.indexOf("if (req.method === 'DELETE' && requestUrl.pathname.match(/^\\/api\\/v1\\/users\\/([^/]+)\\/clubs\\/([^/]+)$/))");
    expect(start).toBeGreaterThanOrEqual(0);
    const block = source.slice(start, start + 3000);
    expect(block).toContain("assertSystemAdminActor");
    expect(block).toContain("DELETE FROM coach_clubs WHERE user_id = $1 AND club_id = $2");
    expect(block).toMatch(/sendJson\(res,\s*404,/);
    expect(block).toMatch(/sendJson\(res,\s*204,/);
  });

  it('GET /v1/users payload includes clubIds so the S7 inline badge list can render', () => {
    const block = source.slice(
      source.indexOf("if (req.method === 'GET' && requestUrl.pathname === `${apiPrefix}/users`) {"),
      source.indexOf("if (req.method === 'GET' && requestUrl.pathname === `${apiPrefix}/users`) {") + 3000
    );
    expect(block).toContain("array_agg(club_id ORDER BY club_id) FROM coach_clubs WHERE user_id = users.id");
  });
});