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

  const defaultRestSec = set.rest_seconds_after ?? line.default_rest_seconds ?? 90;
  const [lastRestSec, setLastRestSec] = useState<number | null>(() => readLastRestSeconds());

  const weightTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const repsTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const rirTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const durationTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [weightDraft, setWeightDraft] = useState(() => displayWeight(set.weight_kg));
  const [repsDraft, setRepsDraft] = useState(() => (set.reps != null ? String(set.reps) : ''));
  const [rirDraft, setRirDraft] = useState(() => (set.rir != null ? String(set.rir) : ''));
  const [durationDraft, setDurationDraft] = useState(() =>
    set.duration_sec != null ? String(set.duration_sec) : ''
  );

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
      if (weightTimerRef.current) clearTimeout(weightTimerRef.current);
      if (repsTimerRef.current) clearTimeout(repsTimerRef.current);
      if (rirTimerRef.current) clearTimeout(rirTimerRef.current);
      if (durationTimerRef.current) clearTimeout(durationTimerRef.current);
    },
    []
  );

  const clearWeightTimer = useCallback(() => {
    if (weightTimerRef.current) {
      clearTimeout(weightTimerRef.current);
      weightTimerRef.current = null;
    }
  }, []);

  const flushWeight = useCallback(
    (raw: string) => {
      if (completed) return;
      clearWeightTimer();
      const t = raw.trim();
      if (t === '') onPatch({ weight_kg: null });
      else {
        const kg = parseWeightInput(t);
        if (kg != null) onPatch({ weight_kg: kg });
      }
    },
    [clearWeightTimer, completed, onPatch, parseWeightInput]
  );

  const scheduleWeight = useCallback(
    (raw: string) => {
      if (completed) return;
      clearWeightTimer();
      weightTimerRef.current = setTimeout(() => {
        weightTimerRef.current = null;
        const t = raw.trim();
        if (t === '') onPatch({ weight_kg: null });
        else {
          const kg = parseWeightInput(t);
          if (kg != null) onPatch({ weight_kg: kg });
        }
      }, DEBOUNCE_MS);
    },
    [clearWeightTimer, completed, onPatch, parseWeightInput]
  );

  const clearRepsTimer = useCallback(() => {
    if (repsTimerRef.current) {
      clearTimeout(repsTimerRef.current);
      repsTimerRef.current = null;
    }
  }, []);

  const flushReps = useCallback(
    (raw: string) => {
      if (completed) return;
      clearRepsTimer();
      const t = raw.trim();
      if (t === '') onPatch({ reps: null });
      else {
        const v = Number(t);
        if (!Number.isNaN(v)) onPatch({ reps: v });
      }
    },
    [clearRepsTimer, completed, onPatch]
  );

  const scheduleReps = useCallback(
    (raw: string) => {
      if (completed) return;
      clearRepsTimer();
      repsTimerRef.current = setTimeout(() => {
        repsTimerRef.current = null;
        const t = raw.trim();
        if (t === '') onPatch({ reps: null });
        else {
          const v = Number(t);
          if (!Number.isNaN(v)) onPatch({ reps: v });
        }
      }, DEBOUNCE_MS);
    },
    [clearRepsTimer, completed, onPatch]
  );

  const clearRirTimer = useCallback(() => {
    if (rirTimerRef.current) {
      clearTimeout(rirTimerRef.current);
      rirTimerRef.current = null;
    }
  }, []);

  const flushRir = useCallback(
    (raw: string) => {
      if (completed) return;
      clearRirTimer();
      const t = raw.trim();
      if (t === '') onPatch({ rir: null });
      else {
        const v = Number(t);
        if (!Number.isNaN(v)) onPatch({ rir: v });
      }
    },
    [clearRirTimer, completed, onPatch]
  );

  const scheduleRir = useCallback(
    (raw: string) => {
      if (completed) return;
      clearRirTimer();
      rirTimerRef.current = setTimeout(() => {
        rirTimerRef.current = null;
        const t = raw.trim();
        if (t === '') onPatch({ rir: null });
        else {
          const v = Number(t);
          if (!Number.isNaN(v)) onPatch({ rir: v });
        }
      }, DEBOUNCE_MS);
    },
    [clearRirTimer, completed, onPatch]
  );

  const clearDurationTimer = useCallback(() => {
    if (durationTimerRef.current) {
      clearTimeout(durationTimerRef.current);
      durationTimerRef.current = null;
    }
  }, []);

  const flushDuration = useCallback(
    (raw: string) => {
      if (completed) return;
      clearDurationTimer();
      const t = raw.trim();
      if (t === '') onPatch({ duration_sec: null });
      else {
        const v = Number(t);
        if (!Number.isNaN(v)) onPatch({ duration_sec: v });
      }
    },
    [clearDurationTimer, completed, onPatch]
  );

  const scheduleDuration = useCallback(
    (raw: string) => {
      if (completed) return;
      clearDurationTimer();
      durationTimerRef.current = setTimeout(() => {
        durationTimerRef.current = null;
        const t = raw.trim();
        if (t === '') onPatch({ duration_sec: null });
        else {
          const v = Number(t);
          if (!Number.isNaN(v)) onPatch({ duration_sec: v });
        }
      }, DEBOUNCE_MS);
    },
    [clearDurationTimer, completed, onPatch]
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
                    clearWeightTimer();
                    const kg = set.weight_kg ?? 0;
                    const step = units === 'imperial' ? lbToKg(2.5) : 2.5;
                    const next = Math.max(0.5, kg - step);
                    onPatch({ weight_kg: next });
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
                    scheduleWeight(e.target.value);
                  }}
                  onBlur={() => flushWeight(weightDraft)}
                />
                <button
                  type="button"
                  className="btn btn--secondary btn--sm btn--touch"
                  disabled={completed}
                  aria-label="Increase weight"
                  onClick={() => {
                    clearWeightTimer();
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
                  clearRepsTimer();
                  const r = set.reps ?? 0;
                  onPatch({ reps: Math.max(0, r - 1) });
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
                  scheduleReps(e.target.value);
                }}
                onBlur={() => flushReps(repsDraft)}
              />
              <button
                type="button"
                className="btn btn--secondary btn--sm btn--touch"
                disabled={completed}
                onClick={() => {
                  clearRepsTimer();
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
                  clearRirTimer();
                  const r = set.rir ?? 0;
                  onPatch({ rir: Math.max(0, r - 1) });
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
                  scheduleRir(e.target.value);
                }}
                onBlur={() => flushRir(rirDraft)}
              />
              <button
                type="button"
                className="btn btn--secondary btn--sm btn--touch"
                disabled={completed}
                onClick={() => {
                  clearRirTimer();
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
              className="form-input workout-set-input"
              type="number"
              min={0}
              disabled={completed}
              value={durationDraft}
              onChange={(e) => {
                setDurationDraft(e.target.value);
                scheduleDuration(e.target.value);
              }}
              onBlur={() => flushDuration(durationDraft)}
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
