import { describe, expect, it, vi } from 'vitest';
import { HttpClubsApiClient } from '../../../../src/features/admin-clubs/services/clubs-api-client';

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' }
  });
}

describe('HttpClubsApiClient', () => {
  it('lists clubs with the requested status filter', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo) => {
      const url = String(input);
      expect(url).toBe('/api/v1/clubs?status=active');
      return jsonResponse({ data: [{ id: 'c_1', name: 'Norte FC', status: 'active' }] });
    });
    vi.stubGlobal('fetch', fetchMock);

    const client = new HttpClubsApiClient();
    const clubs = await client.listClubs('active');

    expect(clubs).toEqual([{ id: 'c_1', name: 'Norte FC', status: 'active' }]);
    vi.unstubAllGlobals();
  });

  it('posts new clubs to /clubs with the JSON body', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo, init?: RequestInit) => {
      const url = String(input);
      expect(url).toBe('/api/v1/clubs');
      expect(init?.method).toBe('POST');
      expect(JSON.parse(String(init?.body))).toEqual({ name: 'Norte FC' });
      return jsonResponse(
        { data: { id: 'c_norte_fc', name: 'Norte FC', status: 'active' } },
        201
      );
    });
    vi.stubGlobal('fetch', fetchMock);

    const client = new HttpClubsApiClient();
    const club = await client.createClub({ name: 'Norte FC' });

    expect(club.id).toBe('c_norte_fc');
    vi.unstubAllGlobals();
  });

  it('assigns a user to a club with POST /users/{id}/clubs', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo, init?: RequestInit) => {
      const url = String(input);
      expect(url).toBe('/api/v1/users/u_42/clubs');
      expect(init?.method).toBe('POST');
      return jsonResponse({
        data: { userId: 'u_42', clubId: 'c_norte_fc', clubName: 'Norte FC', status: 'active' }
      });
    });
    vi.stubGlobal('fetch', fetchMock);

    const client = new HttpClubsApiClient();
    const membership = await client.assignUserToClub({ userId: 'u_42', clubId: 'c_norte_fc' });

    expect(membership.clubName).toBe('Norte FC');
    vi.unstubAllGlobals();
  });

  it('issues a DELETE for removeUserFromClub', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo, init?: RequestInit) => {
      const url = String(input);
      expect(url).toBe('/api/v1/users/u_42/clubs/c_norte_fc');
      expect(init?.method).toBe('DELETE');
      return new Response(null, { status: 204 });
    });
    vi.stubGlobal('fetch', fetchMock);

    const client = new HttpClubsApiClient();
    await client.removeUserFromClub({ userId: 'u_42', clubId: 'c_norte_fc' });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    vi.unstubAllGlobals();
  });
});