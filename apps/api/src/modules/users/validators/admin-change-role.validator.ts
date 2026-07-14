import { appValidationError } from '../../../shared/errors/app-error';

export type ChangeRolePayload = {
  role: 'SystemAdmin' | 'Coach' | 'ClubAdmin';
};

const ALLOWED_ROLES = ['SystemAdmin', 'Coach', 'ClubAdmin'];

export function validateAdminChangeRole(payload: ChangeRolePayload): void {
  if (!ALLOWED_ROLES.includes(payload.role)) {
    throw appValidationError();
  }
}
