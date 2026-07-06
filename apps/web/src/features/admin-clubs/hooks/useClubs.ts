import { useCallback, useEffect, useMemo, useState } from 'react';
import type { Club, ClubStatus } from '../types';
import type { ClubsApiClient } from '../services/clubs-api-client';

type StatusFilter = 'active' | 'inactive' | 'all';

type Stats = {
  active: number;
  inactive: number;
  totalCoaches: number;
  totalTeams: number;
};

type UseClubsOptions = {
  client: ClubsApiClient;
  initialStatus?: StatusFilter;
};

export function useClubs({ client, initialStatus = 'active' }: UseClubsOptions) {
  const [clubs, setClubs] = useState<Club[]>([]);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>(initialStatus);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const next = await client.listClubs(statusFilter);
      setClubs(next);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setLoading(false);
    }
  }, [client, statusFilter]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const filtered = useMemo(() => {
    const trimmed = query.trim().toLowerCase();
    if (!trimmed) return clubs;
    return clubs.filter((club) => club.name.toLowerCase().includes(trimmed));
  }, [clubs, query]);

  const stats: Stats = useMemo(() => {
    let active = 0;
    let inactive = 0;
    let totalCoaches = 0;
    let totalTeams = 0;
    clubs.forEach((club) => {
      const status: ClubStatus = club.status || 'active';
      if (status === 'active') active += 1;
      else inactive += 1;
      totalCoaches += Number(club.coachCount || 0);
      totalTeams += Number(club.teamCount || 0);
    });
    return { active, inactive, totalCoaches, totalTeams };
  }, [clubs]);

  return {
    clubs,
    filtered,
    statusFilter,
    setStatusFilter,
    query,
    setQuery,
    stats,
    loading,
    error,
    reload
  };
}