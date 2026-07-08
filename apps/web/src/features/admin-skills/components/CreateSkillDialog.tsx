import { useState } from 'react';
import type { Skill } from '../types';

type Props = {
  onSubmit: (name: string) => Promise<Skill | null>;
  onClose: () => void;
};

export function CreateSkillDialog({ onSubmit, onClose }: Props) {
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  return (
    <div role="dialog" aria-label="Create skill">
      <h3>Add Skill</h3>
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
            setError('Could not create the skill.');
          }
        }}
      >
        <label>
          Skill name
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            minLength={2}
            maxLength={60}
            required
          />
        </label>
        {error ? <p role="alert">{error}</p> : null}
        <button type="submit" disabled={pending || name.trim().length < 2}>Save Skill</button>
        <button type="button" onClick={onClose}>Cancel</button>
      </form>
    </div>
  );
}