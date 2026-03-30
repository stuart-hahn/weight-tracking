import { useState, useEffect, useCallback, FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import type { UnitsPreference, WorkoutDetailResponse, WorkoutExerciseNested } from '../types/api';
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
  createExercise,
  getExerciseInsights,
  addExerciseFavorite,
  removeExerciseFavorite,
} from '../api/client';
import { formatWeight, kgToLb, lbToKg } from '../utils/units';
import RestTimer from '../components/workouts/RestTimer';
import PageLoading from '../components/PageLoading';

interface WorkoutSessionPageProps {
  userId: string;
  onError?: (message: string | null) => void;
  onSuccess?: (message: string | null) => void;
}

type InsightsState = Record<
  string,
  { last: string; suggestion: string } | undefined
>;

function kindLabel(kind: string): string {
  if (kind === 'weight_reps') return 'Weight × reps';
  if (kind === 'bodyweight_reps') return 'Reps';
  return 'Time';
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
  const [newExerciseName, setNewExerciseName] = useState('');
  const [insights, setInsights] = useState<InsightsState>({});
  const [restSeconds, setRestSeconds] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [favoritesOnlyPicker, setFavoritesOnlyPicker] = useState(false);

  const refreshInsights = useCallback(
    async (lines: WorkoutExerciseNested[], unitsForDisplay: UnitsPreference = units) => {
      if (lines.length === 0) {
        setInsights({});
        return;
      }
      const next: InsightsState = {};
      await Promise.all(
        lines.map(async (line) => {
          try {
            const ins = await getExerciseInsights(userId, line.exercise_id);
            const lp = ins.last_performance;
            const lastStr = lp
              ? lp.sets
                  .map((s) => {
                    const parts: string[] = [];
                    if (s.weight_kg != null) parts.push(formatWeight(s.weight_kg, unitsForDisplay));
                    if (s.reps != null) parts.push(`×${s.reps}`);
                    if (s.duration_sec != null) parts.push(`${s.duration_sec}s`);
                    return parts.join(' ');
                  })
                  .filter(Boolean)
                  .join(' · ')
              : '—';
            next[line.id] = {
              last: lastStr || '—',
              suggestion: ins.suggestion.hint,
            };
          } catch {
            next[line.id] = { last: '—', suggestion: '' };
          }
        })
      );
      setInsights(next);
    },
    [userId, units]
  );

  const loadWorkout = useCallback(async () => {
    if (!workoutId) return;
    const w = await getWorkout(userId, workoutId);
    setWorkout(w);
    await refreshInsights(w.exercises);
  }, [userId, workoutId, refreshInsights]);

  useEffect(() => {
    if (!workoutId) return;
    let cancelled = false;
    setLoading(true);
    Promise.all([getUser(userId), getWorkout(userId, workoutId)])
      .then(([u, w]) => {
        if (cancelled) return;
        setUnits(u.units);
        setWorkout(w);
        void refreshInsights(w.exercises, u.units);
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

  const handleCreateCustom = async (e: FormEvent) => {
    e.preventDefault();
    const name = newExerciseName.trim();
    if (!name || !workoutId || completed) return;
    try {
      const ex = await createExercise(userId, { name, kind: 'weight_reps' });
      setNewExerciseName('');
      await addExercise(ex.id);
    } catch (err) {
      onError?.(err instanceof Error ? err.message : 'Failed to create exercise');
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

  return (
    <div className="workout-session">
      <p className="progress-text" style={{ marginBottom: '1rem' }}>
        <Link to="/workouts">← Workouts</Link>
      </p>

      {restSeconds != null && (
        <RestTimer
          seconds={restSeconds}
          onDone={() => setRestSeconds(null)}
          onDismiss={() => setRestSeconds(null)}
        />
      )}

      <section className="app__card">
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', alignItems: 'center', marginBottom: '1rem' }}>
          <h2 className="app__card-title" style={{ margin: 0, flex: '1 1 auto' }}>
            {workout.name || 'Workout'}
          </h2>
          {completed ? (
            <button type="button" className="btn btn--primary" disabled={saving} onClick={() => void handleRepeat()}>
              Repeat workout
            </button>
          ) : (
            <button type="button" className="btn btn--primary" disabled={saving} onClick={() => void handleComplete()}>
              {saving ? 'Saving…' : 'Finish workout'}
            </button>
          )}
        </div>
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
        <p className="progress-text" style={{ marginTop: '0.5rem', fontSize: '0.85rem' }}>
          Started {new Date(workout.started_at).toLocaleString()}
          {completed && ` · Completed ${new Date(workout.completed_at!).toLocaleString()}`}
        </p>
      </section>

      {!completed && (
        <section className="app__card">
          <h3 className="app__card-title">Add exercise</h3>
          <button type="button" className="btn btn--secondary" onClick={() => setPickerOpen(!pickerOpen)}>
            {pickerOpen ? 'Close picker' : 'Browse exercises'}
          </button>
          {pickerOpen && (
            <div style={{ marginTop: '1rem' }}>
              <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.5rem' }}>
                <input
                  type="checkbox"
                  checked={favoritesOnlyPicker}
                  onChange={(e) => setFavoritesOnlyPicker(e.target.checked)}
                />
                Favorites only
              </label>
              <input
                type="search"
                className="form-input"
                style={{ marginTop: '0.5rem' }}
                placeholder="Search…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                aria-label="Search exercises"
              />
              <ul className="workout-exercise-list" style={{ marginTop: '0.75rem', listStyle: 'none', padding: 0 }}>
                {exerciseHits.map((ex) => (
                  <li key={ex.id} className="workout-exercise-list__item">
                    <button type="button" className="workout-exercise-list__pick" onClick={() => void addExercise(ex.id)}>
                      <span>{ex.name}</span>
                      <span className="workout-exercise-list__meta">{kindLabel(ex.kind)}</span>
                    </button>
                    <button
                      type="button"
                      className="btn btn--secondary btn--sm"
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
              <form onSubmit={handleCreateCustom} style={{ marginTop: '1rem' }}>
                <label className="form-label" htmlFor="new-ex-name">
                  New custom exercise
                </label>
                <div className="workout-inline">
                  <input
                    id="new-ex-name"
                    className="form-input"
                    value={newExerciseName}
                    onChange={(e) => setNewExerciseName(e.target.value)}
                    placeholder="e.g. Landmine press"
                  />
                  <button type="submit" className="btn btn--secondary">
                    Create & add
                  </button>
                </div>
              </form>
            </div>
          )}
        </section>
      )}

      {workout.exercises.map((line) => (
        <section key={line.id} className="app__card">
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', alignItems: 'baseline' }}>
            <h3 className="app__card-title" style={{ margin: 0 }}>
              {line.exercise.name}
            </h3>
            <span className="workout-kind-badge">{kindLabel(line.exercise.kind)}</span>
            {!completed && (
              <button
                type="button"
                className="btn btn--secondary btn--sm"
                style={{ marginLeft: 'auto' }}
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
            <p className="progress-text" style={{ marginTop: '0.5rem', fontSize: '0.9rem' }}>
              <strong>Last time:</strong> {insights[line.id]!.last}
              {insights[line.id]!.suggestion && (
                <>
                  <br />
                  <strong>Suggestion:</strong> {insights[line.id]!.suggestion}
                </>
              )}
            </p>
          )}
          <div className="workout-sets" style={{ marginTop: '0.75rem' }}>
            {line.sets.map((set) => (
              <div key={set.id} className="workout-set-row">
                {line.exercise.kind !== 'time' && (
                  <div className="form-group" style={{ marginBottom: 0, minWidth: '5rem', flex: '1 1 6rem' }}>
                    <label className="form-label" style={{ fontSize: '0.75rem' }}>
                      {line.exercise.kind === 'bodyweight_reps' ? '—' : units === 'imperial' ? 'lb' : 'kg'}
                    </label>
                    {line.exercise.kind !== 'bodyweight_reps' && (
                      <div className="workout-stepper">
                        <button
                          type="button"
                          className="btn btn--secondary btn--sm"
                          disabled={completed}
                          aria-label="Decrease weight"
                          onClick={() => {
                            const kg = set.weight_kg ?? 0;
                            const step = units === 'imperial' ? lbToKg(2.5) : 2.5;
                            const next = Math.max(0.5, kg - step);
                            void patchSetField(line.id, set.id, { weight_kg: next });
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
                              void patchSetField(line.id, set.id, { weight_kg: null });
                              return;
                            }
                            const kg = parseWeightInput(raw);
                            if (kg != null) void patchSetField(line.id, set.id, { weight_kg: kg });
                          }}
                        />
                        <button
                          type="button"
                          className="btn btn--secondary btn--sm"
                          disabled={completed}
                          aria-label="Increase weight"
                          onClick={() => {
                            const kg = set.weight_kg ?? (units === 'imperial' ? lbToKg(45) : 20);
                            const step = units === 'imperial' ? lbToKg(2.5) : 2.5;
                            void patchSetField(line.id, set.id, { weight_kg: Math.min(500, kg + step) });
                          }}
                        >
                          +
                        </button>
                      </div>
                    )}
                  </div>
                )}
                {line.exercise.kind !== 'time' && (
                  <div className="form-group" style={{ marginBottom: 0, minWidth: '4rem', flex: '1 1 4rem' }}>
                    <label className="form-label" style={{ fontSize: '0.75rem' }}>
                      Reps
                    </label>
                    <div className="workout-stepper">
                      <button
                        type="button"
                        className="btn btn--secondary btn--sm"
                        disabled={completed}
                        onClick={() => {
                          const r = set.reps ?? 0;
                          void patchSetField(line.id, set.id, { reps: Math.max(0, r - 1) });
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
                            void patchSetField(line.id, set.id, { reps: null });
                            return;
                          }
                          const v = Number(raw);
                          if (!Number.isNaN(v)) void patchSetField(line.id, set.id, { reps: v });
                        }}
                      />
                      <button
                        type="button"
                        className="btn btn--secondary btn--sm"
                        disabled={completed}
                        onClick={() => {
                          const r = set.reps ?? 0;
                          void patchSetField(line.id, set.id, { reps: r + 1 });
                        }}
                      >
                        +
                      </button>
                    </div>
                  </div>
                )}
                {line.exercise.kind === 'time' && (
                  <div className="form-group" style={{ marginBottom: 0, minWidth: '5rem' }}>
                    <label className="form-label" style={{ fontSize: '0.75rem' }}>
                      Sec
                    </label>
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
                          void patchSetField(line.id, set.id, { duration_sec: null });
                          return;
                        }
                        const v = Number(raw);
                        if (!Number.isNaN(v)) void patchSetField(line.id, set.id, { duration_sec: v });
                      }}
                    />
                  </div>
                )}
                <div className="form-group" style={{ marginBottom: 0, flex: '2 1 8rem' }}>
                  <label className="form-label" style={{ fontSize: '0.75rem' }}>
                    Set note
                  </label>
                  <input
                    key={`n-${set.id}-${set.notes ?? ''}`}
                    className="form-input"
                    disabled={completed}
                    defaultValue={set.notes ?? ''}
                    onBlur={(e) => void patchSetField(line.id, set.id, { notes: e.target.value.trim() || null })}
                  />
                </div>
                {!completed && (
                  <div className="workout-set-actions">
                    <button
                      type="button"
                      className="btn btn--secondary btn--sm"
                      onClick={() => {
                        const sec = set.rest_seconds_after ?? line.default_rest_seconds ?? 90;
                        setRestSeconds(Math.min(3600, Math.max(5, sec)));
                      }}
                    >
                      Rest
                    </button>
                    {line.sets.length > 1 && (
                      <button
                        type="button"
                        className="btn btn--secondary btn--sm"
                        onClick={async () => {
                          if (!workoutId) return;
                          try {
                            await deleteWorkoutSet(userId, workoutId, line.id, set.id);
                            await loadWorkout();
                          } catch (err) {
                            onError?.(err instanceof Error ? err.message : 'Delete set failed');
                          }
                        }}
                      >
                        ✕
                      </button>
                    )}
                  </div>
                )}
              </div>
            ))}
            {!completed && (
              <button
                type="button"
                className="btn btn--secondary btn--sm"
                style={{ marginTop: '0.5rem' }}
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
