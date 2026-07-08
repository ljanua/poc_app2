import { useEffect, useState } from 'react';
import type { Position, Sport } from '../types';

type Props = {
  sports: Sport[];
  initialSportId?: string;
  onSubmit: (payload: { name: string; sportId: string }) => Promise<Position | null>;
  onClose: () => void;
};

export function CreatePositionDialog({ sports, initialSportId, onSubmit, onClose }: Props) {
  const [name, setName] = useState('');
  const [sportId, setSportId] = useState(initialSportId ?? '');
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    setSportId(initialSportId ?? sports[0]?.id ?? '');
    setName('');
    setError(null);
  }, [initialSportId, sports]);

  return (
    <div role="dialog" aria-label="Create position">
      <h3>Add Position</h3>
      <form
        onSubmit={async (event) => {
          event.preventDefault();
          setError(null);
          if (!sportId) {
            setError('Pick a sport first.');
            return;
          }
          setPending(true);
          const result = await onSubmit({ name: name.trim(), sportId });
          setPending(false);
          if (result) {
            setName('');
            onClose();
          } else {
            setError('Could not create the position.');
          }
        }}
      >
        <label>
          Position name
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            minLength={2}
            maxLength={80}
            required
          />
        </label>
        <label>
          Sport
          <select
            value={sportId}
            onChange={(event) => setSportId(event.target.value)}
            required
          >
            <option value="">-- Select a sport --</option>
            {sports.map((sport) => (
              <option key={sport.id} value={sport.id}>
                {sport.name}
              </option>
            ))}
          </select>
        </label>
        {error ? <p role="alert">{error}</p> : null}
        <button
          type="submit"
          disabled={pending || name.trim().length < 2 || !sportId}
        >
          Save Position
        </button>
        <button type="button" onClick={onClose}>Cancel</button>
      </form>
    </div>
  );
}