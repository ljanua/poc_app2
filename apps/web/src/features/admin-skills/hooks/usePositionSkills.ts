import { useCallback, useEffect, useState } from 'react';
import type { PositionSkill } from '../types';
import type { SkillsApiClient } from '../services/skills-api-client';

type UsePositionSkillsOptions = {
  client: SkillsApiClient;
  positionId: string | null;
};

type UsePositionSkillsResult = {
  data: PositionSkill[];
  loading: boolean;
  error: string | null;
  reload: () => Promise<void>;
};

export function usePositionSkills({
  client,
  positionId
}: UsePositionSkillsOptions): UsePositionSkillsResult {
  const [data, setData] = useState<PositionSkill[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (!positionId) {
      setData([]);
      setError(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const next = await client.listPositionSkills(positionId);
      setData(next);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setLoading(false);
    }
  }, [client, positionId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { data, loading, error, reload };
}