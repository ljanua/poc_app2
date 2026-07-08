import { useState } from 'react';
import type { Sport } from '../types';

type Props = {
  onSubmit: (name: string) => Promise<Sport | null>;
  onClose: () => void;
};

export function CreateSportDialog({ onSubmit, onClose }: Props) {
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  return (
    <div role="dialog" aria-label="Create sport">
      <h3>Add Sport</h3>
      <form
        onSubmit={async (event) => {
          event.preventDefault();
          setError(null);
          setPending(true);
          const result = await onSubmit(name.trim());
          setPending(false);
          if (result) {
            setName('');
            onClose();
          } else {
            setError('Could not create the sport.');
          }
        }}
      >
        <label>
          Sport name
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            minLength={2}
            maxLength={40}
            required
          />
        </label>
        {error ? <p role="alert">{error}</p> : null}
        <button type="submit" disabled={pending || name.trim().length < 2}>Save Sport</button>
        <button type="button" onClick={onClose}>Cancel</button>
      </form>
    </div>
  );
}