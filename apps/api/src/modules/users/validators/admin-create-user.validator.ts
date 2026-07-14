import { appValidationError } from '../../../shared/errors/app-error';

export type CreateUserPayload = {
  name: string;
  email: string;
  role: 'SystemAdmin' | 'Coach' | 'ClubAdmin';
  initialPassword: string;
};

const ALLOWED_ROLES = ['SystemAdmin', 'Coach', 'ClubAdmin'];

export function validateAdminCreateUser(payload: CreateUserPayload): void {
  if (!payload.name?.trim()) throw appValidationError();
  if (!payload.email?.includes('@')) throw appValidationError();
  if (!ALLOWED_ROLES.includes(payload.role)) throw appValidationError();
  if (payload.initialPassword.length < 10) throw appValidationError();
}
