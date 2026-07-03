import { describe, expect, it } from 'vitest';
import { useCreateUser } from '../../../src/features/admin-users/hooks/useCreateUser';
import { useChangeUserRole } from '../../../src/features/admin-users/hooks/useChangeUserRole';
import { useChangeUserPassword } from '../../../src/features/admin-users/hooks/useChangeUserPassword';
import type { AdminUser } from '../../../src/features/admin-users/types';

describe('admin user lifecycle flow', () => {
  it('creates user, changes role, and changes password through injected API client contracts', async () => {
    const startingUsers: AdminUser[] = [
      {
        id: 'u_1',
        name: 'Maria Alves',
        email: 'maria@vantageiq.club',
        role: 'SystemAdmin',
        status: 'active'
      }
    ];

    const createdUser: AdminUser = {
      id: 'u_2',
      name: 'Joao Lima',
      email: 'joao@vantageiq.club',
      role: 'Coach',
      status: 'active'
    };

    const createHook = useCreateUser({
      createUser: async () => createdUser
    });

    const roleHook = useChangeUserRole({
      changeUserRole: async () => ({ ...createdUser, role: 'SystemAdmin' })
    });

    const passwordCalls: string[] = [];
    const passwordHook = useChangeUserPassword({
      changeUserPassword: async (payload) => {
        passwordCalls.push(payload.userId);
      }
    });

    const afterCreate = await createHook.createUser(
      {
        name: 'Joao Lima',
        email: 'joao@vantageiq.club',
        role: 'Coach',
        initialPassword: 'SecurePass123'
      },
      startingUsers
    );

    expect(afterCreate[0].email).toBe('joao@vantageiq.club');
    expect(afterCreate).toHaveLength(2);

    const afterRoleChange = await roleHook.changeUserRole(
      { userId: createdUser.id, role: 'SystemAdmin' },
      afterCreate
    );

    expect(afterRoleChange.find((u) => u.id === createdUser.id)?.role).toBe('SystemAdmin');

    await passwordHook.changeUserPassword({
      userId: createdUser.id,
      newPassword: 'SecurePass999',
      confirmPassword: 'SecurePass999'
    });

    expect(passwordCalls).toEqual([createdUser.id]);
  });
});
