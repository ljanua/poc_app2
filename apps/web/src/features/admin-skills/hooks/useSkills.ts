import { useCallback, useEffect, useState } from 'react';
import type { Skill } from '../types';
import type { SkillsApiClient, StatusFilter } from '../services/skills-api-client';

type UseSkillsOptions = {
  client: SkillsApiClient;
  statusFilter?: StatusFilter;
};

type UseSkillsResult = {
  data: Skill[];
  loading: boolean;
  error: string | null;
  reload: () => Promise<void>;
};

export function useSkills({ client, statusFilter = 'active' }: UseSkillsOptions): UseSkillsResult {
  const [data, setData] = useState<Skill[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const next = await client.listSkills(statusFilter);
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