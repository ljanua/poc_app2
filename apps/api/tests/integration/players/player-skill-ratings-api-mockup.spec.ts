import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

describe('player skill ratings handlers in serve-mockup.js', () => {
  const source = fs.readFileSync(path.join(process.cwd(), 'scripts', 'serve-mockup.js'), 'utf8');

  it('declares the four skill-rating helpers', () => {
    expect(source).toContain('async function listSkillsForPlayer(');
    expect(source).toContain('async function replaceSkillRatingsForPosition(');
    expect(source).toContain('function parseUpdateSkillRatingsPayload(');
    expect(source).toContain('async function upsertSkillRatings(');
  });

  it('listSkillsForPlayer joins position_skills and player_skill_ratings', () => {
    const start = source.indexOf('async function listSkillsForPlayer(');
    expect(start).toBeGreaterThanOrEqual(0);
    const body = source.slice(start, start + 1800);
    expect(body).toContain('position_skills');
    expect(body).toContain('player_skill_ratings');
    expect(body).toContain('LOWER(p.name) = LOWER(pl.position)');
  });

  it('PATCH /players invokes replaceSkillRatingsForPosition on position change', () => {
    expect(source).toContain('await replaceSkillRatingsForPosition(client, playerId, newPositionId)');
    expect(source).toContain('previousPosition !== nextPosition');
  });

  it('handles PUT /players/{id}/skill-ratings', () => {
    expect(source).toContain("pathname.match(/^\\/api\\/v1\\/players\\/([^/]+)\\/skill-ratings$/)");
    expect(source).toContain("req.method === 'PUT' && skillRatingsMatch");
  });

  it('rejects skills outside the player position with the planned message', () => {
    expect(source).toContain("is not tracked for the player's position");
    expect(source).toContain('Manage Skills (S8)');
  });

  it('upserts ratings and clears null ratings via DELETE', () => {
    expect(source).toContain('ON CONFLICT (player_id, skill_id) DO UPDATE SET');
    expect(source).toContain(
      'DELETE FROM player_skill_ratings WHERE player_id = $1 AND skill_id = $2'
    );
  });

  it('includes skillRatings on dashboard and profile responses', () => {
    expect(source).toContain('skillRatings: Array.isArray(skillRatings) ? skillRatings : []');
    expect(source).toContain('const skillRatings = await listSkillsForPlayer(dashboardRows.rows[0].id)');
    expect(source).toContain('skillRatings: payload.skillRatings');
  });

  it('replaceSkillRatingsForPosition deletes then inserts NULL rows', () => {
    const start = source.indexOf('async function replaceSkillRatingsForPosition(');
    expect(start).toBeGreaterThanOrEqual(0);
    const body = source.slice(start, start + 900);
    expect(body).toContain('DELETE FROM player_skill_ratings WHERE player_id = $1');
    expect(body).toContain('INSERT INTO player_skill_ratings (player_id, skill_id, rating)');
    expect(body).toContain('SELECT $1, ps.skill_id, NULL');
  });
});
