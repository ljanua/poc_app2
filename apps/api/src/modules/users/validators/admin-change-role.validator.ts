import { appValidationError } from '../../../shared/errors/app-error';

export type ChangeRolePayload = {
  role: 'SystemAdmin' | 'Coach';
};

export function validateAdminChangeRole(payload: ChangeRolePayload): void {
  if (!['SystemAdmin', 'Coach'].includes(payload.role)) {
    throw appValidationError();
  }
}
