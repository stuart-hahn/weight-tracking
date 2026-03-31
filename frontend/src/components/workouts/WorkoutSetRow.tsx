import type { UnitsPreference, WorkoutExerciseNested, WorkoutSetResponse } from '../../types/api';
import { lbToKg } from '../../utils/units';

function formatSetRoleLabel(role: string | null | undefined): string | null {
  if (!role) return null;
  if (role === 'top') return 'Top set';
  if (role === 'backoff') return 'Backoff';
  if (role === 'working') return null;
  return role;
}

interface WorkoutSetRowProps {
  line: WorkoutExerciseNested;
  set: WorkoutSetResponse;
  units: UnitsPreference;
  completed: boolean;
  displayWeight: (kg: number | null) => string;
  parseWeightInput: (s: string) => number | null;
  onPatch: (patch: Partial<import('../../types/api').PatchWorkoutSetRequest>) => void;
  onRest: (seconds: number) => void;
  onDelete?: () => void;
  canDeleteSet: boolean;
  /** Program sessions: hide per-set notes to reduce clutter */
  hideSetNote?: boolean;
}

export default function WorkoutSetRow({
  line,
  set,
  units,
  completed,
  displayWeight,
  parseWeightInput,
  onPatch,
  onRest,
  onDelete,
  canDeleteSet,
  hideSetNote = false,
}: WorkoutSetRowProps) {
  const targetBits: string[] = [];
  if (set.target_reps_min != null || set.target_reps_max != null) {
    targetBits.push(
      `Reps ${set.target_reps_min ?? '—'}–${set.target_reps_max ?? '—'}`
    );
  }
  if (set.target_rir_min != null || set.target_rir_max != null) {
    targetBits.push(`RIR ${set.target_rir_min ?? '—'}–${set.target_rir_max ?? '—'}`);
  }
  const roleLabel = formatSetRoleLabel(set.set_role);
  if (roleLabel) targetBits.push(roleLabel);

  return (
    <div className="workout-set-row workout-set-row--stack-sm">
      {targetBits.length > 0 && (
        <p className="workout-set-row__targets">{targetBits.join(' · ')}</p>
      )}
      <div className="workout-set-row__grid">
        {line.exercise.kind !== 'time' && (
          <div className="workout-set-field">
            <label className="form-label workout-set-field__label">
              {line.exercise.kind === 'bodyweight_reps' ? '—' : units === 'imperial' ? 'lb' : 'kg'}
            </label>
            {line.exercise.kind !== 'bodyweight_reps' && (
              <div className="workout-stepper">
                <button
                  type="button"
                  className="btn btn--secondary btn--sm btn--touch"
                  disabled={completed}
                  aria-label="Decrease weight"
                  onClick={() => {
                    const kg = set.weight_kg ?? 0;
                    const step = units === 'imperial' ? lbToKg(2.5) : 2.5;
                    const next = Math.max(0.5, kg - step);
                    onPatch({ weight_kg: next });
                  }}
                >
                  −
                </button>
                <input
                  key={`w-${set.id}-${set.weight_kg ?? 'x'}`}
                  className="form-input workout-set-input"
                  type="number"
                  disabled={completed}
                  defaultValue={displayWeight(set.weight_kg)}
                  placeholder="—"
                  onBlur={(e) => {
                    const raw = e.target.value.trim();
                    if (raw === '') {
                      onPatch({ weight_kg: null });
                      return;
                    }
                    const kg = parseWeightInput(raw);
                    if (kg != null) onPatch({ weight_kg: kg });
                  }}
                />
                <button
                  type="button"
                  className="btn btn--secondary btn--sm btn--touch"
                  disabled={completed}
                  aria-label="Increase weight"
                  onClick={() => {
                    const kg = set.weight_kg ?? (units === 'imperial' ? lbToKg(45) : 20);
                    const step = units === 'imperial' ? lbToKg(2.5) : 2.5;
                    onPatch({ weight_kg: Math.min(500, kg + step) });
                  }}
                >
                  +
                </button>
              </div>
            )}
          </div>
        )}
        {line.exercise.kind !== 'time' && (
          <div className="workout-set-field">
            <label className="form-label workout-set-field__label">Reps</label>
            <div className="workout-stepper">
              <button
                type="button"
                className="btn btn--secondary btn--sm btn--touch"
                disabled={completed}
                onClick={() => {
                  const r = set.reps ?? 0;
                  onPatch({ reps: Math.max(0, r - 1) });
                }}
              >
                −
              </button>
              <input
                key={`r-${set.id}-${set.reps ?? 'x'}`}
                className="form-input workout-set-input"
                type="number"
                min={0}
                disabled={completed}
                defaultValue={set.reps ?? ''}
                onBlur={(e) => {
                  const raw = e.target.value.trim();
                  if (raw === '') {
                    onPatch({ reps: null });
                    return;
                  }
                  const v = Number(raw);
                  if (!Number.isNaN(v)) onPatch({ reps: v });
                }}
              />
              <button
                type="button"
                className="btn btn--secondary btn--sm btn--touch"
                disabled={completed}
                onClick={() => {
                  const r = set.reps ?? 0;
                  onPatch({ reps: r + 1 });
                }}
              >
                +
              </button>
            </div>
          </div>
        )}
        {line.exercise.kind === 'weight_reps' && (
          <div className="workout-set-field">
            <label className="form-label workout-set-field__label">RIR</label>
            <div className="workout-stepper">
              <button
                type="button"
                className="btn btn--secondary btn--sm btn--touch"
                disabled={completed}
                onClick={() => {
                  const r = set.rir ?? 0;
                  onPatch({ rir: Math.max(0, r - 1) });
                }}
              >
                −
              </button>
              <input
                key={`rir-${set.id}-${set.rir ?? 'x'}`}
                className="form-input workout-set-input"
                type="number"
                min={0}
                disabled={completed}
                defaultValue={set.rir ?? ''}
                onBlur={(e) => {
                  const raw = e.target.value.trim();
                  if (raw === '') {
                    onPatch({ rir: null });
                    return;
                  }
                  const v = Number(raw);
                  if (!Number.isNaN(v)) onPatch({ rir: v });
                }}
              />
              <button
                type="button"
                className="btn btn--secondary btn--sm btn--touch"
                disabled={completed}
                onClick={() => {
                  const r = set.rir ?? 0;
                  onPatch({ rir: Math.min(30, r + 1) });
                }}
              >
                +
              </button>
            </div>
          </div>
        )}
        {line.exercise.kind === 'time' && (
          <div className="workout-set-field">
            <label className="form-label workout-set-field__label">Sec</label>
            <input
              key={`d-${set.id}-${set.duration_sec ?? 'x'}`}
              className="form-input workout-set-input"
              type="number"
              min={0}
              disabled={completed}
              defaultValue={set.duration_sec ?? ''}
              onBlur={(e) => {
                const raw = e.target.value.trim();
                if (raw === '') {
                  onPatch({ duration_sec: null });
                  return;
                }
                const v = Number(raw);
                if (!Number.isNaN(v)) onPatch({ duration_sec: v });
              }}
            />
          </div>
        )}
        {!hideSetNote && (
          <div className="workout-set-field workout-set-field--grow">
            <label className="form-label workout-set-field__label">Note</label>
            <input
              key={`n-${set.id}-${set.notes ?? ''}`}
              className="form-input"
              disabled={completed}
              defaultValue={set.notes ?? ''}
              onBlur={(e) => onPatch({ notes: e.target.value.trim() || null })}
            />
          </div>
        )}
        {!completed && (
          <div className="workout-set-actions">
            <button
              type="button"
              className="btn btn--secondary btn--sm btn--touch"
              onClick={() => {
                const sec = set.rest_seconds_after ?? line.default_rest_seconds ?? 90;
                onRest(Math.min(3600, Math.max(5, sec)));
              }}
            >
              Rest
            </button>
            {canDeleteSet && onDelete && (
              <button type="button" className="btn btn--secondary btn--sm btn--touch" onClick={onDelete}>
                ✕
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
