import { useEffect, useMemo, useState } from 'react';
import type { Club, ClubMembership } from '../types';

export type CoachOption = {
  id: string;
  name: string;
  role: string;
};

type Props = {
  club: Club | null;
  coaches: CoachOption[];
  memberships: ClubMembership[];
  onSubmit: (userId: string) => Promise<ClubMembership | null>;
  onRemove: (userId: string) => Promise<void>;
  onClose: () => void;
};

export function AssignCoachDialog({ club, coaches, memberships, onSubmit, onRemove, onClose }: Props) {
  const [selected, setSelected] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    setSelected('');
    setError(null);
  }, [club?.id]);

  const eligible = useMemo(() => {
    if (!club) return [];
    const assigned = new Set(memberships.map((m) => m.userId));
    return coaches.filter((coach) => !assigned.has(coach.id));
  }, [club, coaches, memberships]);

  if (!club) {
    return null;
  }

  return (
    <div role="dialog" aria-label={`Assign coaches to ${club.name}`}>
      <h3>Assign Coaches</h3>
      <p>Selected club: <strong>{club.name}</strong></p>
      <form
        onSubmit={async (event) => {
          event.preventDefault();
          setError(null);
          if (!selected) {
            setError('Pick a coach first.');
            return;
          }
          setPending(true);
          const result = await onSubmit(selected);
          setPending(false);
          if (result) {
            setSelected('');
          } else {
            setError('Could not assign the coach.');
          }
        }}
      >
        <label>
          Add coach
          <select
            value={selected}
            onChange={(event) => setSelected(event.target.value)}
            required
          >
            <option value="">-- Select a coach --</option>
            {eligible.map((coach) => (
              <option key={coach.id} value={coach.id}>
                {coach.name} ({coach.role})
              </option>
            ))}
          </select>
        </label>
        {error ? <p role="alert">{error}</p> : null}
        <button type="submit" disabled={pending || !selected}>Assign</button>
        <button type="button" onClick={onClose}>Close</button>
      </form>
      <ul>
        {memberships.length === 0 ? <li>No coaches assigned yet.</li> : null}
        {memberships.map((membership) => (
          <li key={membership.userId}>
            {coaches.find((c) => c.id === membership.userId)?.name ?? membership.userId}
            <button type="button" onClick={() => onRemove(membership.userId)} aria-label="Remove">×</button>
          </li>
        ))}
      </ul>
    </div>
  );
}