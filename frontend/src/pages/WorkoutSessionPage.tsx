import { useState, useEffect, useCallback, useRef } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import type { UnitsPreference, WorkoutDetailResponse, ProgressionVariant } from '../types/api';
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

const FAVORITES_ONLY_PICKER_KEY = 'workout-exercise-picker-favorites-only';

function humanizeVariant(v: string): string {
  return v
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function ProgramExerciseNotes({ text, fromProgram }: { text: string; fromProgram: boolean }) {
  const [expanded, setExpanded] = useState(false);
  if (!fromProgram) {
    return <p className="progress-text workout-session__ex-notes">{text}</p>;
  }
  const needsToggle = text.length > 140 || text.includes('\n');
  return (
    <div className="workout-session__ex-notes-block">
      <p
        className={
          expanded || !needsToggle
            ? 'progress-text workout-session__ex-notes'
            : 'progress-text workout-session__ex-notes workout-session__ex-notes--clamp'
        }
      >
        {text}
      </p>
      {needsToggle && (
        <button type="button" className="workout-session__notes-toggle btn btn--secondary btn--sm" onClick={() => setExpanded((e) => !e)}>
          {expanded ? 'Show less' : 'Show more'}
        </button>
      )}
    </div>
  );
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
  const [removeConfirmLineId, setRemoveConfirmLineId] = useState<string | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const prevPickerOpenRef = useRef(false);

  const refreshInsights = useCallback(
    async (w: WorkoutDetailResponse, unitsForDisplay: UnitsPreference) => {
      const lines = w.exercises;
      if (lines.length === 0) {
        setInsights({});
        return;
      }
      const next: InsightsState = {};
      try {
        const res = await postBatchExerciseInsights(userId, {
          exercise_ids: lines.map((l) => l.exercise_id),
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
            variant: ins.progression_variant as ProgressionVariant,
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

  useEffect(() => {
    try {
      const v = localStorage.getItem(FAVORITES_ONLY_PICKER_KEY);
      if (v === '1') setFavoritesOnlyPicker(true);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(FAVORITES_ONLY_PICKER_KEY, favoritesOnlyPicker ? '1' : '0');
    } catch {
      /* ignore */
    }
  }, [favoritesOnlyPicker]);

  useEffect(() => {
    if (pickerOpen && !prevPickerOpenRef.current) {
      requestAnimationFrame(() => searchInputRef.current?.focus());
    }
    prevPickerOpenRef.current = pickerOpen;
  }, [pickerOpen]);

  const completed = workout?.completed_at != null;
  const fromProgram = Boolean(workout?.program_day_id);
  const lines = workout?.exercises ?? [];

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
        onFinish={() => void handleComplete()}
        onRepeat={() => void handleRepeat()}
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
                ref={searchInputRef}
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
          Program session: work through the list in order. Targets show the plan; enter load, reps, and RIR for each set.
        </p>
      )}

      {lines.map((line) => (
        <section key={line.id} className="app__card">
          <div className="workout-session__ex-header">
            <h3 className="app__card-title workout-session__ex-title">{line.exercise.name}</h3>
            <span className="workout-kind-badge">{exerciseKindLabel(line.exercise.kind)}</span>
            {!completed && !fromProgram && (
              <div className="workout-session__remove-wrap">
                {removeConfirmLineId === line.id ? (
                  <>
                    <button
                      type="button"
                      className="btn btn--secondary btn--sm btn--touch workout-session__remove-ex"
                      onClick={async () => {
                        if (!workoutId) return;
                        try {
                          await deleteWorkoutExercise(userId, workoutId, line.id);
                          setRemoveConfirmLineId(null);
                          await loadWorkout();
                        } catch (err) {
                          onError?.(err instanceof Error ? err.message : 'Remove failed');
                        }
                      }}
                    >
                      Confirm remove
                    </button>
                    <button
                      type="button"
                      className="btn btn--secondary btn--sm btn--touch"
                      onClick={() => setRemoveConfirmLineId(null)}
                    >
                      Cancel
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    className="btn btn--secondary btn--sm btn--touch workout-session__remove-ex"
                    onClick={() => setRemoveConfirmLineId(line.id)}
                  >
                    Remove
                  </button>
                )}
              </div>
            )}
          </div>
          {line.notes != null && line.notes.trim() !== '' && (
            <ProgramExerciseNotes text={line.notes} fromProgram={fromProgram} />
          )}
          {insights[line.id] && (
            <div className="progress-text workout-session__insight">
              <p className="workout-session__insight-last">
                <strong>Last time:</strong> {insights[line.id]!.last}
              </p>
              {(insights[line.id]!.suggestion || (insights[line.id]?.variant != null && insights[line.id]!.variant !== '')) && (
                <details className="workout-session__insight-details">
                  <summary className="workout-session__insight-more">More</summary>
                  {insights[line.id]?.variant != null && insights[line.id]!.variant !== '' && (
                    <p className="workout-session__insight-extra">
                      <strong>Progression:</strong> {humanizeVariant(insights[line.id]!.variant!)}
                    </p>
                  )}
                  {insights[line.id]!.suggestion ? (
                    <p className="workout-session__insight-extra">
                      <strong>Suggestion:</strong> {insights[line.id]!.suggestion}
                    </p>
                  ) : null}
                </details>
              )}
            </div>
          )}
          <div className="workout-sets">
            {line.sets.map((set) => {
              const allowDelete = !completed && !fromProgram && line.sets.length > 1;
              const deleteHandler = allowDelete
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
                  canDeleteSet={allowDelete}
                  hideSetNote={fromProgram}
                  {...(deleteHandler ? { onDelete: deleteHandler } : {})}
                />
              );
            })}
            {!completed && !fromProgram && (
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
