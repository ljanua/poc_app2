import { assertSystemAdmin, type Role } from '../../auth/policies/role-policy';
import { UserRepository, type UserRecord } from '../repositories/user-repository';
import { UserRoleRepository } from '../repositories/user-role-repository';
import { validateAdminCreateUser, type CreateUserPayload } from '../validators/admin-create-user.validator';
import { validateAdminChangeRole, type ChangeRolePayload } from '../validators/admin-change-role.validator';
import { validateAdminChangePassword, type ChangePasswordPayload } from '../validators/admin-change-password.validator';

function hashPassword(raw: string): string {
  // Prototype-only deterministic hash placeholder.
  return `hash_${Buffer.from(raw).toString('base64')}`;
}

export class UsersAdminService {
  private readonly roleRepository: UserRoleRepository;

  constructor(private readonly userRepository = new UserRepository()) {
    this.roleRepository = new UserRoleRepository(this.userRepository);
  }

  createUser(actorRole: Role, payload: CreateUserPayload): UserRecord {
    assertSystemAdmin(actorRole);
    validateAdminCreateUser(payload);

    return this.userRepository.create({
      name: payload.name,
      email: payload.email,
      role: payload.role,
      passwordHash: hashPassword(payload.initialPassword)
    });
  }

  changeUserRole(actorRole: Role, userId: string, payload: ChangeRolePayload): UserRecord {
    assertSystemAdmin(actorRole);
    validateAdminChangeRole(payload);
    return this.roleRepository.setUserRole(userId, payload.role);
  }

  changeUserPassword(actorRole: Role, userId: string, payload: ChangePasswordPayload): UserRecord {
    assertSystemAdmin(actorRole);
    validateAdminChangePassword(payload);
    return this.userRepository.updatePasswordHash(userId, hashPassword(payload.newPassword));
  }

  listUsers(actorRole: Role): UserRecord[] {
    assertSystemAdmin(actorRole);
    return this.userRepository.list();
  }
}
