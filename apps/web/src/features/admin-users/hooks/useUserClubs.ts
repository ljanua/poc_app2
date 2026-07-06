import { useCallback, useEffect, useState } from 'react';
import type { Club, ClubMembership } from '../../admin-clubs/types';
import type { HttpClubsApiClient } from '../../admin-clubs/services/clubs-api-client';

type Params = {
  userId: string | null;
  clubsClient: HttpClubsApiClient;
};

type MembershipState = {
  loading: boolean;
  memberships: ClubMembership[];
  error: string | null;
};

export function useUserClubs({ userId, clubsClient }: Params): MembershipState & {
  reload: () => Promise<void>;
  assign: (clubId: string) => Promise<ClubMembership | null>;
  remove: (clubId: string) => Promise<boolean>;
} {
  const [state, setState] = useState<MembershipState>({
    loading: false,
    memberships: [],
    error: null
  });

  const reload = useCallback(async () => {
    if (!userId) {
      setState({ loading: false, memberships: [], error: null });
      return;
    }
    setState((current) => ({ ...current, loading: true, error: null }));
    try {
      const memberships = await clubsClient.listUserClubs(userId);
      setState({ loading: false, memberships, error: null });
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : String(cause);
      setState({ loading: false, memberships: [], error: message });
    }
  }, [userId, clubsClient]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const assign = useCallback(
    async (clubId: string) => {
      if (!userId) return null;
      const result = await clubsClient.assignUserToClub({ userId, clubId });
      await reload();
      return result;
    },
    [userId, clubsClient, reload]
  );

  const remove = useCallback(
    async (clubId: string) => {
      if (!userId) return false;
      try {
        await clubsClient.removeUserFromClub({ userId, clubId });
        await reload();
        return true;
      } catch {
        return false;
      }
    },
    [userId, clubsClient, reload]
  );

  return { ...state, reload, assign, remove };
}

export function useAssignableClubs(clubsClient: HttpClubsApiClient): Club[] {
  const [clubs, setClubs] = useState<Club[]>([]);
  useEffect(() => {
    let cancelled = false;
    void clubsClient.listClubs('active').then((list) => {
      if (!cancelled) setClubs(list);
    });
    return () => {
      cancelled = true;
    };
  }, [clubsClient]);
  return clubs;
}