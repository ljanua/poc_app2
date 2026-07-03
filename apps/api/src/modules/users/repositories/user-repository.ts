export type UserRole = 'SystemAdmin' | 'Coach';
export type UserStatus = 'active' | 'inactive';
import {
  appConflictError,
  appNotFoundError
} from '../../../shared/errors/app-error';

export type UserRecord = {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  passwordHash: string;
  status: UserStatus;
  updatedAt: string;
};

export type CreateUserInput = {
  name: string;
  email: string;
  role: UserRole;
  passwordHash: string;
};

export class UserRepository {
  private readonly data = new Map<string, UserRecord>();

  create(input: CreateUserInput): UserRecord {
    const record: UserRecord = {
      id: `u_${Date.now()}`,
      name: input.name,
      email: input.email.toLowerCase(),
      role: input.role,
      passwordHash: input.passwordHash,
      status: 'active',
      updatedAt: new Date().toISOString()
    };

    const emailExists = Array.from(this.data.values()).some((item) => item.email === record.email);
    if (emailExists) {
      throw appConflictError();
    }

    this.data.set(record.id, record);
    return record;
  }

  findById(userId: string): UserRecord | null {
    return this.data.get(userId) ?? null;
  }

  updateRole(userId: string, role: UserRole): UserRecord {
    const existing = this.findById(userId);
    if (!existing) {
      throw appNotFoundError();
    }

    const updated: UserRecord = {
      ...existing,
      role,
      updatedAt: new Date().toISOString()
    };

    this.data.set(userId, updated);
    return updated;
  }

  updatePasswordHash(userId: string, passwordHash: string): UserRecord {
    const existing = this.findById(userId);
    if (!existing) {
      throw appNotFoundError();
    }

    const updated: UserRecord = {
      ...existing,
      passwordHash,
      updatedAt: new Date().toISOString()
    };

    this.data.set(userId, updated);
    return updated;
  }

  list(): UserRecord[] {
    return Array.from(this.data.values());
  }
}
