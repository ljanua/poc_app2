import type { UserRepository, UserRole, UserRecord } from './user-repository';

export class UserRoleRepository {
  constructor(private readonly userRepository: UserRepository) {}

  setUserRole(userId: string, role: UserRole): UserRecord {
    return this.userRepository.updateRole(userId, role);
  }
}
