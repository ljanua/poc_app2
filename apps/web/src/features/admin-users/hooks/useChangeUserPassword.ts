import type { ChangePasswordPayload } from '../types';
import {
  HttpAdminUsersApiClient,
  type AdminUsersApiClient
} from '../../../services/api/client';

export function useChangeUserPassword(
  client: Pick<AdminUsersApiClient, 'changeUserPassword'> = new HttpAdminUsersApiClient()
) {
  const changeUserPassword = async (payload: ChangePasswordPayload): Promise<void> => {
    const hasNumber = /\d/.test(payload.newPassword);

    if (payload.newPassword.length < 10 || !hasNumber) {
      throw new Error('validation:password_policy_failed');
    }

    if (payload.newPassword !== payload.confirmPassword) {
      throw new Error('validation:password_mismatch');
    }

    await client.changeUserPassword(payload);
  };

  return { changeUserPassword };
}
