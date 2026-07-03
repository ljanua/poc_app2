import { describe, expect, it } from 'vitest';
import {
  canAccessAdminUsers,
  filterUsers,
  getAdminUsersErrorMessage
} from '../../../../src/features/admin-users/pages/AdminUsersPage';
import { ApiError } from '../../../../src/services/api/errors';

describe('AdminUsersPage', () => {
  it('enforces admin-only route access', () => {
    expect(canAccessAdminUsers('SystemAdmin')).toBe(true);
    expect(canAccessAdminUsers('Coach')).toBe(false);
  });

  it('filters by name or email case-insensitively', () => {
    const users = [
      { id: 'u_1', name: 'Maria Alves', email: 'maria@vantageiq.club', role: 'SystemAdmin', status: 'active' },
      { id: 'u_2', name: 'Joao Lima', email: 'joao@vantageiq.club', role: 'Coach', status: 'active' }
    ] as const;

    expect(filterUsers(users as never, 'maria')).toHaveLength(1);
    expect(filterUsers(users as never, 'JOAO@')).toHaveLength(1);
    expect(filterUsers(users as never, 'unknown')).toHaveLength(0);
  });

  it('maps contract-specific API errors to user feedback messages', () => {
    expect(getAdminUsersErrorMessage(new ApiError(403, 'forbidden', 'Forbidden'))).toBe(
      'You do not have permission to perform this action.'
    );

    expect(getAdminUsersErrorMessage(new ApiError(409, 'conflict', 'Conflict'))).toBe(
      'A user with the same identifier already exists.'
    );

    expect(getAdminUsersErrorMessage(new ApiError(400, 'validation_error', 'Validation failed'))).toBe(
      'Please review the form fields and try again.'
    );
  });
});
