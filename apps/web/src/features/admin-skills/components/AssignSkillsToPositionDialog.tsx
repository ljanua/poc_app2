import { useEffect, useMemo, useState } from 'react';
import type { Skill } from '../types';

type Props = {
  open: boolean;
  availableSkills: Skill[];
  assignedSkillIds: Set<string>;
  onSubmit: (newlyCheckedIds: string[]) => Promise<unknown>;
  onClose: () => void;
};

export function AssignSkillsToPositionDialog({
  open,
  availableSkills,
  assignedSkillIds,
  onSubmit,
  onClose
}: Props) {
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (open) {
      setChecked(new Set(assignedSkillIds));
      setError(null);
    }
  }, [open, assignedSkillIds]);

  const sorted = useMemo(
    () => [...availableSkills].sort((a, b) => a.name.localeCompare(b.name)),
    [availableSkills]
  );

  if (!open) {
    return null;
  }

  const toggle = (id: string) => {
    setChecked((current) => {
      const next = new Set(current);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleSave = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    const newlyChecked: string[] = [];
    checked.forEach((id) => {
      if (!assignedSkillIds.has(id)) {
        newlyChecked.push(id);
      }
    });
    setPending(true);
    const result = await onSubmit(newlyChecked);
    setPending(false);
    if (result !== null) {
      onClose();
    } else {
      setError('Could not assign the skills.');
    }
  };

  return (
    <div role="dialog" aria-label="Assign skills to position">
      <h3>Assign Skills</h3>
      <p>Check the skills you want to add. Already-assigned skills are pre-checked.</p>
      <form onSubmit={handleSave}>
        <div
          style={{
            maxHeight: 240,
            overflowY: 'auto',
            border: '1px solid #ccc',
            padding: 8
          }}
        >
          {sorted.length === 0 ? <p>No skills available.</p> : null}
          {sorted.map((skill) => (
            <label key={skill.id} style={{ display: 'block' }}>
              <input
                type="checkbox"
                checked={checked.has(skill.id)}
                onChange={() => toggle(skill.id)}
              />
              {skill.name}
            </label>
          ))}
        </div>
        {error ? <p role="alert">{error}</p> : null}
        <button type="submit" disabled={pending}>Save</button>
        <button type="button" onClick={onClose}>Cancel</button>
      </form>
    </div>
  );
}