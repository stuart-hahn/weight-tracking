import { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { listWorkouts, createWorkout } from '../api/client';
import type { WorkoutListItem } from '../types/api';
import PageLoading from '../components/PageLoading';

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
  const [loading, setLoading] = useState(true);
  const [inProgress, setInProgress] = useState<WorkoutListItem[]>([]);
  const [completed, setCompleted] = useState<WorkoutListItem[]>([]);
  const [starting, setStarting] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    Promise.all([
      listWorkouts(userId, { status: 'in_progress', limit: 10 }),
      listWorkouts(userId, { status: 'completed', limit: 40 }),
    ])
      .then(([ip, co]) => {
        setInProgress(ip);
        setCompleted(co);
        onError?.(null);
      })
      .catch((e) => onError?.(e instanceof Error ? e.message : 'Failed to load workouts'))
      .finally(() => setLoading(false));
  }, [userId, onError]);

  useEffect(() => {
    load();
  }, [load]);

  const startNew = async () => {
    setStarting(true);
    try {
      const w = await createWorkout(userId, {});
      navigate(`/workouts/${w.id}`);
      onError?.(null);
    } catch (e) {
      onError?.(e instanceof Error ? e.message : 'Failed to start workout');
    } finally {
      setStarting(false);
    }
  };

  if (loading) {
    return <PageLoading />;
  }

  return (
    <div>
      <section className="app__card">
        <h2 className="app__card-title">Workouts</h2>
        <p className="progress-text" style={{ marginBottom: '1rem' }}>
          Log strength sessions, see last time&apos;s performance, and repeat past workouts for progressive overload.
        </p>
        <button type="button" className="btn btn--primary" disabled={starting} onClick={() => void startNew()}>
          {starting ? 'Starting…' : 'Start new workout'}
        </button>
      </section>

      {inProgress.length > 0 && (
        <section className="app__card">
          <h3 className="app__card-title">In progress</h3>
          <ul className="workout-history-list">
            {inProgress.map((w) => (
              <li key={w.id}>
                <Link to={`/workouts/${w.id}`} className="workout-history-list__link">
                  <span>{w.name || 'Workout'}</span>
                  <span className="workout-history-list__meta">{formatWhen(w.started_at)} · {w.exercise_count} exercises</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="app__card">
        <h3 className="app__card-title">History</h3>
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
    </div>
  );
}
