import { useCallback, useState } from 'react';
import type {
  AssignTeamToClubPayload,
  AssignUserClubPayload,
  Club,
  ClubMembership,
  ClubStatus,
  ClubStatusPayload,
  CreateClubPayload,
  RemoveUserClubParams,
  UpdateClubPayload
} from '../types';
import type { ClubsApiClient } from '../services/clubs-api-client';

type MutationState = {
  pending: boolean;
  error: string | null;
};

export type UseClubMutations = {
  createClub: (payload: CreateClubPayload) => Promise<Club | null>;
  updateClub: (clubId: string, payload: UpdateClubPayload) => Promise<Club | null>;
  setClubStatus: (clubId: string, status: ClubStatus) => Promise<Club | null>;
  assignUserToClub: (payload: AssignUserClubPayload) => Promise<ClubMembership | null>;
  removeUserFromClub: (params: RemoveUserClubParams) => Promise<boolean>;
  assignTeamToClub: (clubId: string, payload: AssignTeamToClubPayload) => Promise<unknown>;
  state: MutationState;
};

export function useClubMutations(client: ClubsApiClient): UseClubMutations {
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

  const createClub = useCallback(
    (payload: CreateClubPayload) => run('createClub', () => client.createClub(payload)),
    [client, run]
  );

  const updateClub = useCallback(
    (clubId: string, payload: UpdateClubPayload) =>
      run('updateClub', () => client.updateClub(clubId, payload)),
    [client, run]
  );

  const setClubStatus = useCallback(
    (clubId: string, status: ClubStatus) =>
      run('setClubStatus', () => client.setClubStatus(clubId, { status } satisfies ClubStatusPayload)),
    [client, run]
  );

  const assignUserToClub = useCallback(
    (payload: AssignUserClubPayload) =>
      run('assignUserToClub', () => client.assignUserToClub(payload)),
    [client, run]
  );

  const removeUserFromClub = useCallback(
    async ({ userId, clubId }: RemoveUserClubParams) => {
      const result = await run('removeUserFromClub', () => client.removeUserFromClub({ userId, clubId }));
      return result !== null;
    },
    [client, run]
  );

  const assignTeamToClub = useCallback(
    (clubId: string, payload: AssignTeamToClubPayload) =>
      run('assignTeamToClub', () => client.assignTeamToClub(clubId, payload)),
    [client, run]
  );

  return {
    createClub,
    updateClub,
    setClubStatus,
    assignUserToClub,
    removeUserFromClub,
    assignTeamToClub,
    state
  };
}