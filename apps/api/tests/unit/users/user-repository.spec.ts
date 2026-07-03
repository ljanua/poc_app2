import { describe, expect, it } from 'vitest';
import { UserRepository } from '../../../src/modules/users/repositories/user-repository';

describe('UserRepository', () => {
  it('creates and updates role and password hash', () => {
    const repository = new UserRepository();

    const created = repository.create({
      name: 'Joao Lima',
      email: 'joao@vantageiq.club',
      role: 'Coach',
      passwordHash: 'hash_1'
    });

    const roleUpdated = repository.updateRole(created.id, 'SystemAdmin');
    const passwordUpdated = repository.updatePasswordHash(created.id, 'hash_2');

    expect(roleUpdated.role).toBe('SystemAdmin');
    expect(passwordUpdated.passwordHash).toBe('hash_2');
  });

  it('throws when creating duplicate email', () => {
    const repository = new UserRepository();
    repository.create({
      name: 'Maria Alves',
      email: 'maria@vantageiq.club',
      role: 'SystemAdmin',
      passwordHash: 'hash_a'
    });

    expect(() => {
      repository.create({
        name: 'Maria Duplicate',
        email: 'maria@vantageiq.club',
        role: 'Coach',
        passwordHash: 'hash_b'
      });
    }).toThrow('A user with the same identifier already exists.');
  });
});
