import { useCallback, useEffect, useState } from 'react';
import type { Sport } from '../types';
import type { SkillsApiClient, StatusFilter } from '../services/skills-api-client';

type UseSportsOptions = {
  client: SkillsApiClient;
  statusFilter?: StatusFilter;
};

type UseSportsResult = {
  data: Sport[];
  loading: boolean;
  error: string | null;
  reload: () => Promise<void>;
};

export function useSports({ client, statusFilter = 'active' }: UseSportsOptions): UseSportsResult {
  const [data, setData] = useState<Sport[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const next = await client.listSports(statusFilter);
      setData(next);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setLoading(false);
    }
  }, [client, statusFilter]);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { data, loading, error, reload };
}