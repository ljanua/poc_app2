import { useEffect, useState } from 'react';
import type { Club } from '../types';

export type TeamOption = {
  id: string;
  name: string;
  leadCoach: string;
  clubId: string | null;
  clubName: string | null;
};

type Props = {
  club: Club | null;
  teams: TeamOption[];
  onSubmit: (teamId: string) => Promise<unknown>;
  onClose: () => void;
};

export function AssignTeamDialog({ club, teams, onSubmit, onClose }: Props) {
  const [selected, setSelected] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    setSelected('');
    setError(null);
  }, [club?.id]);

  if (!club) {
    return null;
  }

  const eligible = teams.filter((team) => String(team.clubId) !== String(club.id));
  const assigned = teams.filter((team) => String(team.clubId) === String(club.id));

  return (
    <div role="dialog" aria-label={`Assign teams to ${club.name}`}>
      <h3>Assign Teams</h3>
      <p>Selected club: <strong>{club.name}</strong></p>
      <form
        onSubmit={async (event) => {
          event.preventDefault();
          setError(null);
          if (!selected) {
            setError('Pick a team first.');
            return;
          }
          setPending(true);
          const result = await onSubmit(selected);
          setPending(false);
          if (result !== null) {
            setSelected('');
          } else {
            setError('Could not move the team.');
          }
        }}
      >
        <label>
          Move team
          <select
            value={selected}
            onChange={(event) => setSelected(event.target.value)}
            required
          >
            <option value="">-- Select a team --</option>
            {eligible.map((team) => (
              <option key={team.id} value={team.id}>
                {team.name} ({team.clubName ?? 'no club'})
              </option>
            ))}
          </select>
        </label>
        {error ? <p role="alert">{error}</p> : null}
        <button type="submit" disabled={pending || !selected}>Move</button>
        <button type="button" onClick={onClose}>Close</button>
      </form>
      <ul>
        {assigned.length === 0 ? <li>No teams assigned yet.</li> : null}
        {assigned.map((team) => (
          <li key={team.id}>{team.name} ({team.leadCoach})</li>
        ))}
      </ul>
    </div>
  );
}