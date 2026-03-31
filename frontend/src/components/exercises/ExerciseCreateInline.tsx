import { useState, FormEvent } from 'react';
import type { ExerciseListItem, WorkoutExerciseKind } from '../../types/api';
import { createExercise } from '../../api/client';

const KIND_OPTIONS: { value: WorkoutExerciseKind; label: string }[] = [
  { value: 'weight_reps', label: 'Weight × reps' },
  { value: 'bodyweight_reps', label: 'Bodyweight reps' },
  { value: 'time', label: 'Time' },
];

export function exerciseKindLabel(kind: string): string {
  if (kind === 'weight_reps') return 'Weight × reps';
  if (kind === 'bodyweight_reps') return 'Reps';
  return 'Time';
}

export interface ExerciseCreateInlineProps {
  userId: string;
  onCreated: (ex: ExerciseListItem) => void;
  onError?: (message: string | null) => void;
  submitLabel?: string;
  className?: string;
}

export default function ExerciseCreateInline({
  userId,
  onCreated,
  onError,
  submitLabel = 'Create',
  className,
}: ExerciseCreateInlineProps) {
  const [name, setName] = useState('');
  const [kind, setKind] = useState<WorkoutExerciseKind>('weight_reps');
  const [saving, setSaving] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const n = name.trim();
    if (!n || saving) return;
    setSaving(true);
    try {
      const ex = await createExercise(userId, { name: n, kind });
      setName('');
      onCreated(ex);
    } catch (err) {
      onError?.(err instanceof Error ? err.message : 'Failed to create exercise');
    } finally {
      setSaving(false);
    }
  };

  return (
    <form className={className ?? ''} onSubmit={(e) => void submit(e)}>
      <label className="form-label" htmlFor="ex-create-name">
        New custom exercise
      </label>
      <div className="workout-inline exercise-create-inline__row">
        <input
          id="ex-create-name"
          className="form-input"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Landmine press"
          maxLength={120}
          disabled={saving}
        />
        <select
          className="form-input exercise-create-inline__kind"
          value={kind}
          onChange={(e) => setKind(e.target.value as WorkoutExerciseKind)}
          disabled={saving}
          aria-label="Exercise kind"
        >
          {KIND_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <button type="submit" className="btn btn--secondary" disabled={saving || !name.trim()}>
          {saving ? '…' : submitLabel}
        </button>
      </div>
    </form>
  );
}
