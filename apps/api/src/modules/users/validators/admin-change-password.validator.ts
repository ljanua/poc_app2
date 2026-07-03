import { appValidationError } from '../../../shared/errors/app-error';

export type ChangePasswordPayload = {
  newPassword: string;
  confirmPassword: string;
};

export function validateAdminChangePassword(payload: ChangePasswordPayload): void {
  const hasNumber = /\d/.test(payload.newPassword);
  if (payload.newPassword.length < 10 || !hasNumber) {
    throw appValidationError();
  }

  if (payload.newPassword !== payload.confirmPassword) {
    throw appValidationError();
  }
}
