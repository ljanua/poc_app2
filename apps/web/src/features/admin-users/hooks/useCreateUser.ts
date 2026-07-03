import type { AdminUser, CreateUserPayload } from '../types';
import {
  HttpAdminUsersApiClient,
  type AdminUsersApiClient
} from '../../../services/api/client';

export function useCreateUser(client: Pick<AdminUsersApiClient, 'createUser'> = new HttpAdminUsersApiClient()) {
  const createUser = async (
    payload: CreateUserPayload,
    current: AdminUser[]
  ): Promise<AdminUser[]> => {
    const created = await client.createUser(payload);

    return [created, ...current];
  };

  return { createUser };
}
