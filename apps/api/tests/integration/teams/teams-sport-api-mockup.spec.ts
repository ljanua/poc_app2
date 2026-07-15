import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

describe('feature 012 — teams.sportId handler coverage', () => {
  const serverPath = path.join(process.cwd(), 'scripts', 'serve-mockup.js');
  const teamsSchemaPath = path.join(process.cwd(), 'openapi', 'v1', 'schemas', 'teams.yaml');
  const openapiPath = path.join(process.cwd(), 'openapi', 'v1', 'openapi.yaml');

  const source = fs.readFileSync(serverPath, 'utf8');

  // Helper: take a substring between two known anchors. The source is large
  // and brittle to extract via regex when nested braces appear; slicing by
  // anchors is more reliable for static-analysis assertions like these.
  function sliceBetween(start, end) {
    const startIdx = source.indexOf(start);
    if (startIdx < 0) return null;
    const endIdx = source.indexOf(end, startIdx);
    if (endIdx < 0) return null;
    return source.slice(startIdx, endIdx + end.length);
  }

  it('POST /api/v1/teams reads sportId from the body and falls back to sport_soccer', () => {
    const block = sliceBetween(
      "if (req.method === 'POST' && requestUrl.pathname === `${apiPrefix}/teams`) {",
      "sendJson(res, 201, { data: toTeamPayload(created.rows[0]) });"
    );
    expect(block, 'POST /api/v1/teams handler block').toBeTruthy();

    expect(block!).toMatch(/payload\.sportId \|\| ''/);
    expect(block!).toContain("'sport_soccer'");
    expect(block!).toMatch(/INSERT INTO teams \([\s\S]*?sport_id/);
    // Validates the sportId references an active sport row, returns 400 otherwise.
    expect(block!).toMatch(/SELECT id FROM sports WHERE id = \$1 AND status = 'active'/);
  });

  it('POST /api/v1/teams/:id/update accepts sportId, validates, and persists', () => {
    const block = sliceBetween(
      "if (req.method === 'POST' && requestUrl.pathname.match(/^\\/api\\/v1\\/teams\\/([^/]+)\\/update$/)) {",
      "sendJson(res, 200, { data: toTeamPayload(refreshed.rows[0]) });"
    );
    expect(block, 'POST /api/v1/teams/:id/update handler block').toBeTruthy();

    expect(block!).toMatch(/payload\.sportId \|\| ''/);
    expect(block!).toMatch(/SELECT id FROM sports WHERE id = \$1 AND status = 'active'/);
    expect(block!).toMatch(/UPDATE teams\s+SET[\s\S]*?sport_id = \$/);
    expect(block!).toMatch(/SET\s+name = \$1/);
    expect(block!).toMatch(/age_group = \$2/);
    expect(block!).toContain('A team with this name already exists.');
  });

  it('GET /api/v1/teams includes sportId and sportName in the SELECT projection', () => {
    const block = sliceBetween(
      "if (req.method === 'GET' && requestUrl.pathname === `${apiPrefix}/teams`) {",
      "sendJson(res, 200, { data: teamRows.rows.map(toTeamPayload) });"
    );
    expect(block, 'GET /api/v1/teams handler block').toBeTruthy();

    expect(block!).toContain('s.id AS "sportId"');
    expect(block!).toContain('s.name AS "sportName"');
    expect(block!).toContain('LEFT JOIN sports s ON s.id = t.sport_id');
  });

  it('toTeamPayload surfaces sportId and sportName on every team row', () => {
    const mapper = source.match(/function toTeamPayload\(row\) \{[\s\S]*?\n\}/);
    expect(mapper).toBeTruthy();
    expect(mapper![0]).toMatch(/sportId:[\s\S]*?row\.sportId \|\| row\.sport_id \|\| null/);
    expect(mapper![0]).toMatch(/sportName:[\s\S]*?row\.sportName \|\| row\.sport_name \|\| null/);
  });

  it('OpenAPI teams schema documents sportId/sportName and the new UpdateTeamRequest', () => {
    const schema = fs.readFileSync(teamsSchemaPath, 'utf8');
    expect(schema).toContain('sportId:');
    expect(schema).toContain('sportName:');
    expect(schema).toContain('UpdateTeamRequest:');
    expect(schema).toMatch(/sportId:\s*\n\s*type: string/);
  });

  it('OpenAPI main spec still references the teams paths (no schema breakage)', () => {
    const openapi = fs.readFileSync(openapiPath, 'utf8');
    // The teams.yaml schema is referenced from openapi.yaml as a $ref; the
    // reference itself plus the teams path definitions must still be intact.
    expect(openapi).toMatch(/schemas\/teams\.yaml/);
    expect(openapi).toMatch(/^ {2}\/teams:/m);
  });
});