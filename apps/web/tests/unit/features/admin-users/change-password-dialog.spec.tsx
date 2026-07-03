import { describe, expect, it } from 'vitest';
import { useChangeUserPassword } from '../../../../src/features/admin-users/hooks/useChangeUserPassword';

describe('ChangePasswordDialog', () => {
  it('rejects weak or mismatched password inputs before API call', async () => {
    const calls: unknown[] = [];
    const hook = useChangeUserPassword({
      changeUserPassword: async (payload) => {
        calls.push(payload);
      }
    });

    await expect(
      hook.changeUserPassword({ userId: 'u_2', newPassword: 'weak', confirmPassword: 'weak' })
    ).rejects.toThrow('validation:password_policy_failed');

    await expect(
      hook.changeUserPassword({
        userId: 'u_2',
        newPassword: 'StrongPass123',
        confirmPassword: 'StrongPass1234'
      })
    ).rejects.toThrow('validation:password_mismatch');

    expect(calls).toHaveLength(0);
  });

  it('calls API client when password policy and confirmation pass', async () => {
    const calls: Array<{ userId: string; newPassword: string; confirmPassword: string }> = [];
    const hook = useChangeUserPassword({
      changeUserPassword: async (payload) => {
        calls.push(payload);
      }
    });

    await hook.changeUserPassword({
      userId: 'u_2',
      newPassword: 'StrongPass123',
      confirmPassword: 'StrongPass123'
    });

    expect(calls).toHaveLength(1);
    expect(calls[0].userId).toBe('u_2');
  });
});
