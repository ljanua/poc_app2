import type {
  AssignTeamToClubPayload,
  AssignUserClubPayload,
  Club,
  ClubMembership,
  ClubStatusPayload,
  CreateClubPayload,
  RemoveUserClubParams,
  UpdateClubPayload
} from '../types';
import { ApiError, type ApiErrorCode } from '../../../services/api/errors';

export type ClubsApiClient = {
  listClubs: (status?: 'active' | 'inactive' | 'all') => Promise<Club[]>;
  createClub: (payload: CreateClubPayload) => Promise<Club>;
  updateClub: (clubId: string, payload: UpdateClubPayload) => Promise<Club>;
  setClubStatus: (clubId: string, payload: ClubStatusPayload) => Promise<Club>;
  listUserClubs: (userId: string) => Promise<ClubMembership[]>;
  assignUserToClub: (payload: AssignUserClubPayload) => Promise<ClubMembership>;
  removeUserFromClub: (params: RemoveUserClubParams) => Promise<void>;
  assignTeamToClub: (clubId: string, payload: AssignTeamToClubPayload) => Promise<unknown>;
};

export class HttpClubsApiClient implements ClubsApiClient {
  constructor(private readonly basePath = '/api/v1') {}

  private async throwApiError(response: Response): Promise<never> {
    let code: ApiErrorCode = 'unknown';
    let message = `http:${response.status}`;
    try {
      const body = (await response.json()) as { code?: ApiErrorCode; message?: string };
      code = body.code ?? 'unknown';
      message = body.message ?? message;
    } catch {
      // Keep fallback values when the body is unavailable.
    }
    throw new ApiError(response.status, code, message);
  }

  async listClubs(status: 'active' | 'inactive' | 'all' = 'active'): Promise<Club[]> {
    const query = status ? `?status=${encodeURIComponent(status)}` : '';
    const response = await fetch(`${this.basePath}/clubs${query}`);
    if (!response.ok) {
      return this.throwApiError(response);
    }
    const body = (await response.json()) as { data: Club[] };
    return body.data;
  }

  async createClub(payload: CreateClubPayload): Promise<Club> {
    const response = await fetch(`${this.basePath}/clubs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (!response.ok) {
      return this.throwApiError(response);
    }
    const body = (await response.json()) as { data: Club };
    return body.data;
  }

  async updateClub(clubId: string, payload: UpdateClubPayload): Promise<Club> {
    const response = await fetch(`${this.basePath}/clubs/${encodeURIComponent(clubId)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (!response.ok) {
      return this.throwApiError(response);
    }
    const body = (await response.json()) as { data: Club };
    return body.data;
  }

  async setClubStatus(clubId: string, payload: ClubStatusPayload): Promise<Club> {
    const response = await fetch(`${this.basePath}/clubs/${encodeURIComponent(clubId)}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (!response.ok) {
      return this.throwApiError(response);
    }
    const body = (await response.json()) as { data: Club };
    return body.data;
  }

  async listUserClubs(userId: string): Promise<ClubMembership[]> {
    const response = await fetch(`${this.basePath}/users/${encodeURIComponent(userId)}/clubs`);
    if (!response.ok) {
      return this.throwApiError(response);
    }
    const body = (await response.json()) as { data: ClubMembership[] };
    return body.data;
  }

  async assignUserToClub(payload: AssignUserClubPayload): Promise<ClubMembership> {
    const response = await fetch(
      `${this.basePath}/users/${encodeURIComponent(payload.userId)}/clubs`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clubId: payload.clubId })
      }
    );
    if (!response.ok) {
      return this.throwApiError(response);
    }
    const body = (await response.json()) as { data: ClubMembership };
    return body.data;
  }

  async removeUserFromClub({ userId, clubId }: RemoveUserClubParams): Promise<void> {
    const response = await fetch(
      `${this.basePath}/users/${encodeURIComponent(userId)}/clubs/${encodeURIComponent(clubId)}`,
      { method: 'DELETE' }
    );
    if (!response.ok) {
      return this.throwApiError(response);
    }
  }

  async assignTeamToClub(clubId: string, payload: AssignTeamToClubPayload): Promise<unknown> {
    const response = await fetch(`${this.basePath}/clubs/${encodeURIComponent(clubId)}/teams`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (!response.ok) {
      return this.throwApiError(response);
    }
    const body = (await response.json()) as { data: unknown };
    return body.data;
  }
}