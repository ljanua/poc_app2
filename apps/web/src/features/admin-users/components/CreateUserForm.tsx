import { useState } from 'react';
import type { CreateUserPayload, UserRole } from '../types';

type Props = {
  onSubmit: (payload: CreateUserPayload) => Promise<void>;
};

export function CreateUserForm({ onSubmit }: Props) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<UserRole>('Coach');
  const [initialPassword, setInitialPassword] = useState('');

  return (
    <form
      onSubmit={async (event) => {
        event.preventDefault();
        await onSubmit({ name, email, role, initialPassword });
        setName('');
        setEmail('');
        setRole('Coach');
        setInitialPassword('');
      }}
    >
      <h3>Create User</h3>
      <label>
        Name
        <input value={name} onChange={(e) => setName(e.target.value)} required />
      </label>
      <label>
        Email
        <input value={email} onChange={(e) => setEmail(e.target.value)} required />
      </label>
      <label>
        Role
        <select value={role} onChange={(e) => setRole(e.target.value as UserRole)}>
          <option value="Coach">Coach</option>
          <option value="SystemAdmin">SystemAdmin</option>
        </select>
      </label>
      <label>
        Initial Password
        <input value={initialPassword} onChange={(e) => setInitialPassword(e.target.value)} required />
      </label>
      <button type="submit">Save User</button>
    </form>
  );
}
