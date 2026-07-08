import { AdminUsersPage } from '../../features/admin-users/pages/AdminUsersPage';
import type { UserRole } from '../../features/admin-users/types';
import {
  AdminSkillsPage,
  canAccessAdminSkills,
  type AdminActorRole
} from '../../features/admin-skills/pages/AdminSkillsPage';

type Props = {
  actorRole: UserRole;
  pathname?: string;
};

function ForbiddenNotice() {
  return <p>403 Forbidden. Admin-only route.</p>;
}

export function AdminRoutes({ actorRole, pathname }: Props) {
  const normalizedPath = (pathname ?? '').toLowerCase();
  const isSkillsRoute = normalizedPath === '/admin/skills' || normalizedPath.endsWith('/admin/skills');
  const isUsersRoute =
    normalizedPath === '/admin/users' ||
    normalizedPath === '' ||
    normalizedPath.endsWith('/admin/users');

  if (isSkillsRoute) {
    return canAccessAdminSkills(actorRole as AdminActorRole) ? (
      <AdminSkillsPage actorRole={actorRole as AdminActorRole} />
    ) : (
      <ForbiddenNotice />
    );
  }

  if (isUsersRoute) {
    return <AdminUsersPage actorRole={actorRole} />;
  }

  // Default to the user-and-role page so existing tests still render.
  return <AdminUsersPage actorRole={actorRole} />;
}