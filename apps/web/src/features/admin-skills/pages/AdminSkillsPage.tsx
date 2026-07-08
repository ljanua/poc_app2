import { useCallback, useMemo, useState } from 'react';
import { CreateSkillDialog } from '../components/CreateSkillDialog';
import { RenameSkillDialog } from '../components/RenameSkillDialog';
import { CreateSportDialog } from '../components/CreateSportDialog';
import { CreatePositionDialog } from '../components/CreatePositionDialog';
import { AssignSkillsToPositionDialog } from '../components/AssignSkillsToPositionDialog';
import { useSkills } from '../hooks/useSkills';
import { usePositions } from '../hooks/usePositions';
import { useSports } from '../hooks/useSports';
import { usePositionSkills } from '../hooks/usePositionSkills';
import { useSkillMutations } from '../hooks/useSkillMutations';
import { usePositionMutations } from '../hooks/usePositionMutations';
import { useSportMutations } from '../hooks/useSportMutations';
import { HttpSkillsApiClient } from '../services/skills-api-client';
import type { Position, Skill, Sport, UserRole } from '../types';

export type AdminActorRole = Extract<UserRole, 'SystemAdmin' | 'Coach'>;

type Props = {
  actorRole: AdminActorRole;
};

export function canAccessAdminSkills(actorRole: AdminActorRole): boolean {
  return actorRole === 'SystemAdmin';
}

const DEFAULT_SPORT_ID = 'sport_soccer';

export function AdminSkillsPage({ actorRole }: Props) {
  const client = useMemo(() => new HttpSkillsApiClient(), []);
  const isAdmin = canAccessAdminSkills(actorRole);

  const [showInactive, setShowInactive] = useState(false);
  const statusFilter = showInactive ? 'all' : 'active';

  const sportsQuery = useSports({ client, statusFilter });
  const positionsQuery = usePositions({
    client,
    sportId: DEFAULT_SPORT_ID,
    statusFilter
  });

  const [selectedSportId, setSelectedSportId] = useState<string>(DEFAULT_SPORT_ID);
  const [selectedPositionId, setSelectedPositionId] = useState<string | null>(null);

  // Re-fetch positions whenever the selected sport changes.
  const positionsForSelectedSport = usePositions({
    client,
    sportId: selectedSportId,
    statusFilter
  });
  const skillsQuery = useSkills({ client, statusFilter: 'all' });
  const skillsForAssignment = useSkills({ client, statusFilter: 'all' });
  const positionSkillsQuery = usePositionSkills({
    client,
    positionId: selectedPositionId
  });

  const sportMutations = useSportMutations(client);
  const positionMutations = usePositionMutations(client);
  const skillMutations = useSkillMutations(client);

  const [createSportOpen, setCreateSportOpen] = useState(false);
  const [createPositionOpen, setCreatePositionOpen] = useState(false);
  const [createSkillOpen, setCreateSkillOpen] = useState(false);
  const [renameSkillTarget, setRenameSkillTarget] = useState<Skill | null>(null);
  const [assignSkillsOpen, setAssignSkillsOpen] = useState(false);

  const handleCreateSport = useCallback(
    async (name: string) => {
      const result = await sportMutations.createSport({ name });
      if (result) await sportsQuery.reload();
      return result;
    },
    [sportMutations, sportsQuery]
  );

  const handleCreatePosition = useCallback(
    async (payload: { name: string; sportId: string }) => {
      const result = await positionMutations.createPosition(payload);
      if (result) await positionsForSelectedSport.reload();
      return result;
    },
    [positionMutations, positionsForSelectedSport]
  );

  const handleCreateSkill = useCallback(
    async (name: string) => {
      const result = await skillMutations.createSkill({ name });
      if (result) await skillsQuery.reload();
      return result;
    },
    [skillMutations, skillsQuery]
  );

  const handleRenameSkill = useCallback(
    async (name: string) => {
      if (!renameSkillTarget) return null;
      const result = await skillMutations.updateSkill(renameSkillTarget.id, { name });
      if (result) await skillsQuery.reload();
      return result;
    },
    [skillMutations, skillsQuery, renameSkillTarget]
  );

  const handleAssignSkills = useCallback(
    async (newlyCheckedIds: string[]) => {
      if (!selectedPositionId) return null;
      let lastResult: unknown = null;
      for (const skillId of newlyCheckedIds) {
        const next = await positionMutations.assignSkillToPosition(
          selectedPositionId,
          skillId
        );
        if (next === null) {
          return null;
        }
        lastResult = next;
      }
      await positionSkillsQuery.reload();
      return lastResult;
    },
    [positionMutations, positionSkillsQuery, selectedPositionId]
  );

  const handleRemoveAssignment = useCallback(
    async (skillId: string) => {
      if (!selectedPositionId) return;
      const ok = await positionMutations.removeSkillFromPosition(
        selectedPositionId,
        skillId
      );
      if (ok) await positionSkillsQuery.reload();
    },
    [positionMutations, positionSkillsQuery, selectedPositionId]
  );

  const handleSkillStatusFlip = useCallback(
    async (skill: Skill) => {
      // Skills do not have a setStatus endpoint in v1; flip via delete (delete is the only state transition).
      const next = skill.status === 'active' ? 'inactive' : 'active';
      if (next === 'inactive') {
        const ok = await skillMutations.deleteSkill(skill.id);
        if (ok) await skillsQuery.reload();
      } else {
        // No "reactivate" path — re-create via name is not supported; surface a no-op.
        await skillMutations.setSkillStatus(skill.id, next);
      }
    },
    [skillMutations, skillsQuery]
  );

  const handlePositionStatusFlip = useCallback(
    async (position: Position) => {
      const next = position.status === 'active' ? 'inactive' : 'active';
      const result = await positionMutations.setPositionStatus(position.id, next);
      if (result) await positionsForSelectedSport.reload();
    },
    [positionMutations, positionsForSelectedSport]
  );

  const handleSportStatusFlip = useCallback(
    async (sport: Sport) => {
      const next = sport.status === 'active' ? 'inactive' : 'active';
      const result = await sportMutations.setSportStatus(sport.id, next);
      if (result) await sportsQuery.reload();
    },
    [sportMutations, sportsQuery]
  );

  // KPI calculations
  const kpis = useMemo(() => {
    const totalSports = sportsQuery.data.length;
    const activePositions = positionsForSelectedSport.data.filter(
      (p) => p.status === 'active'
    ).length;
    const totalSkills = skillsQuery.data.length;
    const totalAssignments = positionSkillsQuery.data.length;
    return {
      sports: totalSports,
      activePositions,
      skills: totalSkills,
      assignments: totalAssignments
    };
  }, [sportsQuery.data, positionsForSelectedSport.data, skillsQuery.data, positionSkillsQuery.data]);

  const assignedIds = useMemo(
    () => new Set(positionSkillsQuery.data.map((ps) => ps.skillId)),
    [positionSkillsQuery.data]
  );

  if (!isAdmin) {
    return <p>403 Forbidden. Only SystemAdmin can manage skills.</p>;
  }

  return (
    <section>
      <h2>Skills</h2>

      <label>
        <input
          type="checkbox"
          checked={showInactive}
          onChange={(event) => setShowInactive(event.target.checked)}
        />
        Show inactive
      </label>

      <p>
        Sports: {kpis.sports} | Active Positions: {kpis.activePositions} | Skills:{' '}
        {kpis.skills} | Assignments: {kpis.assignments}
      </p>

      {sportsQuery.error ? <p role="alert">{sportsQuery.error}</p> : null}
      {positionsQuery.error ? <p role="alert">{positionsQuery.error}</p> : null}
      {skillsQuery.error ? <p role="alert">{skillsQuery.error}</p> : null}
      {positionSkillsQuery.error ? <p role="alert">{positionSkillsQuery.error}</p> : null}
      {sportMutations.state.error ? <p role="alert">{sportMutations.state.error}</p> : null}
      {positionMutations.state.error ? (
        <p role="alert">{positionMutations.state.error}</p>
      ) : null}
      {skillMutations.state.error ? <p role="alert">{skillMutations.state.error}</p> : null}

      {/* Sports panel */}
      <section>
        <header>
          <h3>Sports</h3>
          <button type="button" onClick={() => setCreateSportOpen(true)}>
            Add Sport
          </button>
        </header>
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Status</th>
              <th># Positions</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {sportsQuery.data.map((sport) => (
              <tr key={sport.id}>
                <td>{sport.name}</td>
                <td>{sport.status}</td>
                <td>{sport.positionCount ?? '—'}</td>
                <td>
                  <button type="button" onClick={() => setSelectedSportId(sport.id)}>
                    Select
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSportStatusFlip(sport)}
                    disabled={sportMutations.state.pending}
                  >
                    {sport.status === 'active' ? 'Deactivate' : 'Reactivate'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {/* Positions panel */}
      <section>
        <header>
          <h3>Positions</h3>
          <button type="button" onClick={() => setCreatePositionOpen(true)}>
            Add Position
          </button>
        </header>
        <label>
          Sport
          <select
            value={selectedSportId}
            onChange={(event) => setSelectedSportId(event.target.value)}
          >
            {sportsQuery.data.map((sport) => (
              <option key={sport.id} value={sport.id}>
                {sport.name}
              </option>
            ))}
          </select>
        </label>
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Status</th>
              <th># Skills</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {positionsForSelectedSport.data.map((position) => (
              <tr key={position.id}>
                <td>{position.name}</td>
                <td>{position.status}</td>
                <td>{position.skillCount ?? '—'}</td>
                <td>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedPositionId(position.id);
                      setAssignSkillsOpen(true);
                    }}
                  >
                    Assign Skills
                  </button>
                  <button
                    type="button"
                    onClick={() => handlePositionStatusFlip(position)}
                    disabled={positionMutations.state.pending}
                  >
                    {position.status === 'active' ? 'Deactivate' : 'Reactivate'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {/* Skills panel */}
      <section>
        <header>
          <h3>Skills</h3>
          <button type="button" onClick={() => setCreateSkillOpen(true)}>
            Add Skill
          </button>
        </header>
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Status</th>
              <th># Positions</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {skillsQuery.data.map((skill) => (
              <tr key={skill.id}>
                <td>{skill.name}</td>
                <td>{skill.status}</td>
                <td>{skill.assignedPositionCount ?? '—'}</td>
                <td>
                  <button type="button" onClick={() => setRenameSkillTarget(skill)}>
                    Update
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSkillStatusFlip(skill)}
                    disabled={skillMutations.state.pending}
                  >
                    {skill.status === 'active' ? 'Deactivate' : 'Reactivate'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {/* Position Skills panel */}
      <section>
        <header>
          <h3>Position Skills</h3>
        </header>
        <label>
          Position
          <select
            value={selectedPositionId ?? ''}
            onChange={(event) => setSelectedPositionId(event.target.value || null)}
          >
            <option value="">-- Select a position --</option>
            {positionsForSelectedSport.data.map((position) => (
              <option key={position.id} value={position.id}>
                {position.name}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          onClick={() => setAssignSkillsOpen(true)}
          disabled={!selectedPositionId}
        >
          Assign Skills
        </button>
        <table>
          <thead>
            <tr>
              <th>Skill</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {positionSkillsQuery.data.map((ps) => (
              <tr key={ps.skillId}>
                <td>{ps.skillName}</td>
                <td>{ps.status}</td>
                <td>
                  <button
                    type="button"
                    onClick={() => handleRemoveAssignment(ps.skillId)}
                    disabled={positionMutations.state.pending}
                  >
                    Remove
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {createSportOpen ? (
        <CreateSportDialog
          onSubmit={handleCreateSport}
          onClose={() => setCreateSportOpen(false)}
        />
      ) : null}

      {createPositionOpen ? (
        <CreatePositionDialog
          sports={sportsQuery.data}
          initialSportId={selectedSportId}
          onSubmit={handleCreatePosition}
          onClose={() => setCreatePositionOpen(false)}
        />
      ) : null}

      {createSkillOpen ? (
        <CreateSkillDialog
          onSubmit={handleCreateSkill}
          onClose={() => setCreateSkillOpen(false)}
        />
      ) : null}

      <RenameSkillDialog
        skill={renameSkillTarget}
        onSubmit={handleRenameSkill}
        onClose={() => setRenameSkillTarget(null)}
      />

      <AssignSkillsToPositionDialog
        open={assignSkillsOpen}
        availableSkills={skillsForAssignment.data}
        assignedSkillIds={assignedIds}
        onSubmit={handleAssignSkills}
        onClose={() => setAssignSkillsOpen(false)}
      />
    </section>
  );
}