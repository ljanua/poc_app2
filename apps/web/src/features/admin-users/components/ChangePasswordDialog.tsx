import { useState } from 'react';
import type { AdminUser } from '../types';

type Props = {
  user: AdminUser | null;
  onSubmit: (userId: string, newPassword: string, confirmPassword: string) => Promise<void>;
};

export function ChangePasswordDialog({ user, onSubmit }: Props) {
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');

  if (!user) {
    return null;
  }

  return (
    <form
      onSubmit={async (event) => {
        event.preventDefault();
        try {
          await onSubmit(user.id, newPassword, confirmPassword);
          setNewPassword('');
          setConfirmPassword('');
          setError('');
        } catch {
          setError('Password must be at least 10 chars, include a number, and match confirmation.');
        }
      }}
    >
      <h3>Change Password</h3>
      <p>Selected user: {user.name}</p>
      <label>
        New Password
        <input value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required />
      </label>
      <label>
        Confirm Password
        <input value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required />
      </label>
      {error ? <p>{error}</p> : null}
      <button type="submit">Update Password</button>
    </form>
  );
}
