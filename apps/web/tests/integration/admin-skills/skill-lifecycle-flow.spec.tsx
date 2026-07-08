import { describe, expect, it } from 'vitest';
import { HttpSkillsApiClient } from '../../../src/features/admin-skills/services/skills-api-client';
import type {
  Position,
  PositionSkill,
  Skill,
  Sport
} from '../../../src/features/admin-skills/types';

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' }
  });
}

describe('skill lifecycle flow', () => {
  it('walks through: create sport -> create position -> create skill -> assign -> remove', async () => {
    const createdSport: Sport = { id: 'sport_lifecycle', name: 'Lifecycle', status: 'active' };
    const createdPosition: Position = {
      id: 'pos_lifecycle',
      name: 'Lifecycle Position',
      sportId: 'sport_lifecycle',
      status: 'active'
    };
    const createdSkill: Skill = { id: 's_lifecycle', name: 'Lifecycle Skill', status: 'active' };

    const assignments: PositionSkill[] = [
      {
        positionId: 'pos_lifecycle',
        skillId: 's_lifecycle',
        skillName: 'Lifecycle Skill',
        status: 'active'
      }
    ];

    const fetchMock = (() => {
      const impl = async (input: RequestInfo, init?: RequestInit) => {
        const url = String(input);
        const method = init?.method ?? 'GET';
        if (method === 'POST' && url === '/api/v1/sports') {
          return jsonResponse({ data: createdSport }, 201);
        }
        if (method === 'POST' && url === '/api/v1/positions') {
          return jsonResponse({ data: createdPosition }, 201);
        }
        if (method === 'POST' && url === '/api/v1/skills') {
          return jsonResponse({ data: createdSkill }, 201);
        }
        if (method === 'POST' && url === '/api/v1/positions/pos_lifecycle/skills') {
          return jsonResponse({ data: assignments }, 201);
        }
        if (method === 'DELETE' && url === '/api/v1/positions/pos_lifecycle/skills/s_lifecycle') {
          return new Response(null, { status: 204 });
        }
        throw new Error(`unexpected call ${method} ${url}`);
      };
      return impl;
    })();

    // @ts-expect-error - stub global fetch for the test
    globalThis.fetch = fetchMock;

    const client = new HttpSkillsApiClient();

    const sport = await client.createSport({ name: 'Lifecycle' });
    expect(sport.id).toBe('sport_lifecycle');

    const position = await client.createPosition({
      name: 'Lifecycle Position',
      sportId: sport.id
    });
    expect(position.id).toBe('pos_lifecycle');

    const skill = await client.createSkill({ name: 'Lifecycle Skill' });
    expect(skill.id).toBe('s_lifecycle');

    const next = await client.assignSkillToPosition(position.id, { skillId: skill.id });
    expect(next).toHaveLength(1);
    expect(next[0].skillId).toBe('s_lifecycle');

    await client.removeSkillFromPosition(position.id, skill.id);
  });
});