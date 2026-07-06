import { useEffect, useState } from 'react';
import type { Club, ClubMembership } from '../../admin-clubs/types';

type Props = {
  userId: string;
  userName: string;
  clubs: Club[];
  memberships: ClubMembership[];
  onSubmit: (clubId: string) => Promise<ClubMembership | null>;
  onRemove: (clubId: string) => Promise<boolean>;
  onClose: () => void;
};

export function AssignClubDialog({
  userId,
  userName,
  clubs,
  memberships,
  onSubmit,
  onRemove,
  onClose
}: Props) {
  const [selected, setSelected] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    setSelected('');
    setError(null);
  }, [userId]);

  const assignedIds = new Set(memberships.map((m) => m.clubId));
  const eligible = clubs.filter((club) => !assignedIds.has(club.id));

  return (
    <div role="dialog" aria-label={`Assign club to ${userName}`}>
      <h3>Assign Club</h3>
      <p>Selected user: <strong>{userName}</strong></p>
      <form
        onSubmit={async (event) => {
          event.preventDefault();
          setError(null);
          if (!selected) {
            setError('Pick a club first.');
            return;
          }
          setPending(true);
          const result = await onSubmit(selected);
          setPending(false);
          if (result) {
            setSelected('');
          } else {
            setError('Could not assign the club.');
          }
        }}
      >
        <label>
          Club
          <select
            value={selected}
            onChange={(event) => setSelected(event.target.value)}
            required
          >
            <option value="">-- Select a club --</option>
            {eligible.map((club) => (
              <option key={club.id} value={club.id}>{club.name}</option>
            ))}
          </select>
        </label>
        {error ? <p role="alert">{error}</p> : null}
        <button type="submit" disabled={pending || !selected}>Assign</button>
        <button type="button" onClick={onClose}>Cancel</button>
      </form>
      <ul>
        {memberships.length === 0 ? <li>No clubs assigned yet.</li> : null}
        {memberships.map((membership) => (
          <li key={membership.clubId}>
            {membership.clubName}
            <button
              type="button"
              onClick={() => onRemove(membership.clubId)}
              aria-label={`Remove ${membership.clubName}`}
            >
              ×
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}