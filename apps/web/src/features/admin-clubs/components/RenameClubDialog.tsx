import { useState } from 'react';
import type { Club } from '../types';

type Props = {
  club: Club | null;
  onSubmit: (name: string) => Promise<Club | null>;
  onClose: () => void;
};

export function RenameClubDialog({ club, onSubmit, onClose }: Props) {
  const [name, setName] = useState(club?.name ?? '');
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  if (!club) {
    return null;
  }

  return (
    <div role="dialog" aria-label={`Update ${club.name}`}>
      <h3>Update Club</h3>
      <form
        onSubmit={async (event) => {
          event.preventDefault();
          setError(null);
          setPending(true);
          const result = await onSubmit(name.trim());
          setPending(false);
          if (result) {
            onClose();
          } else {
            setError('Could not update the club.');
          }
        }}
      >
        <p>Selected club: <strong>{club.name}</strong></p>
        <label>
          New name
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            minLength={2}
            maxLength={60}
            required
          />
        </label>
        {error ? <p role="alert">{error}</p> : null}
        <button type="submit" disabled={pending || name.trim().length < 2}>Update</button>
        <button type="button" onClick={onClose}>Cancel</button>
      </form>
    </div>
  );
}