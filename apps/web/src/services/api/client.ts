import type {
  AdminUser,
  ChangePasswordPayload,
  ChangeRolePayload,
  CreateUserPayload
} from '../../features/admin-users/types';
import { ApiError, type ApiErrorCode } from './errors';

export type AdminUsersApiClient = {
  listUsers: () => Promise<AdminUser[]>;
  createUser: (payload: CreateUserPayload) => Promise<AdminUser>;
  changeUserRole: (payload: ChangeRolePayload) => Promise<AdminUser>;
  changeUserPassword: (payload: ChangePasswordPayload) => Promise<void>;
};

export class HttpAdminUsersApiClient implements AdminUsersApiClient {
  constructor(private readonly basePath = '/v1') {}

  private async throwApiError(response: Response): Promise<never> {
    let code: ApiErrorCode = 'unknown';
    let message = `http:${response.status}`;

    try {
      const body = (await response.json()) as { code?: ApiErrorCode; message?: string };
      code = body.code ?? 'unknown';
      message = body.message ?? message;
    } catch {
      // Keep fallback status-based values when body is unavailable.
    }

    throw new ApiError(response.status, code, message);
  }

  async listUsers(): Promise<AdminUser[]> {
    const response = await fetch(`${this.basePath}/users`);
    if (!response.ok) {
      return this.throwApiError(response);
    }

    const body = (await response.json()) as { data: AdminUser[] };
    return body.data;
  }

  async createUser(payload: CreateUserPayload): Promise<AdminUser> {
    const response = await fetch(`${this.basePath}/users`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      return this.throwApiError(response);
    }

    const body = (await response.json()) as { data: AdminUser };
    return body.data;
  }

  async changeUserRole(payload: ChangeRolePayload): Promise<AdminUser> {
    const response = await fetch(`${this.basePath}/users/${payload.userId}/role`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role: payload.role })
    });

    if (!response.ok) {
      return this.throwApiError(response);
    }

    const body = (await response.json()) as { data: AdminUser };
    return body.data;
  }

  async changeUserPassword(payload: ChangePasswordPayload): Promise<void> {
    const response = await fetch(`${this.basePath}/users/${payload.userId}/password`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        newPassword: payload.newPassword,
        confirmPassword: payload.confirmPassword
      })
    });

    if (!response.ok) {
      return this.throwApiError(response);
    }
  }
}
