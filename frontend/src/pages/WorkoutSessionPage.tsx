import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  UnitsPreference,
  WorkoutDetailResponse,
  ProgressionVariant,
  WorkoutExerciseNested,
  WorkoutSetResponse,
  PatchWorkoutSetRequest,
} from '../types/api';
import {
  getUser,
  getWorkout,
  patchWorkout,
  addWorkoutExercise,
  patchWorkoutExercise,
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
import { queryKeys } from '../api/queryKeys';
import { formatWeight, kgToLb, lbToKg } from '../utils/units';
import RestTimer from '../components/workouts/RestTimer';
import WorkoutSessionChrome from '../components/workouts/WorkoutSessionChrome';
import PageLoading from '../components/PageLoading';
import Page from '../components/layout/Page';
import PageHeader from '../components/layout/PageHeader';
import InlineStatusCard from '../components/ui/InlineStatusCard';
import WorkoutSessionNavCard from '../components/workouts/session/WorkoutSessionNavCard';
import WorkoutExercisePickerCard from '../components/workouts/session/WorkoutExercisePickerCard';
import WorkoutSessionMetaCard from '../components/workouts/session/WorkoutSessionMetaCard';
import WorkoutExerciseCard from '../components/workouts/session/WorkoutExerciseCard';

interface WorkoutSessionPageProps {
  userId: string;
  onError?: (message: string | null) => void;
  onSuccess?: (message: string | null) => void;
}

type InsightsState = Record<
  string,
  {
    last: string;
    suggestion: string;
    variant?: string;
    suggested_weight_kg?: number | null;
    suggested_reps?: number | null;
  } | undefined
>;

const FAVORITES_ONLY_PICKER_KEY = 'workout-exercise-picker-favorites-only';
const PICKER_SEARCH_DEBOUNCE_MS = 250;

function humanizeVariant(v: string): string {
  return v
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function isSetIncomplete(line: WorkoutExerciseNested, set: WorkoutSetResponse): boolean {
  if (set.completed_at != null) return false;
  const k = line.exercise.kind;
  if (k === 'time') return set.duration_sec == null || set.duration_sec <= 0;
  if (k === 'bodyweight_reps') return set.reps == null;
  if (k === 'weight_reps') {
    return set.weight_kg == null || set.weight_kg <= 0 || set.reps == null;
  }
  return false;
}

function countIncompleteSets(w: WorkoutDetailResponse): number {
  let n = 0;
  for (const line of w.exercises) {
    for (const set of line.sets) {
      if (isSetIncomplete(line, set)) n += 1;
    }
  }
  return n;
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
  const queryClient = useQueryClient();

  const [pickerOpen, setPickerOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [insights, setInsights] = useState<InsightsState>({});
  const [restSeconds, setRestSeconds] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [finishConfirmOpen, setFinishConfirmOpen] = useState(false);
  const [finishIncompleteCount, setFinishIncompleteCount] = useState(0);
  const [favoritesOnlyPicker, setFavoritesOnlyPicker] = useState(false);
  const [removeConfirmLineId, setRemoveConfirmLineId] = useState<string | null>(null);
  const [savingSetId, setSavingSetId] = useState<string | null>(null);
  const [setPatchErrors, setSetPatchErrors] = useState<Record<string, string>>({});
  const [focusMode, setFocusMode] = useState(true);
  const [focusExerciseIdx, setFocusExerciseIdx] = useState(0);
  const [focusRepsSetId, setFocusRepsSetId] = useState<string | null>(null);
  const swipeRef = useRef<{ x: number } | null>(null);
  const pagerRestoredForWorkoutRef = useRef<string | null>(null);

  const prevInsightsKeyRef = useRef<string>('');

  useEffect(() => {
    const id = window.setTimeout(() => setDebouncedSearch(search.trim()), PICKER_SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(id);
  }, [search]);

  const { data: userProfile } = useQuery({
    queryKey: queryKeys.user(userId),
    queryFn: () => getUser(userId),
  });
  const units: UnitsPreference = userProfile?.units ?? 'metric';

  const {
    data: workout,
    isLoading,
    isError,
  } = useQuery({
    queryKey: queryKeys.workout(userId, workoutId ?? ''),
    queryFn: () => getWorkout(userId, workoutId!),
    enabled: Boolean(workoutId),
  });

  const { data: exerciseHits = [], isFetching: pickerListFetching } = useQuery({
    queryKey: queryKeys.exercisesPicker(userId, debouncedSearch, favoritesOnlyPicker),
    queryFn: () =>
      listExercises(userId, {
        ...(debouncedSearch ? { q: debouncedSearch } : {}),
        ...(favoritesOnlyPicker ? { favorites_only: true } : {}),
      }),
    enabled: pickerOpen,
  });

  const lines = workout?.exercises ?? [];
  const completed = workout?.completed_at != null;
  const fromProgram = Boolean(workout?.program_day_id);

  useEffect(() => {
    if (!workout?.name) return;
    const prev = document.title;
    document.title = `${workout.name} — Workout`;
    return () => {
      document.title = prev;
    };
  }, [workout?.name]);
  const exerciseIdsFingerprint = useMemo(
    () => lines.map((e) => e.exercise_id).join('\0'),
    [lines]
  );
  const insightsKey = `${exerciseIdsFingerprint}|${units}`;

  const refreshInsights = useCallback(
    async (w: WorkoutDetailResponse, unitsForDisplay: UnitsPreference) => {
      const exLines = w.exercises;
      if (exLines.length === 0) {
        setInsights({});
        return;
      }
      const next: InsightsState = {};
      try {
        const res = await postBatchExerciseInsights(userId, {
          exercise_ids: exLines.map((l) => l.exercise_id),
        });
        for (const line of exLines) {
          const ins = res.insights[line.exercise_id];
          if (!ins) {
            next[line.id] = { last: '—', suggestion: '', suggested_reps: null };
            continue;
          }
          const lp = ins.last_performance;
          let lastStr = '—';
          if (lp && lp.sets.length > 0) {
            const weights = lp.sets.map((s) => s.weight_kg).filter((w): w is number => w != null && w > 0);
            const allSameW = weights.length > 0 && weights.every((w) => w === weights[0]);
            const repStrs = lp.sets.map((s) => (s.reps != null ? String(s.reps) : '—'));
            if (allSameW) {
              lastStr = `${formatWeight(weights[0]!, unitsForDisplay)} × ${repStrs.join(', ')}`;
            } else {
              lastStr = lp.sets
                .map((s) => {
                  const parts: string[] = [];
                  if (s.weight_kg != null) parts.push(formatWeight(s.weight_kg, unitsForDisplay));
                  if (s.reps != null) parts.push(`×${s.reps}`);
                  if (s.duration_sec != null) parts.push(`${s.duration_sec}s`);
                  if (s.rir != null) parts.push(`RIR${s.rir}`);
                  return parts.join(' ');
                })
                .filter(Boolean)
                .join(' · ');
            }
          }
          next[line.id] = {
            last: lastStr || '—',
            suggestion: ins.suggestion.hint,
            variant: ins.progression_variant as ProgressionVariant,
            suggested_weight_kg: ins.suggestion.suggested_weight_kg,
            suggested_reps: ins.suggestion.suggested_reps,
          };
        }
        setInsights(next);
      } catch {
        for (const line of exLines) {
          next[line.id] = { last: '—', suggestion: '', suggested_reps: null };
        }
        setInsights(next);
      }
    },
    [userId]
  );

  useEffect(() => {
    if (!workout || lines.length === 0) {
      setInsights({});
      prevInsightsKeyRef.current = '';
      return;
    }
    if (prevInsightsKeyRef.current === insightsKey) return;
    prevInsightsKeyRef.current = insightsKey;
    void refreshInsights(workout, units);
  }, [workout, lines.length, insightsKey, units, refreshInsights]);

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
    setFocusExerciseIdx((i) => {
      if (lines.length === 0) return 0;
      return Math.min(Math.max(0, i), lines.length - 1);
    });
  }, [lines.length]);

  useEffect(() => {
    pagerRestoredForWorkoutRef.current = null;
  }, [workoutId]);

  useEffect(() => {
    if (!workoutId || completed || lines.length === 0) return;
    if (pagerRestoredForWorkoutRef.current === workoutId) return;
    pagerRestoredForWorkoutRef.current = workoutId;
    try {
      const raw = sessionStorage.getItem(`workout-pager-idx:${workoutId}`);
      if (raw == null) return;
      const n = Number(raw);
      if (Number.isNaN(n)) return;
      setFocusExerciseIdx(Math.min(lines.length - 1, Math.max(0, n)));
    } catch {
      /* ignore */
    }
  }, [workoutId, completed, lines.length]);

  useEffect(() => {
    if (!workoutId || completed) return;
    try {
      sessionStorage.setItem(`workout-pager-idx:${workoutId}`, String(focusExerciseIdx));
    } catch {
      /* ignore */
    }
  }, [workoutId, completed, focusExerciseIdx]);

  const effectiveFocus = focusMode && !completed;

  const scrollToExercise = useCallback(
    (lineId: string) => {
      document.getElementById(`workout-ex-${lineId}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    },
    []
  );

  const jumpToExercise = useCallback(
    (lineId: string) => {
      const idx = lines.findIndex((l) => l.id === lineId);
      if (idx >= 0) setFocusExerciseIdx(idx);
      requestAnimationFrame(() => scrollToExercise(lineId));
    },
    [lines, scrollToExercise]
  );

  const scrollToNextIncomplete = useCallback(() => {
    if (!workout) return;
    for (const line of workout.exercises) {
      for (const set of line.sets) {
        if (isSetIncomplete(line, set)) {
          if (effectiveFocus) {
            const idx = lines.findIndex((l) => l.id === line.id);
            if (idx >= 0) setFocusExerciseIdx(idx);
          }
          scrollToExercise(line.id);
          return;
        }
      }
    }
  }, [workout, effectiveFocus, lines, scrollToExercise]);

  const invalidateWorkout = useCallback(() => {
    if (workoutId) {
      void queryClient.invalidateQueries({ queryKey: queryKeys.workout(userId, workoutId) });
    }
  }, [queryClient, userId, workoutId]);

  const handleNotesBlur = async (notes: string) => {
    if (!workoutId || !workout || completed) return;
    try {
      await patchWorkout(userId, workoutId, { notes: notes.trim() || null });
      queryClient.setQueryData<WorkoutDetailResponse>(queryKeys.workout(userId, workoutId), (prev) =>
        prev ? { ...prev, notes: notes.trim() || null } : prev
      );
      onError?.(null);
    } catch (e) {
      onError?.(e instanceof Error ? e.message : 'Failed to save notes');
    }
  };

  const handleComplete = async () => {
    if (!workoutId || !workout || completed) return;
    const inc = countIncompleteSets(workout);
    if (inc > 0) {
      setFinishIncompleteCount(inc);
      setFinishConfirmOpen(true);
      return;
    }
    await completeWorkout();
  };

  const completeWorkout = async () => {
    if (!workoutId || !workout || completed) return;
    setSaving(true);
    try {
      const w = await patchWorkout(userId, workoutId, { completed_at: new Date().toISOString() });
      queryClient.setQueryData(queryKeys.workout(userId, workoutId), w);
      void queryClient.invalidateQueries({ queryKey: queryKeys.workoutsHub(userId) });
      onSuccess?.('Workout saved.');
      onError?.(null);
    } catch (e) {
      onError?.(e instanceof Error ? e.message : 'Failed to complete');
    } finally {
      setSaving(false);
      setFinishConfirmOpen(false);
    }
  };

  const handleRepeat = async () => {
    if (!workoutId) return;
    setSaving(true);
    try {
      const w = await createWorkout(userId, { clone_from_workout_id: workoutId });
      void queryClient.invalidateQueries({ queryKey: queryKeys.workoutsHub(userId) });
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
      const line = await addWorkoutExercise(userId, workoutId, { exercise_id: exerciseId });
      queryClient.setQueryData<WorkoutDetailResponse>(queryKeys.workout(userId, workoutId), (prev) => {
        if (!prev) return prev;
        const next = [...prev.exercises, line].sort((a, b) => a.order_index - b.order_index);
        return { ...prev, exercises: next };
      });
      prevInsightsKeyRef.current = '';
    void queryClient.invalidateQueries({
      predicate: (q) => q.queryKey[0] === 'exercisesPicker' && q.queryKey[1] === userId,
    });
      setPickerOpen(false);
      setSearch('');
      setDebouncedSearch('');
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
    setSavingSetId(setId);
    setSetPatchErrors((prev) => {
      const next = { ...prev };
      delete next[setId];
      return next;
    });
    try {
      const updated = await patchWorkoutSet(userId, workoutId, lineId, setId, patch);
      queryClient.setQueryData<WorkoutDetailResponse>(queryKeys.workout(userId, workoutId), (prev) => {
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
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to update set';
      setSetPatchErrors((prev) => ({ ...prev, [setId]: msg }));
    } finally {
      setSavingSetId(null);
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

  const totalSets = useMemo(() => lines.reduce((n, line) => n + line.sets.length, 0), [lines]);
  const incompleteSets = useMemo(() => (workout ? countIncompleteSets(workout) : 0), [workout]);
  const chromeStatusLine =
    completed || !workout
      ? null
      : totalSets === 0
        ? 'No sets yet'
        : incompleteSets <= 0
          ? `${totalSets}/${totalSets} sets complete`
          : `${totalSets - incompleteSets}/${totalSets} sets complete`;

  if (!workoutId) {
    return <p className="progress-text">Missing workout.</p>;
  }

  if (isLoading) {
    return <PageLoading />;
  }

  if (isError || !workout) {
    return (
      <Page>
        <PageHeader title="Workout session" description={<>Couldn’t load this workout. Check your connection, then retry.</>} />
        <InlineStatusCard
          variant="error"
          title="Workout session"
          message="Could not load this workout."
          actionLabel="Retry"
          onAction={() => {
            if (!workoutId) return;
            void queryClient.invalidateQueries({ queryKey: queryKeys.workout(userId, workoutId) });
          }}
        />
        <p className="progress-text">
          <Link to="/workouts">← Back to Workouts</Link>
        </p>
      </Page>
    );
  }

  const showPickerEmpty =
    pickerOpen && !pickerListFetching && exerciseHits.length === 0;

  return (
    <div className="workout-session">
      <p className="workout-session__back progress-text">
        <Link to="/workouts">← Workouts</Link>
      </p>

      <div className="workout-session__sticky-stack">
        <WorkoutSessionChrome
          workoutName={workout.name || 'Workout'}
          statusLine={chromeStatusLine}
          completed={completed}
          saving={saving}
          onFinish={() => void handleComplete()}
          onRepeat={() => void handleRepeat()}
        />
        {restSeconds != null && (
          <RestTimer
            seconds={restSeconds}
            onDone={() => setRestSeconds(null)}
            onDismiss={() => setRestSeconds(null)}
          />
        )}
      </div>

      {!completed && finishConfirmOpen && (
        <section className="app__card workout-session__finish-confirm" role="dialog" aria-label="Finish workout confirmation">
          <h3 className="app__card-title">Finish workout?</h3>
          <p className="progress-text">
            {finishIncompleteCount} set(s) still missing required fields or not marked Done.
          </p>
          <div className="workout-start-actions">
            <button type="button" className="btn btn--secondary" disabled={saving} onClick={() => setFinishConfirmOpen(false)}>
              Keep editing
            </button>
            <button type="button" className="btn btn--primary" disabled={saving} onClick={() => void completeWorkout()}>
              {saving ? 'Saving…' : 'Finish anyway'}
            </button>
          </div>
        </section>
      )}

      {!completed && lines.length > 0 && (
        <WorkoutSessionNavCard
          lines={lines}
          slimMode={effectiveFocus}
          focusMode={focusMode}
          focusExerciseIdx={focusExerciseIdx}
          onToggleFocusMode={setFocusMode}
          onPrevExercise={() => setFocusExerciseIdx((i) => Math.max(0, i - 1))}
          onNextExercise={() => setFocusExerciseIdx((i) => Math.min(lines.length - 1, i + 1))}
          onJumpToExercise={jumpToExercise}
          onNextIncomplete={scrollToNextIncomplete}
        />
      )}

      <WorkoutSessionMetaCard workout={workout} completed={completed} onNotesBlur={(notes) => void handleNotesBlur(notes)} />

      {!completed && !fromProgram && (
        <WorkoutExercisePickerCard
          userId={userId}
          open={pickerOpen}
          onToggleOpen={() => setPickerOpen((v) => !v)}
          search={search}
          onSearchChange={setSearch}
          favoritesOnly={favoritesOnlyPicker}
          onFavoritesOnlyChange={setFavoritesOnlyPicker}
          debouncedSearch={debouncedSearch}
          loading={pickerListFetching}
          showEmpty={showPickerEmpty}
          hits={exerciseHits}
          onPickExercise={(exerciseId) => void addExercise(exerciseId)}
          onToggleFavorite={(exerciseId, nextIsFavorite) => {
            void (async () => {
              try {
                if (nextIsFavorite) await addExerciseFavorite(userId, exerciseId);
                else await removeExerciseFavorite(userId, exerciseId);
                await queryClient.invalidateQueries({
                  predicate: (q) => q.queryKey[0] === 'exercisesPicker' && q.queryKey[1] === userId,
                });
              } catch (err) {
                onError?.(err instanceof Error ? err.message : 'Favorite failed');
              }
            })();
          }}
          {...(onError != null ? { onError } : {})}
        />
      )}

      {fromProgram && !completed && (
        <p className="progress-text workout-session__program-hint">
          Program session: work through the list in order. Targets show the plan; enter load, reps, and RIR for each set.
        </p>
      )}

      <div className="workout-session__aria-live" aria-live="polite" aria-atomic="true">
        {effectiveFocus && lines[focusExerciseIdx] != null
          ? `Exercise ${focusExerciseIdx + 1} of ${lines.length}: ${lines[focusExerciseIdx]!.exercise.name}`
          : ''}
      </div>

      {!completed && effectiveFocus && lines.length > 1 ? (
        <div
          className="workout-session__swipe-sheet"
          onTouchStart={(e) => {
            const t = e.touches[0];
            if (t) swipeRef.current = { x: t.clientX };
          }}
          onTouchEnd={(e) => {
            if (!swipeRef.current) return;
            const dx = e.changedTouches[0].clientX - swipeRef.current.x;
            swipeRef.current = null;
            if (dx > 56) setFocusExerciseIdx((i) => Math.max(0, i - 1));
            else if (dx < -56) setFocusExerciseIdx((i) => Math.min(lines.length - 1, i + 1));
          }}
        >
          {lines[focusExerciseIdx] != null
            ? (() => {
                const line = lines[focusExerciseIdx]!;
                const lineInsights = insights[line.id];
                return (
                  <WorkoutExerciseCard
                    key={line.id}
                    line={line}
                    completed={completed}
                    fromProgram={fromProgram}
                    focusHidden={false}
                    removeConfirmActive={removeConfirmLineId === line.id}
                    onRequestRemove={() => setRemoveConfirmLineId(line.id)}
                    onCancelRemove={() => setRemoveConfirmLineId(null)}
                    onConfirmRemove={() => {
                      void (async () => {
                        if (!workoutId) return;
                        try {
                          await deleteWorkoutExercise(userId, workoutId, line.id);
                          setRemoveConfirmLineId(null);
                          prevInsightsKeyRef.current = '';
                          invalidateWorkout();
                        } catch (err) {
                          onError?.(err instanceof Error ? err.message : 'Remove failed');
                        }
                      })();
                    }}
                    {...(lineInsights != null ? { insights: lineInsights } : {})}
                    humanizeVariant={humanizeVariant}
                    units={units}
                    displayWeight={displayWeight}
                    parseWeightInput={parseWeightInput}
                    onPatchSet={(setId, patch) => void patchSetField(line.id, setId, patch as Parameters<typeof patchWorkoutSet>[4])}
                    onAddSet={() => {
                      void (async () => {
                        if (!workoutId) return;
                        try {
                          const last = line.sets[line.sets.length - 1];
                          const ins = insights[line.id];
                          const body: PatchWorkoutSetRequest = {};
                          if (last) {
                            if (last.weight_kg != null && last.weight_kg > 0) body.weight_kg = last.weight_kg;
                            if (last.rir != null) body.rir = last.rir;
                            if (last.reps != null) body.reps = last.reps;
                          } else {
                            if (ins?.suggested_weight_kg != null && ins.suggested_weight_kg > 0) {
                              body.weight_kg = ins.suggested_weight_kg;
                            }
                            if (ins?.suggested_reps != null && ins.suggested_reps > 0) {
                              body.reps = ins.suggested_reps;
                            }
                          }
                          await addWorkoutSet(userId, workoutId, line.id, body);
                          prevInsightsKeyRef.current = '';
                          invalidateWorkout();
                        } catch (err) {
                          onError?.(err instanceof Error ? err.message : 'Add set failed');
                        }
                      })();
                    }}
                    onDeleteSet={(setId) => {
                      void (async () => {
                        if (!workoutId) return;
                        try {
                          await deleteWorkoutSet(userId, workoutId, line.id, setId);
                          prevInsightsKeyRef.current = '';
                          invalidateWorkout();
                        } catch (err) {
                          onError?.(err instanceof Error ? err.message : 'Delete set failed');
                        }
                      })();
                    }}
                    canDeleteSet={(setCount) => setCount > 1}
                    onRest={(sec) => setRestSeconds(sec)}
                    isPatchingSetId={savingSetId}
                    patchErrorBySetId={setPatchErrors}
                    onDismissPatchError={(setId) =>
                      setSetPatchErrors((prev) => {
                        const next = { ...prev };
                        delete next[setId];
                        return next;
                      })
                    }
                    ProgramExerciseNotes={ProgramExerciseNotes}
                    compactHeaderActions={effectiveFocus && !completed}
                    userId={userId}
                    focusRepsSetId={focusRepsSetId}
                    onDoneCommitted={(lineId, setId) => {
                      const ln = workout?.exercises.find((l) => l.id === lineId);
                      if (!ln) return;
                      const idx = ln.sets.findIndex((s) => s.id === setId);
                      const nextSet = idx >= 0 ? ln.sets[idx + 1] : undefined;
                      setFocusRepsSetId(nextSet?.id ?? null);
                    }}
                    onRestAfterSetDone={(sec) => setRestSeconds(sec)}
                    onSubstituteExercise={async (lineId, substituteExerciseId) => {
                      if (!workoutId) return;
                      const ln = workout?.exercises.find((l) => l.id === lineId);
                      if (!ln) return;
                      try {
                        await patchWorkoutExercise(userId, workoutId, lineId, {
                          exercise_id: substituteExerciseId,
                          substituted_from_exercise_id: ln.exercise_id,
                        });
                        prevInsightsKeyRef.current = '';
                        setFocusRepsSetId(null);
                        invalidateWorkout();
                        onError?.(null);
                      } catch (err) {
                        onError?.(err instanceof Error ? err.message : 'Substitute failed');
                      }
                    }}
                  />
                );
              })()
            : null}
        </div>
      ) : (
        lines.map((line) => {
          const focusHidden = effectiveFocus && line.id !== lines[focusExerciseIdx]?.id;
          const lineInsights = insights[line.id];
          return (
            <WorkoutExerciseCard
              key={line.id}
              line={line}
              completed={completed}
              fromProgram={fromProgram}
              focusHidden={focusHidden}
              removeConfirmActive={removeConfirmLineId === line.id}
              onRequestRemove={() => setRemoveConfirmLineId(line.id)}
              onCancelRemove={() => setRemoveConfirmLineId(null)}
              onConfirmRemove={() => {
                void (async () => {
                  if (!workoutId) return;
                  try {
                    await deleteWorkoutExercise(userId, workoutId, line.id);
                    setRemoveConfirmLineId(null);
                    prevInsightsKeyRef.current = '';
                    invalidateWorkout();
                  } catch (err) {
                    onError?.(err instanceof Error ? err.message : 'Remove failed');
                  }
                })();
              }}
              {...(lineInsights != null ? { insights: lineInsights } : {})}
              humanizeVariant={humanizeVariant}
              units={units}
              displayWeight={displayWeight}
              parseWeightInput={parseWeightInput}
              onPatchSet={(setId, patch) => void patchSetField(line.id, setId, patch as Parameters<typeof patchWorkoutSet>[4])}
              onAddSet={() => {
                void (async () => {
                  if (!workoutId) return;
                  try {
                    const last = line.sets[line.sets.length - 1];
                    const ins = insights[line.id];
                    const body: PatchWorkoutSetRequest = {};
                    if (last) {
                      if (last.weight_kg != null && last.weight_kg > 0) body.weight_kg = last.weight_kg;
                      if (last.rir != null) body.rir = last.rir;
                      if (last.reps != null) body.reps = last.reps;
                    } else {
                      if (ins?.suggested_weight_kg != null && ins.suggested_weight_kg > 0) {
                        body.weight_kg = ins.suggested_weight_kg;
                      }
                      if (ins?.suggested_reps != null && ins.suggested_reps > 0) {
                        body.reps = ins.suggested_reps;
                      }
                    }
                    await addWorkoutSet(userId, workoutId, line.id, body);
                    prevInsightsKeyRef.current = '';
                    invalidateWorkout();
                  } catch (err) {
                    onError?.(err instanceof Error ? err.message : 'Add set failed');
                  }
                })();
              }}
              onDeleteSet={(setId) => {
                void (async () => {
                  if (!workoutId) return;
                  try {
                    await deleteWorkoutSet(userId, workoutId, line.id, setId);
                    prevInsightsKeyRef.current = '';
                    invalidateWorkout();
                  } catch (err) {
                    onError?.(err instanceof Error ? err.message : 'Delete set failed');
                  }
                })();
              }}
              canDeleteSet={(setCount) => setCount > 1}
              onRest={(sec) => setRestSeconds(sec)}
              isPatchingSetId={savingSetId}
              patchErrorBySetId={setPatchErrors}
              onDismissPatchError={(setId) =>
                setSetPatchErrors((prev) => {
                  const next = { ...prev };
                  delete next[setId];
                  return next;
                })
              }
              ProgramExerciseNotes={ProgramExerciseNotes}
              compactHeaderActions={effectiveFocus && !completed}
              userId={userId}
              focusRepsSetId={focusRepsSetId}
              onDoneCommitted={(lineId, setId) => {
                const ln = workout?.exercises.find((l) => l.id === lineId);
                if (!ln) return;
                const idx = ln.sets.findIndex((s) => s.id === setId);
                const nextSet = idx >= 0 ? ln.sets[idx + 1] : undefined;
                setFocusRepsSetId(nextSet?.id ?? null);
              }}
              onRestAfterSetDone={(sec) => setRestSeconds(sec)}
              onSubstituteExercise={async (lineId, substituteExerciseId) => {
                if (!workoutId) return;
                const ln = workout?.exercises.find((l) => l.id === lineId);
                if (!ln) return;
                try {
                  await patchWorkoutExercise(userId, workoutId, lineId, {
                    exercise_id: substituteExerciseId,
                    substituted_from_exercise_id: ln.exercise_id,
                  });
                  prevInsightsKeyRef.current = '';
                  setFocusRepsSetId(null);
                  invalidateWorkout();
                  onError?.(null);
                } catch (err) {
                  onError?.(err instanceof Error ? err.message : 'Substitute failed');
                }
              }}
            />
          );
        })
      )}

      {workout.exercises.length === 0 && (
        <p className="progress-text">No exercises yet. Add one to start logging sets.</p>
      )}
    </div>
  );
}
