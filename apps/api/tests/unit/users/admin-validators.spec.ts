import { describe, expect, it } from 'vitest';
import { validateAdminCreateUser } from '../../../src/modules/users/validators/admin-create-user.validator';
import { validateAdminChangeRole } from '../../../src/modules/users/validators/admin-change-role.validator';
import { validateAdminChangePassword } from '../../../src/modules/users/validators/admin-change-password.validator';

describe('admin validators', () => {
  it('rejects invalid role', () => {
    expect(() => validateAdminChangeRole({ role: 'Owner' as never })).toThrow(
      'Please review the form fields and try again.'
    );
  });

  it('rejects weak password and mismatched confirmation', () => {
    expect(() => validateAdminChangePassword({ newPassword: 'weak', confirmPassword: 'weak' })).toThrow(
      'Please review the form fields and try again.'
    );

    expect(() =>
      validateAdminChangePassword({
        newPassword: 'StrongPass123',
        confirmPassword: 'StrongPass1234'
      })
    ).toThrow('Please review the form fields and try again.');
  });

  it('accepts valid create payload', () => {
    expect(() =>
      validateAdminCreateUser({
        name: 'Daniel Rocha',
        email: 'daniel@vantageiq.club',
        role: 'Coach',
        initialPassword: 'SecurePass123'
      })
    ).not.toThrow();
  });

  it('accepts ClubAdmin role on create and change-role', () => {
    expect(() =>
      validateAdminCreateUser({
        name: 'Rita Club',
        email: 'rita@vantageiq.club',
        role: 'ClubAdmin',
        initialPassword: 'SecurePass123'
      })
    ).not.toThrow();
    expect(() => validateAdminChangeRole({ role: 'ClubAdmin' })).not.toThrow();
  });
});
