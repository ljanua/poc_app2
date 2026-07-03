import { describe, expect, it } from 'vitest';
import { UsersAdminService } from '../../../src/modules/users/services/users-admin.service';

describe('UsersAdminService', () => {
  it('allows system admin to create user and change role/password', () => {
    const service = new UsersAdminService();

    const created = service.createUser('SystemAdmin', {
      name: 'Ana Costa',
      email: 'ana@vantageiq.club',
      role: 'Coach',
      initialPassword: 'CoachPass123'
    });

    const updatedRole = service.changeUserRole('SystemAdmin', created.id, { role: 'SystemAdmin' });
    const updatedPassword = service.changeUserPassword('SystemAdmin', created.id, {
      newPassword: 'NewSecurePass123',
      confirmPassword: 'NewSecurePass123'
    });

    expect(updatedRole.role).toBe('SystemAdmin');
    expect(updatedPassword.passwordHash).toContain('hash_');
  });

  it('denies coach role from admin operations', () => {
    const service = new UsersAdminService();

    expect(() =>
      service.createUser('Coach', {
        name: 'Blocked User',
        email: 'blocked@vantageiq.club',
        role: 'Coach',
        initialPassword: 'BlockedPass123'
      })
    ).toThrow('You do not have permission to perform this action.');
  });
});
