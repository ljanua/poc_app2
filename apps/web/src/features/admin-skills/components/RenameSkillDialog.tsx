import { useState } from 'react';
import type { Skill } from '../types';

type Props = {
  skill: Skill | null;
  onSubmit: (name: string) => Promise<Skill | null>;
  onClose: () => void;
};

export function RenameSkillDialog({ skill, onSubmit, onClose }: Props) {
  const [name, setName] = useState(skill?.name ?? '');
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  if (!skill) {
    return null;
  }

  return (
    <div role="dialog" aria-label={`Update ${skill.name}`}>
      <h3>Update Skill</h3>
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
            setError('Could not update the skill.');
          }
        }}
      >
        <p>Selected skill: <strong>{skill.name}</strong></p>
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