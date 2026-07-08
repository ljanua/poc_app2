import type {
  AssignSkillToPositionPayload,
  CreatePositionPayload,
  CreateSkillPayload,
  CreateSportPayload,
  Position,
  PositionSkill,
  PositionStatusPayload,
  Skill,
  Sport,
  SportStatusPayload,
  UpdatePositionPayload,
  UpdateSkillPayload,
  UpdateSportPayload
} from '../types';
import { ApiError, type ApiErrorCode } from '../../../services/api/errors';

export type StatusFilter = 'active' | 'inactive' | 'all';

export type SkillsApiClient = {
  listSports: (status?: StatusFilter) => Promise<Sport[]>;
  createSport: (payload: CreateSportPayload) => Promise<Sport>;
  updateSport: (sportId: string, payload: UpdateSportPayload) => Promise<Sport>;
  setSportStatus: (sportId: string, payload: SportStatusPayload) => Promise<Sport>;
  listPositions: (sportId: string, status?: StatusFilter) => Promise<Position[]>;
  createPosition: (payload: CreatePositionPayload) => Promise<Position>;
  updatePosition: (positionId: string, payload: UpdatePositionPayload) => Promise<Position>;
  setPositionStatus: (positionId: string, payload: PositionStatusPayload) => Promise<Position>;
  listSkills: (status?: StatusFilter) => Promise<Skill[]>;
  createSkill: (payload: CreateSkillPayload) => Promise<Skill>;
  updateSkill: (skillId: string, payload: UpdateSkillPayload) => Promise<Skill>;
  deleteSkill: (skillId: string) => Promise<void>;
  listPositionSkills: (positionId: string) => Promise<PositionSkill[]>;
  assignSkillToPosition: (positionId: string, payload: AssignSkillToPositionPayload) => Promise<PositionSkill[]>;
  removeSkillFromPosition: (positionId: string, skillId: string) => Promise<void>;
};

export class HttpSkillsApiClient implements SkillsApiClient {
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

  private buildQuery(filter: StatusFilter | undefined): string {
    if (!filter) return '';
    return `?status=${encodeURIComponent(filter)}`;
  }

  async listSports(status: StatusFilter = 'active'): Promise<Sport[]> {
    const response = await fetch(`${this.basePath}/sports${this.buildQuery(status)}`);
    if (!response.ok) {
      return this.throwApiError(response);
    }
    const body = (await response.json()) as { data: Sport[] };
    return body.data;
  }

  async createSport(payload: CreateSportPayload): Promise<Sport> {
    const response = await fetch(`${this.basePath}/sports`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (!response.ok) {
      return this.throwApiError(response);
    }
    const body = (await response.json()) as { data: Sport };
    return body.data;
  }

  async updateSport(sportId: string, payload: UpdateSportPayload): Promise<Sport> {
    const response = await fetch(`${this.basePath}/sports/${encodeURIComponent(sportId)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (!response.ok) {
      return this.throwApiError(response);
    }
    const body = (await response.json()) as { data: Sport };
    return body.data;
  }

  async setSportStatus(sportId: string, payload: SportStatusPayload): Promise<Sport> {
    const response = await fetch(`${this.basePath}/sports/${encodeURIComponent(sportId)}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (!response.ok) {
      return this.throwApiError(response);
    }
    const body = (await response.json()) as { data: Sport };
    return body.data;
  }

  async listPositions(sportId: string, status: StatusFilter = 'active'): Promise<Position[]> {
    const query = `?sportId=${encodeURIComponent(sportId)}${status ? `&status=${encodeURIComponent(status)}` : ''}`;
    const response = await fetch(`${this.basePath}/positions${query}`);
    if (!response.ok) {
      return this.throwApiError(response);
    }
    const body = (await response.json()) as { data: Position[] };
    return body.data;
  }

  async createPosition(payload: CreatePositionPayload): Promise<Position> {
    const response = await fetch(`${this.basePath}/positions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (!response.ok) {
      return this.throwApiError(response);
    }
    const body = (await response.json()) as { data: Position };
    return body.data;
  }

  async updatePosition(positionId: string, payload: UpdatePositionPayload): Promise<Position> {
    const response = await fetch(`${this.basePath}/positions/${encodeURIComponent(positionId)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (!response.ok) {
      return this.throwApiError(response);
    }
    const body = (await response.json()) as { data: Position };
    return body.data;
  }

  async setPositionStatus(positionId: string, payload: PositionStatusPayload): Promise<Position> {
    const response = await fetch(`${this.basePath}/positions/${encodeURIComponent(positionId)}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (!response.ok) {
      return this.throwApiError(response);
    }
    const body = (await response.json()) as { data: Position };
    return body.data;
  }

  async listSkills(status: StatusFilter = 'active'): Promise<Skill[]> {
    const response = await fetch(`${this.basePath}/skills${this.buildQuery(status)}`);
    if (!response.ok) {
      return this.throwApiError(response);
    }
    const body = (await response.json()) as { data: Skill[] };
    return body.data;
  }

  async createSkill(payload: CreateSkillPayload): Promise<Skill> {
    const response = await fetch(`${this.basePath}/skills`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (!response.ok) {
      return this.throwApiError(response);
    }
    const body = (await response.json()) as { data: Skill };
    return body.data;
  }

  async updateSkill(skillId: string, payload: UpdateSkillPayload): Promise<Skill> {
    const response = await fetch(`${this.basePath}/skills/${encodeURIComponent(skillId)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (!response.ok) {
      return this.throwApiError(response);
    }
    const body = (await response.json()) as { data: Skill };
    return body.data;
  }

  async deleteSkill(skillId: string): Promise<void> {
    const response = await fetch(`${this.basePath}/skills/${encodeURIComponent(skillId)}`, {
      method: 'DELETE'
    });
    if (!response.ok) {
      return this.throwApiError(response);
    }
  }

  async listPositionSkills(positionId: string): Promise<PositionSkill[]> {
    const response = await fetch(
      `${this.basePath}/positions/${encodeURIComponent(positionId)}/skills`
    );
    if (!response.ok) {
      return this.throwApiError(response);
    }
    const body = (await response.json()) as { data: PositionSkill[] };
    return body.data;
  }

  async assignSkillToPosition(
    positionId: string,
    payload: AssignSkillToPositionPayload
  ): Promise<PositionSkill[]> {
    const response = await fetch(
      `${this.basePath}/positions/${encodeURIComponent(positionId)}/skills`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      }
    );
    if (!response.ok) {
      return this.throwApiError(response);
    }
    const body = (await response.json()) as { data: PositionSkill[] };
    return body.data;
  }

  async removeSkillFromPosition(positionId: string, skillId: string): Promise<void> {
    const response = await fetch(
      `${this.basePath}/positions/${encodeURIComponent(positionId)}/skills/${encodeURIComponent(skillId)}`,
      { method: 'DELETE' }
    );
    if (!response.ok) {
      return this.throwApiError(response);
    }
  }
}