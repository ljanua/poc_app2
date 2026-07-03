import { AdminUsersPage } from '../../features/admin-users/pages/AdminUsersPage';
import type { UserRole } from '../../features/admin-users/types';

type Props = {
  actorRole: UserRole;
};

export function AdminRoutes({ actorRole }: Props) {
  return <AdminUsersPage actorRole={actorRole} />;
}
