import { useState } from 'react';
import type { AdminUser, UserRole } from '../types';

type Props = {
  user: AdminUser | null;
  onSubmit: (userId: string, role: UserRole) => Promise<void>;
};

export function ChangeRoleDialog({ user, onSubmit }: Props) {
  const [role, setRole] = useState<UserRole>('Coach');

  if (!user) {
    return null;
  }

  return (
    <form
      onSubmit={async (event) => {
        event.preventDefault();
        await onSubmit(user.id, role);
      }}
    >
      <h3>Change Role</h3>
      <p>Selected user: {user.name}</p>
      <label>
        Role
        <select value={role} onChange={(e) => setRole(e.target.value as UserRole)}>
          <option value="Coach">Coach</option>
          <option value="SystemAdmin">SystemAdmin</option>
        </select>
      </label>
      <button type="submit">Update Role</button>
    </form>
  );
}
