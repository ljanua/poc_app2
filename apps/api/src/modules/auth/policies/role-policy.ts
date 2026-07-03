export type Role = 'SystemAdmin' | 'Coach';
import { appForbiddenError } from '../../../shared/errors/app-error';

export function assertSystemAdmin(role: Role): void {
  if (role !== 'SystemAdmin') {
    throw appForbiddenError();
  }
}
