import { describe, expect, it } from 'vitest';
import { UsersController } from '../../../src/modules/users/controllers/users.controller';

describe('user admin api scaffold', () => {
  it('supports create user, role change, and password change contract behavior', () => {
    const controller = new UsersController();

    const created = controller.createUser('SystemAdmin', {
      name: 'Joao Lima',
      email: 'joao@vantageiq.club',
      role: 'Coach',
      initialPassword: 'CoachAccess123'
    });

    const roleChanged = controller.changeRole('SystemAdmin', created.data.id, {
      role: 'SystemAdmin'
    });

    const passwordChanged = controller.changePassword('SystemAdmin', created.data.id, {
      newPassword: 'AdminSecure123',
      confirmPassword: 'AdminSecure123'
    });

    expect(created.data.email).toBe('joao@vantageiq.club');
    expect(roleChanged.data.role).toBe('SystemAdmin');
    expect(passwordChanged.status).toBe(204);
  });

  it('returns forbidden behavior for coach role', () => {
    const controller = new UsersController();

    expect(() => controller.list('Coach')).toThrow('You do not have permission to perform this action.');
  });
});
