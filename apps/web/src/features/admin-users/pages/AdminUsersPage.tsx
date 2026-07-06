import { useMemo, useState } from 'react';
import { CreateUserForm } from '../components/CreateUserForm';
import { ChangePasswordDialog } from '../components/ChangePasswordDialog';
import { ChangeRoleDialog } from '../components/ChangeRoleDialog';
import { AssignClubDialog } from '../components/AssignClubDialog';
import { useAdminUsers } from '../hooks/useAdminUsers';
import { useCreateUser } from '../hooks/useCreateUser';
import { useChangeUserRole } from '../hooks/useChangeUserRole';
import { useChangeUserPassword } from '../hooks/useChangeUserPassword';
import { useAssignableClubs, useUserClubs } from '../hooks/useUserClubs';
import { HttpClubsApiClient } from '../../admin-clubs/services/clubs-api-client';
import type { AdminUser, UserRole } from '../types';
import { mapApiErrorToMessage } from '../../../services/api/errors';

type Props = {
  actorRole: UserRole;
};

export function canAccessAdminUsers(actorRole: UserRole): boolean {
  return actorRole === 'SystemAdmin';
}

export function filterUsers(users: AdminUser[], query: string): AdminUser[] {
  if (!query.trim()) return users;
  const q = query.toLowerCase();
  return users.filter((u) => u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q));
}

export function getAdminUsersErrorMessage(error: unknown): string {
  return mapApiErrorToMessage(error);
}

export function AdminUsersPage({ actorRole }: Props) {
  const { users, setUsers, stats } = useAdminUsers();
  const { createUser } = useCreateUser();
  const { changeUserRole } = useChangeUserRole();
  const { changeUserPassword } = useChangeUserPassword();
  const [selectedUser, setSelectedUser] = useState<AdminUser | null>(null);
  const [query, setQuery] = useState('');
  const [feedback, setFeedback] = useState<string | null>(null);

  const clubsClient = useMemo(() => new HttpClubsApiClient(), []);
  const [assignClubTarget, setAssignClubTarget] = useState<AdminUser | null>(null);
  const allClubs = useAssignableClubs(clubsClient);
  const { memberships, assign, remove } = useUserClubs({
    userId: assignClubTarget?.id ?? null,
    clubsClient
  });

  const isAdmin = canAccessAdminUsers(actorRole);

  const filtered = useMemo(() => filterUsers(users, query), [users, query]);

  if (!isAdmin) {
    return <p>403 Forbidden. Only SystemAdmin can manage users.</p>;
  }

  return (
    <section>
      <h2>User and Role Management</h2>
      <p>Active: {stats.active} | SystemAdmin: {stats.admins} | Coach: {stats.coaches}</p>
      {feedback ? <p>{feedback}</p> : null}

      <label>
        Search
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search users" />
      </label>

      <CreateUserForm
        onSubmit={async (payload) => {
          try {
            const next = await createUser(payload, users);
            setUsers(next);
            setFeedback('User created successfully.');
          } catch (error) {
            setFeedback(getAdminUsersErrorMessage(error));
          }
        }}
      />

      <table>
        <thead>
          <tr>
            <th>Name</th>
            <th>Email</th>
            <th>Role</th>
            <th>Status</th>
            <th>Clubs</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {filtered.map((user) => (
            <tr key={user.id}>
              <td>{user.name}</td>
              <td>{user.email}</td>
              <td>{user.role}</td>
              <td>{user.status}</td>
              <td>
                {(user.clubIds || []).length > 0
                  ? (user.clubIds || []).map((clubId) => {
                      const club = allClubs.find((c) => c.id === clubId);
                      return club ? <span key={clubId}>{club.name}</span> : null;
                    })
                  : '—'}
              </td>
              <td>
                <button type="button" onClick={() => setSelectedUser(user)}>Role</button>
                <button type="button" onClick={() => setSelectedUser(user)}>Password</button>
                <button type="button" onClick={() => setAssignClubTarget(user)}>Assign Club</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <ChangeRoleDialog
        user={selectedUser}
        onSubmit={async (userId, role) => {
          try {
            const next = await changeUserRole({ userId, role }, users);
            setUsers(next);
            setFeedback('Role updated successfully.');
          } catch (error) {
            setFeedback(getAdminUsersErrorMessage(error));
          }
        }}
      />

      <ChangePasswordDialog
        user={selectedUser}
        onSubmit={async (userId, newPassword, confirmPassword) => {
          try {
            await changeUserPassword({ userId, newPassword, confirmPassword });
            setFeedback('Password updated successfully.');
          } catch (error) {
            setFeedback(getAdminUsersErrorMessage(error));
            throw error;
          }
        }}
      />

      {assignClubTarget ? (
        <AssignClubDialog
          userId={assignClubTarget.id}
          userName={assignClubTarget.name}
          clubs={allClubs}
          memberships={memberships}
          onSubmit={assign}
          onRemove={remove}
          onClose={() => setAssignClubTarget(null)}
        />
      ) : null}
    </section>
  );
}
