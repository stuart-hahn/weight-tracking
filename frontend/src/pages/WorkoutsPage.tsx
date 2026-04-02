import { useState, useMemo, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { listWorkouts, createWorkout, listWorkoutPrograms, getWorkoutProgram } from '../api/client';
import type { WorkoutProgramDetailResponse } from '../types/api';
import { queryKeys } from '../api/queryKeys';
import PageLoading from '../components/PageLoading';
import Page from '../components/layout/Page';
import PageHeader from '../components/layout/PageHeader';
import { FIXED_PROGRAM_NAME, weekdayToFixedProgramDayOrderIndex } from '../constants/fixedProgram';
import Dialog from '../components/ui/Dialog';

interface WorkoutsPageProps {
  userId: string;
  onError?: (message: string | null) => void;
}

function formatWhen(iso: string): string {
  try {
    return new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
  } catch {
    return iso;
  }
}

export default function WorkoutsPage({ userId, onError }: WorkoutsPageProps) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [starting, setStarting] = useState(false);
  const [programPickerOpen, setProgramPickerOpen] = useState(false);
  const [programs, setPrograms] = useState<Awaited<ReturnType<typeof listWorkoutPrograms>>>([]);
  const [programDetail, setProgramDetail] = useState<WorkoutProgramDetailResponse | null>(null);
  const [programLoading, setProgramLoading] = useState(false);

  const { data, isLoading, isError } = useQuery({
    queryKey: queryKeys.workoutsHub(userId),
    queryFn: async () => {
      const [inProgress, completed, progList] = await Promise.all([
        listWorkouts(userId, { status: 'in_progress', limit: 10 }),
        listWorkouts(userId, { status: 'completed', limit: 40 }),
        listWorkoutPrograms(userId),
      ]);
      const fp = progList.find((p) => p.name === FIXED_PROGRAM_NAME);
      const fixedProgramDetail = fp ? await getWorkoutProgram(userId, fp.id) : null;
      return { inProgress, completed, fixedProgramDetail };
    },
  });

  const inProgress = data?.inProgress ?? [];
  const completed = data?.completed ?? [];
  const fixedProgramDetail = data?.fixedProgramDetail ?? null;

  useEffect(() => {
    if (isError) onError?.('Failed to load workouts');
  }, [isError, onError]);

  const sortedFixedDays = useMemo(() => {
    if (!fixedProgramDetail) return [];
    return [...fixedProgramDetail.days].sort((a, b) => a.order_index - b.order_index);
  }, [fixedProgramDetail]);

  const todayOrderIndex = weekdayToFixedProgramDayOrderIndex(new Date());

  const repeatProgramDayId = useMemo(
    () => completed[0]?.program_day_id ?? null,
    [completed]
  );

  const refreshHub = () => {
    void queryClient.invalidateQueries({ queryKey: queryKeys.workoutsHub(userId) });
  };

  const startNew = async () => {
    setStarting(true);
    try {
      const w = await createWorkout(userId, {});
      refreshHub();
      navigate(`/workouts/${w.id}`);
      onError?.(null);
    } catch (e) {
      onError?.(e instanceof Error ? e.message : 'Failed to start workout');
    } finally {
      setStarting(false);
    }
  };

  const openProgramPicker = async () => {
    setProgramPickerOpen(true);
    setProgramDetail(null);
    setProgramLoading(true);
    try {
      const list = await listWorkoutPrograms(userId);
      setPrograms(list);
      onError?.(null);
    } catch (e) {
      onError?.(e instanceof Error ? e.message : 'Failed to load programs');
      setPrograms([]);
    } finally {
      setProgramLoading(false);
    }
  };

  const selectProgramForStart = async (programId: string) => {
    setProgramLoading(true);
    try {
      const p = await getWorkoutProgram(userId, programId);
      setProgramDetail(p);
    } catch (e) {
      onError?.(e instanceof Error ? e.message : 'Failed to load program');
      setProgramDetail(null);
    } finally {
      setProgramLoading(false);
    }
  };

  const startFromProgramDay = async (programDayId: string) => {
    setStarting(true);
    try {
      const w = await createWorkout(userId, { program_day_id: programDayId });
      setProgramPickerOpen(false);
      setProgramDetail(null);
      refreshHub();
      navigate(`/workouts/${w.id}`);
      onError?.(null);
    } catch (e) {
      onError?.(e instanceof Error ? e.message : 'Failed to start from program');
    } finally {
      setStarting(false);
    }
  };

  if (isLoading) {
    return <PageLoading />;
  }

  return (
    <Page>
      <PageHeader
        title="Workouts"
        description={
          <>
            Choose the session you’re doing today. Each session shows targets; log load, reps, and RIR as you go.
          </>
        }
      />

      {inProgress.length > 0 && (
        <section className="app__card workouts-page__continue" aria-label="Continue workout">
          <h2 className="app__card-title">Continue workout</h2>
          {fixedProgramDetail && sortedFixedDays.length > 0 && (
            <p className="progress-text progress-text--mb-md">
              You have a session in progress — open it below or start a new one when you&apos;re ready.
            </p>
          )}
          <ul className="workout-history-list">
            {inProgress.map((w) => (
              <li key={w.id}>
                <Link to={`/workouts/${w.id}`} className="workout-history-list__link workout-history-list__link--continue">
                  <span>{w.name || 'Workout'}</span>
                  <span className="workout-history-list__meta">
                    {formatWhen(w.started_at)} · {w.exercise_count} exercises
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="app__card">

        {fixedProgramDetail && sortedFixedDays.length > 0 && (
          <div className="workouts-page__start-block">
            <h2 className="app__card-title workouts-page__subsection-title">Start session</h2>
            {todayOrderIndex === null && (
              <p className="progress-text progress-text--mb-md">
                Sunday is off. You can still start any session below if you&apos;re training on a different schedule.
              </p>
            )}
            <div className="program-day-tabs">
              {sortedFixedDays.map((d) => {
                const isToday = todayOrderIndex !== null && d.order_index === todayOrderIndex;
                return (
                  <button
                    key={d.id}
                    type="button"
                    className={isToday ? 'btn btn--primary' : 'btn btn--secondary'}
                    disabled={starting}
                    onClick={() => void startFromProgramDay(d.id)}
                  >
                    {d.name}
                  </button>
                );
              })}
            </div>
            {repeatProgramDayId && (
              <div className="workouts-page__repeat-day">
                <button
                  type="button"
                  className="btn btn--secondary"
                  disabled={starting}
                  onClick={() => void startFromProgramDay(repeatProgramDayId)}
                >
                  Same program day again
                </button>
                <p className="progress-text workouts-page__repeat-hint">
                  Starts the same template as your last completed program session (progression uses recent history).
                </p>
              </div>
            )}
          </div>
        )}

        {!fixedProgramDetail && (
          <p className="progress-text progress-text--mb-lg">
            Default program not found. Open{' '}
            <Link to="/workouts/programs">Programs</Link> or pull to refresh after signing in.
          </p>
        )}

        <p className="progress-text progress-text--mb-lg">
          <Link to="/exercises">Exercise catalog</Link>
          {' · '}
          <Link to="/workouts/programs">Programs</Link>
        </p>
        <details className="workouts-page__more-start">
          <summary className="workouts-page__more-start-summary">More ways to start</summary>
          <div className="workout-start-actions workouts-page__more-start-actions">
            <button type="button" className="btn btn--secondary" disabled={starting} onClick={() => void startNew()}>
              {starting ? 'Starting…' : 'Empty workout'}
            </button>
            <button
              type="button"
              className="btn btn--secondary"
              disabled={starting}
              onClick={() => void openProgramPicker()}
            >
              Other program
            </button>
          </div>
        </details>

        <Dialog
          open={programPickerOpen}
          title="Choose program day"
          description="Pick a program and day to start a session from its template."
          onClose={() => {
            if (starting) return;
            setProgramPickerOpen(false);
            setProgramDetail(null);
          }}
        >
          {programLoading && !programDetail && <p className="progress-text">Loading…</p>}
          {!programDetail && programs.length > 0 && (
            <ul className="workout-history-list">
              {programs.map((p) => (
                <li key={p.id}>
                  <button
                    type="button"
                    className="workout-history-list__link"
                    onClick={() => void selectProgramForStart(p.id)}
                    disabled={starting}
                  >
                    <span>{p.name}</span>
                    <span className="workout-history-list__meta">{p.day_count} days</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          {!programLoading && programs.length === 0 && (
            <p className="progress-text">
              No programs yet. <Link to="/workouts/programs">Create one under Programs</Link>.
            </p>
          )}
          {programDetail && (
            <>
              <button type="button" className="btn btn--secondary btn--sm workouts-page__modal-back" onClick={() => setProgramDetail(null)} disabled={starting}>
                ← Back to programs
              </button>
              <p className="progress-text workouts-page__modal-pick-hint">
                Pick a day for <strong>{programDetail.name}</strong>:
              </p>
              <div className="program-day-tabs">
                {programDetail.days.map((d) => (
                  <button
                    key={d.id}
                    type="button"
                    className="btn btn--secondary"
                    disabled={starting}
                    onClick={() => void startFromProgramDay(d.id)}
                  >
                    {d.name} ({d.exercises.length} ex.)
                  </button>
                ))}
              </div>
              {programDetail.days.length === 0 && (
                <p className="progress-text">This program has no days yet. Edit it under Programs.</p>
              )}
            </>
          )}
          <button
            type="button"
            className="btn btn--secondary btn--sm workouts-page__modal-cancel"
            disabled={starting}
            onClick={() => {
              setProgramPickerOpen(false);
              setProgramDetail(null);
            }}
          >
            Cancel
          </button>
        </Dialog>
      </section>

      <section className="app__card">
        <h2 className="app__card-title">History</h2>
        {completed.length === 0 ? (
          <p className="progress-text">No completed workouts yet. Finish a session to build history.</p>
        ) : (
          <ul className="workout-history-list">
            {completed.map((w) => (
              <li key={w.id}>
                <Link to={`/workouts/${w.id}`} className="workout-history-list__link">
                  <span>{w.name || 'Workout'}</span>
                  <span className="workout-history-list__meta">
                    {w.completed_at ? formatWhen(w.completed_at) : formatWhen(w.started_at)} · {w.exercise_count}{' '}
                    exercises
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </Page>
  );
}
