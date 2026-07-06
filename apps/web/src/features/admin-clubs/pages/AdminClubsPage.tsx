import { useCallback, useEffect, useMemo, useState } from 'react';
import { CreateClubDialog } from '../components/CreateClubDialog';
import { RenameClubDialog } from '../components/RenameClubDialog';
import {
  AssignCoachDialog,
  type CoachOption
} from '../components/AssignCoachDialog';
import {
  AssignTeamDialog,
  type TeamOption
} from '../components/AssignTeamDialog';
import { useClubs } from '../hooks/useClubs';
import { useClubMutations } from '../hooks/useClubMutations';
import { HttpClubsApiClient } from '../services/clubs-api-client';
import type { Club, ClubMembership, UserRole } from '../types';
import type { AdminUser } from '../../admin-users/types';

type Props = {
  actorRole: UserRole;
};

type AdminUsersLiteClient = {
  listUsers: () => Promise<AdminUser[]>;
};

type TeamsLiteClient = {
  listTeams: () => Promise<TeamOption[]>;
};

export function canAccessAdminClubs(actorRole: UserRole): boolean {
  return actorRole === 'SystemAdmin';
}

export function AdminClubsPage({ actorRole }: Props) {
  const isAdmin = canAccessAdminClubs(actorRole);
  const clubsClient = useMemo(() => new HttpClubsApiClient(), []);

  const { clubs, filtered, statusFilter, setStatusFilter, query, setQuery, stats, reload, error } =
    useClubs({ client: clubsClient, initialStatus: 'active' });
  const mutations = useClubMutations(clubsClient);

  const [createOpen, setCreateOpen] = useState(false);
  const [renameTarget, setRenameTarget] = useState<Club | null>(null);
  const [assignCoachTarget, setAssignCoachTarget] = useState<Club | null>(null);
  const [assignTeamTarget, setAssignTeamTarget] = useState<Club | null>(null);

  const [coaches, setCoaches] = useState<CoachOption[]>([]);
  const [teams, setTeams] = useState<TeamOption[]>([]);
  const [memberships, setMemberships] = useState<ClubMembership[]>([]);

  const loadCoaches = useCallback(async () => {
    try {
      const response = await fetch('/api/v1/users');
      if (!response.ok) return;
      const body = (await response.json()) as { data: AdminUser[] };
      setCoaches(
        body.data
          .filter((user) => user.status === 'active')
          .map((user) => ({ id: String(user.id), name: user.name, role: user.role }))
      );
    } catch {
      // Swallow: listUsers is a soft dependency on the S7 page.
    }
  }, []);

  const loadTeams = useCallback(async () => {
    try {
      const response = await fetch('/api/v1/teams');
      if (!response.ok) return;
      const body = (await response.json()) as { data: TeamOption[] };
      setTeams(body.data);
    } catch {
      // Same rationale as loadCoaches.
    }
  }, []);

  useEffect(() => {
    void loadCoaches();
    void loadTeams();
  }, [loadCoaches, loadTeams]);

  useEffect(() => {
    if (!assignCoachTarget) {
      setMemberships([]);
      return;
    }
    clubsClient
      .listUserClubs(assignCoachTarget.id)
      .then(setMemberships)
      .catch(() => setMemberships([]));
  }, [assignCoachTarget, clubsClient, clubs]);

  const handleCreate = useCallback(
    async (name: string) => {
      const result = await mutations.createClub({ name });
      if (result) {
        await reload();
      }
      return result;
    },
    [mutations, reload]
  );

  const handleRename = useCallback(
    async (name: string) => {
      if (!renameTarget) return null;
      const result = await mutations.updateClub(renameTarget.id, { name });
      if (result) {
        await reload();
      }
      return result;
    },
    [mutations, reload, renameTarget]
  );

  const handleAssignCoach = useCallback(
    async (userId: string) => {
      if (!assignCoachTarget) return null;
      const result = await mutations.assignUserToClub({
        userId,
        clubId: assignCoachTarget.id
      });
      if (result) {
        setMemberships((current) => [...current, result]);
        await reload();
      }
      return result;
    },
    [mutations, reload, assignCoachTarget]
  );

  const handleRemoveCoach = useCallback(
    async (userId: string) => {
      if (!assignCoachTarget) return;
      const ok = await mutations.removeUserFromClub({
        userId,
        clubId: assignCoachTarget.id
      });
      if (ok) {
        setMemberships((current) => current.filter((m) => m.userId !== userId));
        await reload();
      }
    },
    [mutations, reload, assignCoachTarget]
  );

  const handleAssignTeam = useCallback(
    async (teamId: string) => {
      if (!assignTeamTarget) return null;
      const result = await mutations.assignTeamToClub(assignTeamTarget.id, { teamId });
      if (result !== null) {
        await loadTeams();
        await reload();
      }
      return result;
    },
    [mutations, reload, loadTeams, assignTeamTarget]
  );

  const handleStatusFlip = useCallback(
    async (club: Club) => {
      const nextStatus = (club.status || 'active') === 'active' ? 'inactive' : 'active';
      const result = await mutations.setClubStatus(club.id, nextStatus);
      if (result) {
        await reload();
      }
    },
    [mutations, reload]
  );

  if (!isAdmin) {
    return <p>403 Forbidden. Only SystemAdmin can manage clubs.</p>;
  }

  return (
    <section>
      <h2>Clubs</h2>
      <p>
        Active: {stats.active} | Inactive: {stats.inactive} | Total coaches: {stats.totalCoaches} |
        Total teams: {stats.totalTeams}
      </p>
      {error ? <p role="alert">{error}</p> : null}
      {mutations.state.error ? <p role="alert">{mutations.state.error}</p> : null}

      <label>
        Search
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search clubs" />
      </label>
      <label>
        Status
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}>
          <option value="active">Active only</option>
          <option value="inactive">Inactive only</option>
          <option value="all">All statuses</option>
        </select>
      </label>

      <button type="button" onClick={() => setCreateOpen(true)}>Add Club</button>

      <table>
        <thead>
          <tr>
            <th>Name</th>
            <th>Status</th>
            <th>Coaches</th>
            <th>Teams</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {filtered.map((club) => (
            <tr key={club.id}>
              <td>{club.name}</td>
              <td>{club.status || 'active'}</td>
              <td>{club.coachCount ?? '—'}</td>
              <td>{club.teamCount ?? '—'}</td>
              <td>
                <button type="button" onClick={() => setRenameTarget(club)}>Update</button>
                <button type="button" onClick={() => setAssignCoachTarget(club)}>Assign Coach(s)</button>
                <button type="button" onClick={() => setAssignTeamTarget(club)}>Assign Team(s)</button>
                <button
                  type="button"
                  onClick={() => handleStatusFlip(club)}
                  disabled={mutations.state.pending}
                >
                  {(club.status || 'active') === 'active' ? 'Deactivate' : 'Reactivate'}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {createOpen ? (
        <CreateClubDialog
          onSubmit={handleCreate}
          onClose={() => setCreateOpen(false)}
        />
      ) : null}

      <RenameClubDialog
        club={renameTarget}
        onSubmit={handleRename}
        onClose={() => setRenameTarget(null)}
      />

      <AssignCoachDialog
        club={assignCoachTarget}
        coaches={coaches}
        memberships={memberships}
        onSubmit={handleAssignCoach}
        onRemove={handleRemoveCoach}
        onClose={() => setAssignCoachTarget(null)}
      />

      <AssignTeamDialog
        club={assignTeamTarget}
        teams={teams}
        onSubmit={handleAssignTeam}
        onClose={() => setAssignTeamTarget(null)}
      />

      <p>
        Need user-level club assignment? <a href="./admin-users">User and Role Management</a>.
      </p>
    </section>
  );
}