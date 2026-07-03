import { UsersAdminService } from '../services/users-admin.service';
import type { Role } from '../../auth/policies/role-policy';
import type { CreateUserPayload } from '../validators/admin-create-user.validator';
import type { ChangeRolePayload } from '../validators/admin-change-role.validator';
import type { ChangePasswordPayload } from '../validators/admin-change-password.validator';

export class UsersController {
  constructor(private readonly service = new UsersAdminService()) {}

  createUser(actorRole: Role, body: CreateUserPayload) {
    return { data: this.service.createUser(actorRole, body) };
  }

  changeRole(actorRole: Role, userId: string, body: ChangeRolePayload) {
    return { data: this.service.changeUserRole(actorRole, userId, body) };
  }

  changePassword(actorRole: Role, userId: string, body: ChangePasswordPayload) {
    this.service.changeUserPassword(actorRole, userId, body);
    return { status: 204 };
  }

  list(actorRole: Role) {
    return { data: this.service.listUsers(actorRole) };
  }
}
