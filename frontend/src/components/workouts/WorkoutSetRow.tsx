import { useState, useEffect, useRef, useCallback } from 'react';
import type { UnitsPreference, WorkoutExerciseNested, WorkoutSetResponse } from '../../types/api';
import { lbToKg } from '../../utils/units';

const DEBOUNCE_MS = 350;
const LAST_REST_STORAGE_KEY = 'workout-last-rest-seconds';

function formatSetRoleLabel(role: string | null | undefined): string | null {
  if (!role) return null;
  if (role === 'top') return 'Top set';
  if (role === 'backoff') return 'Backoff';
  if (role === 'working') return null;
  return role;
}

function readLastRestSeconds(): number | null {
  try {
    const raw = localStorage.getItem(LAST_REST_STORAGE_KEY);
    if (raw == null) return null;
    const n = Number(raw);
    if (Number.isNaN(n) || n < 5) return null;
    return Math.min(3600, n);
  } catch {
    return null;
  }
}

function writeLastRestSeconds(sec: number): void {
  try {
    localStorage.setItem(LAST_REST_STORAGE_KEY, String(sec));
  } catch {
    /* ignore */
  }
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
  /** Row-level save feedback (avoids global banner for patch failures) */
  isPatching?: boolean;
  patchError?: string | null;
  onDismissPatchError?: () => void;
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
  isPatching = false,
  patchError = null,
  onDismissPatchError,
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

  const defaultRestSec = set.rest_seconds_after ?? line.default_rest_seconds ?? 90;
  const [lastRestSec, setLastRestSec] = useState<number | null>(() => readLastRestSeconds());

  const patchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingPatchRef = useRef<Partial<import('../../types/api').PatchWorkoutSetRequest>>({});

  const [weightDraft, setWeightDraft] = useState(() => displayWeight(set.weight_kg));
  const [repsDraft, setRepsDraft] = useState(() => (set.reps != null ? String(set.reps) : ''));
  const [rirDraft, setRirDraft] = useState(() => (set.rir != null ? String(set.rir) : ''));
  const [durationDraft, setDurationDraft] = useState(() =>
    set.duration_sec != null ? String(set.duration_sec) : ''
  );
  const [fieldErrors, setFieldErrors] = useState<{ weight?: string; reps?: string; rir?: string; duration?: string }>({});

  useEffect(() => {
    setWeightDraft(displayWeight(set.weight_kg));
  }, [set.id, set.weight_kg, units]);

  useEffect(() => {
    setRepsDraft(set.reps != null ? String(set.reps) : '');
  }, [set.id, set.reps]);

  useEffect(() => {
    setRirDraft(set.rir != null ? String(set.rir) : '');
  }, [set.id, set.rir]);

  useEffect(() => {
    setDurationDraft(set.duration_sec != null ? String(set.duration_sec) : '');
  }, [set.id, set.duration_sec]);

  useEffect(
    () => () => {
      if (patchTimerRef.current) clearTimeout(patchTimerRef.current);
    },
    []
  );

  const clearPatchTimer = useCallback(() => {
    if (patchTimerRef.current) {
      clearTimeout(patchTimerRef.current);
      patchTimerRef.current = null;
    }
  }, []);

  const flushPendingPatch = useCallback(() => {
    if (completed) return;
    clearPatchTimer();
    const patch = pendingPatchRef.current;
    pendingPatchRef.current = {};
    const keys = Object.keys(patch);
    if (keys.length === 0) return;
    onPatch(patch);
  }, [clearPatchTimer, completed, onPatch]);

  const queuePatch = useCallback(
    (patch: Partial<import('../../types/api').PatchWorkoutSetRequest>, opts?: { flush?: boolean }) => {
      if (completed) return;
      pendingPatchRef.current = { ...pendingPatchRef.current, ...patch };
      if (opts?.flush) {
        flushPendingPatch();
        return;
      }
      clearPatchTimer();
      patchTimerRef.current = setTimeout(() => {
        patchTimerRef.current = null;
        flushPendingPatch();
      }, DEBOUNCE_MS);
    },
    [clearPatchTimer, completed, flushPendingPatch]
  );

  const setFieldError = useCallback((key: keyof typeof fieldErrors, msg: string | undefined) => {
    setFieldErrors((prev) => {
      const next = { ...prev };
      if (msg == null) delete next[key];
      else next[key] = msg;
      return next;
    });
  }, []);

  const queueWeightFromDraft = useCallback(
    (raw: string, opts?: { flush?: boolean }) => {
      const t = raw.trim();
      if (t === '') {
        setFieldError('weight', undefined);
        queuePatch({ weight_kg: null }, opts);
        return;
      }
      const kg = parseWeightInput(t);
      if (kg == null) {
        setFieldError('weight', 'Enter a valid weight');
        return;
      }
      setFieldError('weight', undefined);
      queuePatch({ weight_kg: kg }, opts);
    },
    [parseWeightInput, queuePatch, setFieldError]
  );

  const queueIntFromDraft = useCallback(
    (
      key: 'reps' | 'rir' | 'duration',
      raw: string,
      field: 'reps' | 'rir' | 'duration_sec',
      opts?: { flush?: boolean }
    ) => {
      const t = raw.trim();
      if (t === '') {
        setFieldError(key, undefined);
        queuePatch({ [field]: null } as Partial<import('../../types/api').PatchWorkoutSetRequest>, opts);
        return;
      }
      const v = Number(t);
      if (Number.isNaN(v) || v < 0) {
        setFieldError(key, 'Enter a valid number');
        return;
      }
      setFieldError(key, undefined);
      queuePatch({ [field]: v } as Partial<import('../../types/api').PatchWorkoutSetRequest>, opts);
    },
    [queuePatch, setFieldError]
  );

  const fireRest = useCallback(
    (sec: number) => {
      const clamped = Math.min(3600, Math.max(5, sec));
      writeLastRestSeconds(clamped);
      setLastRestSec(clamped);
      onRest(clamped);
    },
    [onRest]
  );

  return (
    <div className="workout-set-row workout-set-row--stack-sm" aria-busy={isPatching || undefined}>
      {(isPatching || patchError) && (
        <div className="workout-set-row__status">
          {isPatching && <span className="workout-set-row__saving">Saving…</span>}
          {patchError && (
            <p className="workout-set-row__error" role="alert">
              {patchError}
              {onDismissPatchError && (
                <button type="button" className="workout-set-row__error-dismiss" onClick={onDismissPatchError}>
                  Dismiss
                </button>
              )}
            </p>
          )}
        </div>
      )}
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
                    setWeightDraft(displayWeight(next));
                    setFieldError('weight', undefined);
                    queuePatch({ weight_kg: next }, { flush: true });
                  }}
                >
                  −
                </button>
                <input
                  className="form-input workout-set-input"
                  type="number"
                  disabled={completed}
                  value={weightDraft}
                  placeholder="—"
                  onChange={(e) => {
                    setWeightDraft(e.target.value);
                    queueWeightFromDraft(e.target.value);
                  }}
                  onBlur={() => queueWeightFromDraft(weightDraft, { flush: true })}
                />
                <button
                  type="button"
                  className="btn btn--secondary btn--sm btn--touch"
                  disabled={completed}
                  aria-label="Increase weight"
                  onClick={() => {
                    const kg = set.weight_kg ?? (units === 'imperial' ? lbToKg(45) : 20);
                    const step = units === 'imperial' ? lbToKg(2.5) : 2.5;
                    const next = Math.min(500, kg + step);
                    setWeightDraft(displayWeight(next));
                    setFieldError('weight', undefined);
                    queuePatch({ weight_kg: next }, { flush: true });
                  }}
                >
                  +
                </button>
              </div>
            )}
            {fieldErrors.weight && <p className="progress-text workout-set-row__field-error">{fieldErrors.weight}</p>}
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
                  const next = Math.max(0, r - 1);
                  setRepsDraft(String(next));
                  setFieldError('reps', undefined);
                  queuePatch({ reps: next }, { flush: true });
                }}
              >
                −
              </button>
              <input
                className="form-input workout-set-input"
                type="number"
                min={0}
                disabled={completed}
                value={repsDraft}
                onChange={(e) => {
                  setRepsDraft(e.target.value);
                  queueIntFromDraft('reps', e.target.value, 'reps');
                }}
                onBlur={() => queueIntFromDraft('reps', repsDraft, 'reps', { flush: true })}
              />
              <button
                type="button"
                className="btn btn--secondary btn--sm btn--touch"
                disabled={completed}
                onClick={() => {
                  const r = set.reps ?? 0;
                  const next = r + 1;
                  setRepsDraft(String(next));
                  setFieldError('reps', undefined);
                  queuePatch({ reps: next }, { flush: true });
                }}
              >
                +
              </button>
            </div>
            {fieldErrors.reps && <p className="progress-text workout-set-row__field-error">{fieldErrors.reps}</p>}
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
                  const next = Math.max(0, r - 1);
                  setRirDraft(String(next));
                  setFieldError('rir', undefined);
                  queuePatch({ rir: next }, { flush: true });
                }}
              >
                −
              </button>
              <input
                className="form-input workout-set-input"
                type="number"
                min={0}
                disabled={completed}
                value={rirDraft}
                onChange={(e) => {
                  setRirDraft(e.target.value);
                  queueIntFromDraft('rir', e.target.value, 'rir');
                }}
                onBlur={() => queueIntFromDraft('rir', rirDraft, 'rir', { flush: true })}
              />
              <button
                type="button"
                className="btn btn--secondary btn--sm btn--touch"
                disabled={completed}
                onClick={() => {
                  const r = set.rir ?? 0;
                  const next = Math.min(30, r + 1);
                  setRirDraft(String(next));
                  setFieldError('rir', undefined);
                  queuePatch({ rir: next }, { flush: true });
                }}
              >
                +
              </button>
            </div>
            {fieldErrors.rir && <p className="progress-text workout-set-row__field-error">{fieldErrors.rir}</p>}
          </div>
        )}
        {line.exercise.kind === 'time' && (
          <div className="workout-set-field">
            <label className="form-label workout-set-field__label">Sec</label>
            <input
              className="form-input workout-set-input"
              type="number"
              min={0}
              disabled={completed}
              value={durationDraft}
              onChange={(e) => {
                setDurationDraft(e.target.value);
                queueIntFromDraft('duration', e.target.value, 'duration_sec');
              }}
              onBlur={() => queueIntFromDraft('duration', durationDraft, 'duration_sec', { flush: true })}
            />
            {fieldErrors.duration && <p className="progress-text workout-set-row__field-error">{fieldErrors.duration}</p>}
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
          <div className="workout-set-actions workout-set-actions--with-hint">
            <span className="workout-set-actions__rest-hint">Rest ~{defaultRestSec}s</span>
            <button type="button" className="btn btn--secondary btn--sm btn--touch" onClick={() => fireRest(defaultRestSec)}>
              Rest
            </button>
            {lastRestSec != null && lastRestSec !== defaultRestSec && (
              <button
                type="button"
                className="btn btn--secondary btn--sm btn--touch"
                onClick={() => fireRest(lastRestSec)}
              >
                Last ({lastRestSec}s)
              </button>
            )}
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
