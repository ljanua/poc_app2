import type { AdminUser, ChangeRolePayload } from '../types';
import {
  HttpAdminUsersApiClient,
  type AdminUsersApiClient
} from '../../../services/api/client';

export function useChangeUserRole(
  client: Pick<AdminUsersApiClient, 'changeUserRole'> = new HttpAdminUsersApiClient()
) {
  const changeUserRole = async (
    payload: ChangeRolePayload,
    current: AdminUser[]
  ): Promise<AdminUser[]> => {
    const updated = await client.changeUserRole(payload);

    return current.map((user) =>
      user.id === payload.userId ? { ...user, role: updated.role } : user
    );
  };

  return { changeUserRole };
}
