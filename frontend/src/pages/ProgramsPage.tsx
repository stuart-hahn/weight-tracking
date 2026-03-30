import { useState, useEffect, useCallback, FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { listWorkoutPrograms, createWorkoutProgram } from '../api/client';
import type { WorkoutProgramListItem } from '../types/api';
import PageLoading from '../components/PageLoading';

interface ProgramsPageProps {
  userId: string;
  onError?: (message: string | null) => void;
}

export default function ProgramsPage({ userId, onError }: ProgramsPageProps) {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [programs, setPrograms] = useState<WorkoutProgramListItem[]>([]);
  const [name, setName] = useState('');
  const [creating, setCreating] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    listWorkoutPrograms(userId)
      .then((rows) => {
        setPrograms(rows);
        onError?.(null);
      })
      .catch((e) => onError?.(e instanceof Error ? e.message : 'Failed to load programs'))
      .finally(() => setLoading(false));
  }, [userId, onError]);

  useEffect(() => {
    load();
  }, [load]);

  const onCreate = async (e: FormEvent) => {
    e.preventDefault();
    const n = name.trim();
    if (!n) return;
    setCreating(true);
    try {
      const p = await createWorkoutProgram(userId, { name: n });
      setName('');
      onError?.(null);
      navigate(`/workouts/programs/${p.id}/edit`);
    } catch (err) {
      onError?.(err instanceof Error ? err.message : 'Failed to create');
    } finally {
      setCreating(false);
    }
  };

  if (loading) {
    return <PageLoading />;
  }

  return (
    <div>
      <p className="progress-text" style={{ marginBottom: '1rem' }}>
        <Link to="/workouts">← Workouts</Link>
      </p>
      <section className="app__card">
        <h2 className="app__card-title">Programs</h2>
        <p className="progress-text" style={{ marginBottom: '1rem' }}>
          Build named training days with exercise order, set templates (top / backoff / working), and progression variants.
          Start a session from a day on the Workouts page.
        </p>
        <form onSubmit={(e) => void onCreate(e)} className="workout-inline" style={{ marginBottom: '1rem' }}>
          <input
            className="form-input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="New program name"
            maxLength={120}
            aria-label="Program name"
          />
          <button type="submit" className="btn btn--primary" disabled={creating || !name.trim()}>
            {creating ? 'Creating…' : 'Create'}
          </button>
        </form>
        {programs.length === 0 ? (
          <p className="progress-text">No programs yet. Create one to add training days.</p>
        ) : (
          <ul className="workout-history-list">
            {programs.map((p) => (
              <li key={p.id}>
                <Link to={`/workouts/programs/${p.id}/edit`} className="workout-history-list__link">
                  <span>{p.name}</span>
                  <span className="workout-history-list__meta">
                    {p.day_count} day{p.day_count === 1 ? '' : 's'}
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
