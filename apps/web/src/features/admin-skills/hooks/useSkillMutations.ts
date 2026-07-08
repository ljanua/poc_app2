import { useCallback, useState } from 'react';
import type { CreateSkillPayload, Skill, SkillStatus, UpdateSkillPayload } from '../types';
import type { SkillsApiClient } from '../services/skills-api-client';

type MutationState = {
  pending: boolean;
  error: string | null;
};

export type UseSkillMutations = {
  createSkill: (payload: CreateSkillPayload) => Promise<Skill | null>;
  updateSkill: (skillId: string, payload: UpdateSkillPayload) => Promise<Skill | null>;
  deleteSkill: (skillId: string) => Promise<boolean>;
  setSkillStatus: (skillId: string, status: SkillStatus) => Promise<Skill | null>;
  state: MutationState;
};

export function useSkillMutations(client: SkillsApiClient): UseSkillMutations {
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

  const createSkill = useCallback(
    (payload: CreateSkillPayload) => run('createSkill', () => client.createSkill(payload)),
    [client, run]
  );

  const updateSkill = useCallback(
    (skillId: string, payload: UpdateSkillPayload) =>
      run('updateSkill', () => client.updateSkill(skillId, payload)),
    [client, run]
  );

  const deleteSkill = useCallback(
    async (skillId: string) => {
      const result = await run('deleteSkill', () => client.deleteSkill(skillId));
      return result !== null;
    },
    [client, run]
  );

  // Skills do not expose a `setSkillStatus` endpoint in v1; this typed shell mirrors
  // the future contract so callers can wire the UI without a wider refactor when the
  // backend grows one. For now it surfaces an explicit "not yet supported" error.
  const setSkillStatus = useCallback(
    async (_skillId: string, _status: SkillStatus) => {
      setState({ pending: false, error: 'setSkillStatus:not_yet_supported' });
      return null;
    },
    []
  );

  return {
    createSkill,
    updateSkill,
    deleteSkill,
    setSkillStatus,
    state
  };
}