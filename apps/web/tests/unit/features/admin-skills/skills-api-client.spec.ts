import { describe, expect, it, vi } from 'vitest';
import { HttpSkillsApiClient } from '../../../../src/features/admin-skills/services/skills-api-client';

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' }
  });
}

describe('HttpSkillsApiClient', () => {
  it('lists skills with the requested status filter', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo) => {
      const url = String(input);
      expect(url).toBe('/api/v1/skills?status=active');
      return jsonResponse({
        data: [{ id: 's_passing', name: 'Passing', status: 'active' }]
      });
    });
    vi.stubGlobal('fetch', fetchMock);

    const client = new HttpSkillsApiClient();
    const skills = await client.listSkills('active');

    expect(skills).toEqual([{ id: 's_passing', name: 'Passing', status: 'active' }]);
    vi.unstubAllGlobals();
  });

  it('posts new skills to /skills with the JSON body', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo, init?: RequestInit) => {
      const url = String(input);
      expect(url).toBe('/api/v1/skills');
      expect(init?.method).toBe('POST');
      expect(JSON.parse(String(init?.body))).toEqual({ name: 'Passing' });
      return jsonResponse(
        { data: { id: 's_passing', name: 'Passing', status: 'active' } },
        201
      );
    });
    vi.stubGlobal('fetch', fetchMock);

    const client = new HttpSkillsApiClient();
    const skill = await client.createSkill({ name: 'Passing' });

    expect(skill.id).toBe('s_passing');
    vi.unstubAllGlobals();
  });

  it('assigns a skill to a position via POST /positions/{id}/skills', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo, init?: RequestInit) => {
      const url = String(input);
      expect(url).toBe('/api/v1/positions/pos_gk/skills');
      expect(init?.method).toBe('POST');
      expect(JSON.parse(String(init?.body))).toEqual({ skillId: 's_passing' });
      return jsonResponse({
        data: [
          {
            positionId: 'pos_gk',
            skillId: 's_passing',
            skillName: 'Passing',
            status: 'active'
          }
        ]
      });
    });
    vi.stubGlobal('fetch', fetchMock);

    const client = new HttpSkillsApiClient();
    const assignments = await client.assignSkillToPosition('pos_gk', {
      skillId: 's_passing'
    });

    expect(assignments).toHaveLength(1);
    expect(assignments[0].skillId).toBe('s_passing');
    vi.unstubAllGlobals();
  });

  it('issues a DELETE for removeSkillFromPosition', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo, init?: RequestInit) => {
      const url = String(input);
      expect(url).toBe('/api/v1/positions/pos_gk/skills/s_passing');
      expect(init?.method).toBe('DELETE');
      return new Response(null, { status: 204 });
    });
    vi.stubGlobal('fetch', fetchMock);

    const client = new HttpSkillsApiClient();
    await client.removeSkillFromPosition('pos_gk', 's_passing');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    vi.unstubAllGlobals();
  });

  it('lists positions scoped by sportId', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo) => {
      const url = String(input);
      expect(url).toBe('/api/v1/positions?sportId=sport_soccer&status=active');
      return jsonResponse({
        data: [
          { id: 'pos_gk', name: 'GK – Goalkeeper', sportId: 'sport_soccer', status: 'active' }
        ]
      });
    });
    vi.stubGlobal('fetch', fetchMock);

    const client = new HttpSkillsApiClient();
    const positions = await client.listPositions('sport_soccer', 'active');

    expect(positions).toHaveLength(1);
    expect(positions[0].sportId).toBe('sport_soccer');
    vi.unstubAllGlobals();
  });

  it('sets sport status via PATCH /sports/{id}/status', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo, init?: RequestInit) => {
      const url = String(input);
      expect(url).toBe('/api/v1/sports/sport_soccer/status');
      expect(init?.method).toBe('PATCH');
      expect(JSON.parse(String(init?.body))).toEqual({ status: 'inactive' });
      return jsonResponse({
        data: { id: 'sport_soccer', name: 'Soccer', status: 'inactive' }
      });
    });
    vi.stubGlobal('fetch', fetchMock);

    const client = new HttpSkillsApiClient();
    const sport = await client.setSportStatus('sport_soccer', { status: 'inactive' });
    expect(sport.status).toBe('inactive');
    vi.unstubAllGlobals();
  });

  it('throws an ApiError for a 409 conflict response', async () => {
    const fetchMock = vi.fn(async () =>
      jsonResponse({ code: 'conflict', message: 'Name already exists' }, 409)
    );
    vi.stubGlobal('fetch', fetchMock);

    const client = new HttpSkillsApiClient();
    await expect(client.createSkill({ name: 'Dup' })).rejects.toMatchObject({
      status: 409,
      code: 'conflict'
    });
    vi.unstubAllGlobals();
  });
});