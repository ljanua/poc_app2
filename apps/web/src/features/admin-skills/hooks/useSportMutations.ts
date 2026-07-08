import { useCallback, useState } from 'react';
import type { CreateSportPayload, Sport, SportStatus, UpdateSportPayload } from '../types';
import type { SkillsApiClient } from '../services/skills-api-client';

type MutationState = {
  pending: boolean;
  error: string | null;
};

export type UseSportMutations = {
  createSport: (payload: CreateSportPayload) => Promise<Sport | null>;
  updateSport: (sportId: string, payload: UpdateSportPayload) => Promise<Sport | null>;
  setSportStatus: (sportId: string, status: SportStatus) => Promise<Sport | null>;
  state: MutationState;
};

export function useSportMutations(client: SkillsApiClient): UseSportMutations {
  const [state, setState] = useState<MutationState>({ pending: false, error: null });

  const run = useCallback(async <T,>(label: string, fn: () => Promise<T>): Promise<T | null> => {
    setState({ pending: true, error: null });
    try {
      const result = await fn();
      setState({ pending: false, error: null });
      return result;
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : String(cause);
      setState({ pending: false, error: `${label}: ${message}` });
      return null;
    }
  }, []);

  const createSport = useCallback(
    (payload: CreateSportPayload) => run('createSport', () => client.createSport(payload)),
    [client, run]
  );

  const updateSport = useCallback(
    (sportId: string, payload: UpdateSportPayload) =>
      run('updateSport', () => client.updateSport(sportId, payload)),
    [client, run]
  );

  const setSportStatus = useCallback(
    (sportId: string, status: SportStatus) =>
      run('setSportStatus', () => client.setSportStatus(sportId, { status })),
    [client, run]
  );

  return {
    createSport,
    updateSport,
    setSportStatus,
    state
  };
}