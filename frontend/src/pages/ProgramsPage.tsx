import { useState, useEffect, useCallback, FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { listWorkoutPrograms, createWorkoutProgram } from '../api/client';
import type { WorkoutProgramListItem } from '../types/api';
import PageLoading from '../components/PageLoading';
import Page from '../components/layout/Page';
import PageHeader from '../components/layout/PageHeader';

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
    <Page>
      <PageHeader
        title="Programs"
        description={
          <>
            Build training days with exercise order, set templates, and progression variants. Start sessions from the Workouts page.
          </>
        }
        actions={
          <Link to="/workouts" className="btn btn--secondary btn--sm">
            ← Workouts
          </Link>
        }
      />

      <section className="app__card">
        <form onSubmit={(e) => void onCreate(e)} className="workout-inline programs-page__create">
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
    </Page>
  );
}
