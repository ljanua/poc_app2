import { useCallback, useEffect, useState } from 'react';
import type { Position } from '../types';
import type { SkillsApiClient, StatusFilter } from '../services/skills-api-client';

type UsePositionsOptions = {
  client: SkillsApiClient;
  sportId: string;
  statusFilter?: StatusFilter;
};

type UsePositionsResult = {
  data: Position[];
  loading: boolean;
  error: string | null;
  reload: () => Promise<void>;
};

export function usePositions({
  client,
  sportId,
  statusFilter = 'active'
}: UsePositionsOptions): UsePositionsResult {
  const [data, setData] = useState<Position[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (!sportId) {
      setData([]);
      setError(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const next = await client.listPositions(sportId, statusFilter);
      setData(next);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setLoading(false);
    }
  }, [client, sportId, statusFilter]);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { data, loading, error, reload };
}