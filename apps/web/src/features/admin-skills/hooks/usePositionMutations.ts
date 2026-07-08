import { useCallback, useState } from 'react';
import type {
  CreatePositionPayload,
  Position,
  PositionSkill,
  PositionStatus,
  UpdatePositionPayload
} from '../types';
import type { SkillsApiClient } from '../services/skills-api-client';

type MutationState = {
  pending: boolean;
  error: string | null;
};

export type UsePositionMutations = {
  createPosition: (payload: CreatePositionPayload) => Promise<Position | null>;
  updatePosition: (positionId: string, payload: UpdatePositionPayload) => Promise<Position | null>;
  setPositionStatus: (positionId: string, status: PositionStatus) => Promise<Position | null>;
  assignSkillToPosition: (
    positionId: string,
    skillId: string
  ) => Promise<PositionSkill[] | null>;
  removeSkillFromPosition: (positionId: string, skillId: string) => Promise<boolean>;
  state: MutationState;
};

export function usePositionMutations(client: SkillsApiClient): UsePositionMutations {
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

  const createPosition = useCallback(
    (payload: CreatePositionPayload) =>
      run('createPosition', () => client.createPosition(payload)),
    [client, run]
  );

  const updatePosition = useCallback(
    (positionId: string, payload: UpdatePositionPayload) =>
      run('updatePosition', () => client.updatePosition(positionId, payload)),
    [client, run]
  );

  const setPositionStatus = useCallback(
    (positionId: string, status: PositionStatus) =>
      run('setPositionStatus', () => client.setPositionStatus(positionId, { status })),
    [client, run]
  );

  const assignSkillToPosition = useCallback(
    (positionId: string, skillId: string) =>
      run('assignSkillToPosition', () =>
        client.assignSkillToPosition(positionId, { skillId })
      ),
    [client, run]
  );

  const removeSkillFromPosition = useCallback(
    async (positionId: string, skillId: string) => {
      const result = await run('removeSkillFromPosition', () =>
        client.removeSkillFromPosition(positionId, skillId)
      );
      return result !== null;
    },
    [client, run]
  );

  return {
    createPosition,
    updatePosition,
    setPositionStatus,
    assignSkillToPosition,
    removeSkillFromPosition,
    state
  };
}