import { useMemo, useState } from 'react';
import type { AdminUser } from '../types';

const seedUsers: AdminUser[] = [
  { id: 'u_1', name: 'Maria Alves', email: 'maria@vantageiq.club', role: 'SystemAdmin', status: 'active' },
  { id: 'u_2', name: 'Joao Lima', email: 'joao@vantageiq.club', role: 'Coach', status: 'active' },
  { id: 'u_3', name: 'Ana Costa', email: 'ana@vantageiq.club', role: 'Coach', status: 'inactive' }
];

export function useAdminUsers() {
  const [users, setUsers] = useState<AdminUser[]>(seedUsers);

  const stats = useMemo(() => {
    return {
      active: users.filter((u) => u.status === 'active').length,
      admins: users.filter((u) => u.role === 'SystemAdmin').length,
      coaches: users.filter((u) => u.role === 'Coach').length
    };
  }, [users]);

  return { users, setUsers, stats };
}
