import { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import type { UnitsPreference, WorkoutDetailResponse, WorkoutExerciseNested, ProgressionVariant } from '../types/api';
import {
  getUser,
  getWorkout,
  patchWorkout,
  addWorkoutExercise,
  patchWorkoutSet,
  addWorkoutSet,
  deleteWorkoutSet,
  deleteWorkoutExercise,
  listExercises,
  createWorkout,
  postBatchExerciseInsights,
  addExerciseFavorite,
  removeExerciseFavorite,
  getWorkoutProgram,
} from '../api/client';
import { formatWeight, kgToLb, lbToKg } from '../utils/units';
import RestTimer from '../components/workouts/RestTimer';
import WorkoutSessionChrome from '../components/workouts/WorkoutSessionChrome';
import WorkoutSetRow from '../components/workouts/WorkoutSetRow';
import PageLoading from '../components/PageLoading';
import ExerciseCreateInline, { exerciseKindLabel } from '../components/exercises/ExerciseCreateInline';

interface WorkoutSessionPageProps {
  userId: string;
  onError?: (message: string | null) => void;
  onSuccess?: (message: string | null) => void;
}

type InsightsState = Record<
  string,
  { last: string; suggestion: string; variant?: string } | undefined
>;

function stepStorageKey(workoutId: string): string {
  return `workout:${workoutId}:step`;
}

export default function WorkoutSessionPage({ userId, onError, onSuccess }: WorkoutSessionPageProps) {
  const { workoutId } = useParams<{ workoutId: string }>();
  const navigate = useNavigate();
  const [units, setUnits] = useState<UnitsPreference>('metric');
  const [workout, setWorkout] = useState<WorkoutDetailResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [exerciseHits, setExerciseHits] = useState<Awaited<ReturnType<typeof listExercises>>>([]);
  const [insights, setInsights] = useState<InsightsState>({});
  const [restSeconds, setRestSeconds] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [favoritesOnlyPicker, setFavoritesOnlyPicker] = useState(false);
  const [activeExerciseIndex, setActiveExerciseIndex] = useState(0);

  const refreshInsights = useCallback(
    async (w: WorkoutDetailResponse, unitsForDisplay: UnitsPreference) => {
      const lines = w.exercises;
      if (lines.length === 0) {
        setInsights({});
        return;
      }
      let variantMap: Record<string, ProgressionVariant> | undefined;
      if (w.program_id && w.program_day_id) {
        try {
          const p = await getWorkoutProgram(userId, w.program_id);
          const day = p.days.find((d) => d.id === w.program_day_id);
          if (day) {
            variantMap = {};
            for (const e of day.exercises) {
              variantMap[e.exercise_id] = e.progression_variant as ProgressionVariant;
            }
          }
        } catch {
          variantMap = undefined;
        }
      }
      const next: InsightsState = {};
      try {
        const res = await postBatchExerciseInsights(userId, {
          exercise_ids: lines.map((l) => l.exercise_id),
          ...(variantMap && Object.keys(variantMap).length > 0
            ? { progression_variant_by_exercise_id: variantMap }
            : {}),
        });
        for (const line of lines) {
          const ins = res.insights[line.exercise_id];
          if (!ins) {
            next[line.id] = { last: '—', suggestion: '' };
            continue;
          }
          const lp = ins.last_performance;
          const lastStr = lp
            ? lp.sets
                .map((s) => {
                  const parts: string[] = [];
                  if (s.weight_kg != null) parts.push(formatWeight(s.weight_kg, unitsForDisplay));
                  if (s.reps != null) parts.push(`×${s.reps}`);
                  if (s.duration_sec != null) parts.push(`${s.duration_sec}s`);
                  if (s.rir != null) parts.push(`RIR${s.rir}`);
                  return parts.join(' ');
                })
                .filter(Boolean)
                .join(' · ')
            : '—';
          next[line.id] = {
            last: lastStr || '—',
            suggestion: ins.suggestion.hint,
            variant: ins.progression_variant,
          };
        }
        setInsights(next);
      } catch {
        for (const line of lines) {
          next[line.id] = { last: '—', suggestion: '' };
        }
        setInsights(next);
      }
    },
    [userId]
  );

  const loadWorkout = useCallback(async () => {
    if (!workoutId) return;
    const w = await getWorkout(userId, workoutId);
    setWorkout(w);
    await refreshInsights(w, units);
  }, [userId, workoutId, refreshInsights, units]);

  useEffect(() => {
    if (!workoutId) return;
    let cancelled = false;
    setLoading(true);
    Promise.all([getUser(userId), getWorkout(userId, workoutId)])
      .then(([u, w]) => {
        if (cancelled) return;
        setUnits(u.units);
        setWorkout(w);
        void refreshInsights(w, u.units);
        if (w.program_day_id) {
          const raw = sessionStorage.getItem(stepStorageKey(workoutId));
          if (raw != null) {
            const n = parseInt(raw, 10);
            if (!Number.isNaN(n) && w.exercises.length > 0) {
              setActiveExerciseIndex(Math.min(Math.max(0, n), w.exercises.length - 1));
            }
          } else {
            setActiveExerciseIndex(0);
          }
        }
      })
      .catch((e) => {
        if (!cancelled) onError?.(e instanceof Error ? e.message : 'Failed to load workout');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [userId, workoutId, onError, refreshInsights]);

  useEffect(() => {
    if (!workoutId || !workout?.program_day_id) return;
    sessionStorage.setItem(stepStorageKey(workoutId), String(activeExerciseIndex));
  }, [workoutId, workout?.program_day_id, activeExerciseIndex]);

  useEffect(() => {
    if (!workout) return;
    setActiveExerciseIndex((i) => {
      if (workout.exercises.length === 0) return 0;
      return Math.min(i, workout.exercises.length - 1);
    });
  }, [workout?.exercises.length, workout]);

  useEffect(() => {
    if (!pickerOpen) return;
    let cancelled = false;
    listExercises(userId, {
      ...(search.trim() ? { q: search.trim() } : {}),
      ...(favoritesOnlyPicker ? { favorites_only: true } : {}),
    })
      .then((list) => {
        if (!cancelled) setExerciseHits(list);
      })
      .catch(() => {
        if (!cancelled) setExerciseHits([]);
      });
    return () => {
      cancelled = true;
    };
  }, [pickerOpen, search, userId, favoritesOnlyPicker]);

  const completed = workout?.completed_at != null;
  const fromProgram = Boolean(workout?.program_day_id);
  const guided = fromProgram && !completed;
  const visibleLines: WorkoutExerciseNested[] =
    guided && workout && workout.exercises.length > 0
      ? [workout.exercises[activeExerciseIndex]!]
      : workout?.exercises ?? [];

  const handleNotesBlur = async (notes: string) => {
    if (!workoutId || !workout || completed) return;
    try {
      await patchWorkout(userId, workoutId, { notes: notes.trim() || null });
      onError?.(null);
    } catch (e) {
      onError?.(e instanceof Error ? e.message : 'Failed to save notes');
    }
  };

  const handleComplete = async () => {
    if (!workoutId || completed) return;
    setSaving(true);
    try {
      const w = await patchWorkout(userId, workoutId, { completed_at: new Date().toISOString() });
      setWorkout(w);
      onSuccess?.('Workout saved.');
      onError?.(null);
    } catch (e) {
      onError?.(e instanceof Error ? e.message : 'Failed to complete');
    } finally {
      setSaving(false);
    }
  };

  const handleRepeat = async () => {
    if (!workoutId) return;
    setSaving(true);
    try {
      const w = await createWorkout(userId, { clone_from_workout_id: workoutId });
      navigate(`/workouts/${w.id}`, { replace: true });
      onSuccess?.('Started from last workout.');
    } catch (e) {
      onError?.(e instanceof Error ? e.message : 'Failed to clone');
    } finally {
      setSaving(false);
    }
  };

  const addExercise = async (exerciseId: string) => {
    if (!workoutId || completed) return;
    try {
      await addWorkoutExercise(userId, workoutId, { exercise_id: exerciseId });
      await loadWorkout();
      setPickerOpen(false);
      setSearch('');
      onError?.(null);
    } catch (e) {
      onError?.(e instanceof Error ? e.message : 'Failed to add exercise');
    }
  };

  const patchSetField = async (
    lineId: string,
    setId: string,
    patch: Parameters<typeof patchWorkoutSet>[4]
  ) => {
    if (!workoutId || completed) return;
    try {
      const updated = await patchWorkoutSet(userId, workoutId, lineId, setId, patch);
      setWorkout((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          exercises: prev.exercises.map((line) =>
            line.id !== lineId
              ? line
              : {
                  ...line,
                  sets: line.sets.map((s) => (s.id === setId ? { ...s, ...updated } : s)),
                }
          ),
        };
      });
      onError?.(null);
    } catch (err) {
      onError?.(err instanceof Error ? err.message : 'Failed to update set');
    }
  };

  const displayWeight = (kg: number | null): string => {
    if (kg == null) return '';
    if (units === 'imperial') return String(Math.round(kgToLb(kg) * 10) / 10);
    return String(Math.round(kg * 10) / 10);
  };

  const parseWeightInput = (s: string): number | null => {
    const n = Number(s);
    if (Number.isNaN(n) || n <= 0) return null;
    return units === 'imperial' ? lbToKg(n) : n;
  };

  if (!workoutId) {
    return <p className="progress-text">Missing workout.</p>;
  }

  if (loading) {
    return <PageLoading />;
  }

  if (!workout) {
    return (
      <p className="progress-text">
        <Link to="/workouts">← Workouts</Link>
        {' · '}Could not load this workout.
      </p>
    );
  }

  const exCount = workout.exercises.length;

  return (
    <div className="workout-session">
      <p className="workout-session__back progress-text">
        <Link to="/workouts">← Workouts</Link>
      </p>

      {restSeconds != null && (
        <RestTimer
          seconds={restSeconds}
          onDone={() => setRestSeconds(null)}
          onDismiss={() => setRestSeconds(null)}
        />
      )}

      <WorkoutSessionChrome
        workoutName={workout.name || 'Workout'}
        completed={completed}
        saving={saving}
        guided={guided}
        exerciseIndex={activeExerciseIndex}
        exerciseCount={exCount}
        onFinish={() => void handleComplete()}
        onRepeat={() => void handleRepeat()}
        onPrev={() => setActiveExerciseIndex((i) => Math.max(0, i - 1))}
        onNext={() => setActiveExerciseIndex((i) => Math.min(exCount - 1, i + 1))}
      />

      <section className="app__card workout-session__meta-card">
        {workout.training_week_index != null && (
          <p className="progress-text workout-session__week-hint">
            Block week {workout.training_week_index}
            {workout.is_deload_week ? ' · Deload' : ''}
          </p>
        )}
        <label className="form-label" htmlFor="workout-notes">
          Workout notes
        </label>
        <textarea
          id="workout-notes"
          className="form-input"
          rows={2}
          disabled={completed}
          defaultValue={workout.notes ?? ''}
          onBlur={(e) => void handleNotesBlur(e.target.value)}
          placeholder="Optional session notes"
        />
        <p className="progress-text workout-session__started">
          Started {new Date(workout.started_at).toLocaleString()}
          {completed && ` · Completed ${new Date(workout.completed_at!).toLocaleString()}`}
        </p>
      </section>

      {!completed && !fromProgram && (
        <section className="app__card">
          <h3 className="app__card-title">Add exercise</h3>
          <button type="button" className="btn btn--secondary" onClick={() => setPickerOpen(!pickerOpen)}>
            {pickerOpen ? 'Close picker' : 'Browse exercises'}
          </button>
          {pickerOpen && (
            <div className="workout-session__picker">
              <label className="form-label workout-session__fav-toggle">
                <input
                  type="checkbox"
                  checked={favoritesOnlyPicker}
                  onChange={(e) => setFavoritesOnlyPicker(e.target.checked)}
                />
                Favorites only
              </label>
              <input
                type="search"
                className="form-input workout-session__search"
                placeholder="Search…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                aria-label="Search exercises"
              />
              <ul className="workout-exercise-list workout-session__ex-list">
                {exerciseHits.map((ex) => (
                  <li key={ex.id} className="workout-exercise-list__item">
                    <button type="button" className="workout-exercise-list__pick" onClick={() => void addExercise(ex.id)}>
                      <span>{ex.name}</span>
                      <span className="workout-exercise-list__meta">{exerciseKindLabel(ex.kind)}</span>
                    </button>
                    <button
                      type="button"
                      className="btn btn--secondary btn--sm btn--touch"
                      aria-label={ex.is_favorite ? 'Remove favorite' : 'Add favorite'}
                      onClick={async () => {
                        try {
                          if (ex.is_favorite) await removeExerciseFavorite(userId, ex.id);
                          else await addExerciseFavorite(userId, ex.id);
                          const list = await listExercises(userId, {
                            ...(search.trim() ? { q: search.trim() } : {}),
                            ...(favoritesOnlyPicker ? { favorites_only: true } : {}),
                          });
                          setExerciseHits(list);
                        } catch (err) {
                          onError?.(err instanceof Error ? err.message : 'Favorite failed');
                        }
                      }}
                    >
                      {ex.is_favorite ? '★' : '☆'}
                    </button>
                  </li>
                ))}
              </ul>
              <ExerciseCreateInline
                userId={userId}
                onCreated={(ex) => void addExercise(ex.id)}
                {...(onError != null ? { onError } : {})}
                submitLabel="Create & add"
                className="workout-session__new-ex"
              />
            </div>
          )}
        </section>
      )}

      {fromProgram && !completed && (
        <p className="progress-text workout-session__program-hint">
          Program day: step through exercises with Prev / Next. Add exercise is disabled for this session.
        </p>
      )}

      {visibleLines.map((line) => (
        <section key={line.id} className="app__card">
          <div className="workout-session__ex-header">
            <h3 className="app__card-title workout-session__ex-title">{line.exercise.name}</h3>
            <span className="workout-kind-badge">{exerciseKindLabel(line.exercise.kind)}</span>
            {!completed && !fromProgram && (
              <button
                type="button"
                className="btn btn--secondary btn--sm btn--touch workout-session__remove-ex"
                onClick={async () => {
                  if (!workoutId) return;
                  if (!window.confirm('Remove this exercise from the workout?')) return;
                  try {
                    await deleteWorkoutExercise(userId, workoutId, line.id);
                    await loadWorkout();
                  } catch (err) {
                    onError?.(err instanceof Error ? err.message : 'Remove failed');
                  }
                }}
              >
                Remove
              </button>
            )}
          </div>
          {insights[line.id] && (
            <p className="progress-text workout-session__insight">
              <strong>Last time:</strong> {insights[line.id]!.last}
              {insights[line.id]?.variant != null && insights[line.id]!.variant !== '' && (
                <>
                  <br />
                  <strong>Progression:</strong> {insights[line.id]!.variant!.replace(/_/g, ' ')}
                </>
              )}
              {insights[line.id]!.suggestion && (
                <>
                  <br />
                  <strong>Suggestion:</strong> {insights[line.id]!.suggestion}
                </>
              )}
            </p>
          )}
          <div className="workout-sets">
            {line.sets.map((set) => {
              const deleteHandler =
                !completed && line.sets.length > 1
                  ? () => {
                      void (async () => {
                        if (!workoutId) return;
                        try {
                          await deleteWorkoutSet(userId, workoutId, line.id, set.id);
                          await loadWorkout();
                        } catch (err) {
                          onError?.(err instanceof Error ? err.message : 'Delete set failed');
                        }
                      })();
                    }
                  : undefined;
              return (
                <WorkoutSetRow
                  key={set.id}
                  line={line}
                  set={{
                    ...set,
                    rir: set.rir ?? null,
                    set_role: set.set_role ?? null,
                    target_reps_min: set.target_reps_min ?? null,
                    target_reps_max: set.target_reps_max ?? null,
                    target_rir_min: set.target_rir_min ?? null,
                    target_rir_max: set.target_rir_max ?? null,
                    calibration_to_failure: set.calibration_to_failure ?? false,
                  }}
                  units={units}
                  completed={completed}
                  displayWeight={displayWeight}
                  parseWeightInput={parseWeightInput}
                  onPatch={(patch) => void patchSetField(line.id, set.id, patch)}
                  onRest={(sec) => setRestSeconds(sec)}
                  canDeleteSet={line.sets.length > 1}
                  {...(deleteHandler ? { onDelete: deleteHandler } : {})}
                />
              );
            })}
            {!completed && (
              <button
                type="button"
                className="btn btn--secondary btn--sm workout-session__add-set"
                onClick={async () => {
                  if (!workoutId) return;
                  try {
                    await addWorkoutSet(userId, workoutId, line.id, {});
                    await loadWorkout();
                  } catch (err) {
                    onError?.(err instanceof Error ? err.message : 'Add set failed');
                  }
                }}
              >
                + Add set
              </button>
            )}
          </div>
        </section>
      ))}

      {workout.exercises.length === 0 && (
        <p className="progress-text">No exercises yet. Add one to start logging sets.</p>
      )}
    </div>
  );
}
