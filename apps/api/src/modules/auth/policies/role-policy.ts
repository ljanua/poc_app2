export type Role = 'SystemAdmin' | 'Coach' | 'ClubAdmin';
import { appForbiddenError } from '../../../shared/errors/app-error';

export function assertSystemAdmin(role: Role): void {
  if (role !== 'SystemAdmin') {
    throw appForbiddenError();
  }
}

export function isClubScopedRole(role: Role | string | null | undefined): boolean {
  return role === 'Coach' || role === 'ClubAdmin';
}
