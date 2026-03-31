import { useState, useEffect, useCallback, FormEvent } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import {
  getWorkoutProgram,
  patchWorkoutProgram,
  deleteWorkoutProgram,
  createProgramDay,
  deleteProgramDay,
  addProgramDayExercise,
  patchProgramDayExercise,
  deleteProgramDayExercise,
  addProgramSetTemplate,
  deleteProgramSetTemplate,
  listExercises,
} from '../api/client';
import type { WorkoutProgramDetailResponse, ProgramDayNested, ProgramDayExerciseNested } from '../types/api';
import PageLoading from '../components/PageLoading';
import ExerciseCreateInline, { exerciseKindLabel } from '../components/exercises/ExerciseCreateInline';

interface ProgramEditPageProps {
  userId: string;
  onError?: (message: string | null) => void;
  onSuccess?: (message: string | null) => void;
}

const VARIANTS: { value: string; label: string }[] = [
  { value: 'general_double', label: 'General double progression' },
  { value: 'primary_smith_incline', label: 'Primary — Smith incline' },
  { value: 'primary_rdl', label: 'Primary — RDL' },
  { value: 'primary_lat_pulldown_upper_b', label: 'Primary — Lat pulldown' },
  { value: 'primary_squat_or_hack', label: 'Primary — Squat / hack' },
  { value: 'isolation_calibration_candidate', label: 'Isolation calibration' },
  { value: 'custom', label: 'Custom / default' },
];

export default function ProgramEditPage({ userId, onError, onSuccess }: ProgramEditPageProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const { programId } = useParams<{ programId: string }>();
  const [program, setProgram] = useState<WorkoutProgramDetailResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeDayId, setActiveDayId] = useState<string | null>(null);
  const [programName, setProgramName] = useState('');
  const [newDayName, setNewDayName] = useState('');
  const [search, setSearch] = useState('');
  const [hits, setHits] = useState<Awaited<ReturnType<typeof listExercises>>>([]);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!programId) return;
    setLoading(true);
    try {
      const p = await getWorkoutProgram(userId, programId);
      setProgram(p);
      setProgramName(p.name);
      setActiveDayId((prev) => {
        if (prev && p.days.some((d) => d.id === prev)) return prev;
        return p.days[0]?.id ?? null;
      });
      onError?.(null);
    } catch (e) {
      onError?.(e instanceof Error ? e.message : 'Failed to load program');
      setProgram(null);
    } finally {
      setLoading(false);
    }
  }, [userId, programId, onError]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!search.trim()) {
      setHits([]);
      return;
    }
    let cancelled = false;
    listExercises(userId, { q: search.trim() })
      .then((r) => {
        if (!cancelled) setHits(r);
      })
      .catch(() => {
        if (!cancelled) setHits([]);
      });
    return () => {
      cancelled = true;
    };
  }, [search, userId]);

  const activeDay: ProgramDayNested | null =
    program && activeDayId ? program.days.find((d) => d.id === activeDayId) ?? null : null;

  const saveProgramName = async () => {
    if (!programId || !program || programName.trim() === program.name) return;
    setBusy(true);
    try {
      const p = await patchWorkoutProgram(userId, programId, { name: programName.trim() });
      setProgram(p);
      onSuccess?.('Program updated.');
    } catch (e) {
      onError?.(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setBusy(false);
    }
  };

  const addDay = async (e: FormEvent) => {
    e.preventDefault();
    if (!programId || !newDayName.trim()) return;
    setBusy(true);
    try {
      await createProgramDay(userId, programId, { name: newDayName.trim() });
      setNewDayName('');
      await load();
      onSuccess?.('Day added.');
    } catch (err) {
      onError?.(err instanceof Error ? err.message : 'Failed to add day');
    } finally {
      setBusy(false);
    }
  };

  const removeProgram = async () => {
    if (!programId || !window.confirm('Delete this program and all its days?')) return;
    setBusy(true);
    try {
      await deleteWorkoutProgram(userId, programId);
      navigate('/workouts/programs');
    } catch (err) {
      onError?.(err instanceof Error ? err.message : 'Delete failed');
    } finally {
      setBusy(false);
    }
  };

  const removeDay = async (dayId: string) => {
    if (!programId || !window.confirm('Delete this day and its exercises?')) return;
    setBusy(true);
    try {
      await deleteProgramDay(userId, programId, dayId);
      if (activeDayId === dayId) setActiveDayId(null);
      await load();
    } catch (err) {
      onError?.(err instanceof Error ? err.message : 'Failed to delete day');
    } finally {
      setBusy(false);
    }
  };

  const addExercise = async (exerciseId: string) => {
    if (!programId || !activeDayId) return;
    setBusy(true);
    try {
      await addProgramDayExercise(userId, programId, activeDayId, { exercise_id: exerciseId });
      setSearch('');
      setHits([]);
      await load();
      onSuccess?.('Exercise added.');
    } catch (err) {
      onError?.(err instanceof Error ? err.message : 'Failed to add exercise');
    } finally {
      setBusy(false);
    }
  };

  const setVariant = async (pde: ProgramDayExerciseNested, variant: string) => {
    if (!programId || !activeDayId) return;
    setBusy(true);
    try {
      const p = await patchProgramDayExercise(userId, programId, activeDayId, pde.id, { progression_variant: variant });
      setProgram(p);
    } catch (err) {
      onError?.(err instanceof Error ? err.message : 'Update failed');
    } finally {
      setBusy(false);
    }
  };

  const moveExercise = async (pde: ProgramDayExerciseNested, dir: -1 | 1) => {
    if (!programId || !activeDay || !activeDayId) return;
    const idx = activeDay.exercises.findIndex((e) => e.id === pde.id);
    const next = idx + dir;
    if (next < 0 || next >= activeDay.exercises.length) return;
    setBusy(true);
    try {
      const p = await patchProgramDayExercise(userId, programId, activeDayId, pde.id, { order_index: next });
      setProgram(p);
    } catch (err) {
      onError?.(err instanceof Error ? err.message : 'Reorder failed');
    } finally {
      setBusy(false);
    }
  };

  const removeExercise = async (pdeId: string) => {
    if (!programId || !activeDayId) return;
    setBusy(true);
    try {
      await deleteProgramDayExercise(userId, programId, activeDayId, pdeId);
      await load();
    } catch (err) {
      onError?.(err instanceof Error ? err.message : 'Remove failed');
    } finally {
      setBusy(false);
    }
  };

  const addTemplate = async (
    pdeId: string,
    body: { set_role: string; target_reps_min?: number | null; target_reps_max?: number | null; percent_of_top?: number | null }
  ) => {
    if (!programId || !activeDayId) return;
    setBusy(true);
    try {
      await addProgramSetTemplate(userId, programId, activeDayId, pdeId, body);
      await load();
    } catch (err) {
      onError?.(err instanceof Error ? err.message : 'Failed to add template');
    } finally {
      setBusy(false);
    }
  };

  const removeTemplate = async (pdeId: string, templateId: string) => {
    if (!programId || !activeDayId) return;
    setBusy(true);
    try {
      await deleteProgramSetTemplate(userId, programId, activeDayId, pdeId, templateId);
      await load();
    } catch (err) {
      onError?.(err instanceof Error ? err.message : 'Failed to delete template');
    } finally {
      setBusy(false);
    }
  };

  const primaryPreset = async (pdeId: string) => {
    if (!programId || !activeDayId) return;
    setBusy(true);
    try {
      await addProgramSetTemplate(userId, programId, activeDayId, pdeId, {
        set_role: 'top',
        target_reps_min: 6,
        target_reps_max: 8,
        target_rir_min: 0,
        target_rir_max: 1,
      });
      await addProgramSetTemplate(userId, programId, activeDayId, pdeId, {
        set_role: 'backoff',
        target_reps_min: 8,
        target_reps_max: 10,
        target_rir_min: 1,
        target_rir_max: 2,
        percent_of_top: 0.91,
      });
      await addProgramSetTemplate(userId, programId, activeDayId, pdeId, {
        set_role: 'backoff',
        target_reps_min: 8,
        target_reps_max: 10,
        target_rir_min: 1,
        target_rir_max: 2,
        percent_of_top: 0.91,
      });
      await load();
      onSuccess?.('Preset added.');
    } catch (err) {
      onError?.(err instanceof Error ? err.message : 'Preset failed');
    } finally {
      setBusy(false);
    }
  };

  if (!programId) {
    return <p className="progress-text">Missing program.</p>;
  }

  if (loading || !program) {
    return loading ? <PageLoading /> : <p className="progress-text">Program not found.</p>;
  }

  return (
    <div>
      <p className="progress-text" style={{ marginBottom: '0.75rem' }}>
        <Link to="/workouts/programs">← Programs</Link>
      </p>

      <section className="app__card">
        <div className="workout-session__ex-header" style={{ marginBottom: '1rem' }}>
          <input
            className="form-input"
            style={{ flex: '1 1 12rem', fontSize: '1.1rem', fontWeight: 600 }}
            value={programName}
            onChange={(e) => setProgramName(e.target.value)}
            onBlur={() => void saveProgramName()}
            aria-label="Program name"
          />
          <button type="button" className="btn btn--secondary btn--sm" disabled={busy} onClick={() => void removeProgram()}>
            Delete program
          </button>
        </div>

        <h3 className="app__card-title" style={{ fontSize: '1rem' }}>
          Days
        </h3>
        <div className="program-day-tabs">
          {program.days.map((d) => (
            <button
              key={d.id}
              type="button"
              className={`btn btn--sm ${d.id === activeDayId ? 'btn--primary' : 'btn--secondary'}`}
              onClick={() => setActiveDayId(d.id)}
            >
              {d.name}
            </button>
          ))}
        </div>
        <form onSubmit={(e) => void addDay(e)} className="workout-inline" style={{ marginTop: '0.75rem' }}>
          <input
            className="form-input"
            placeholder="New day name"
            value={newDayName}
            onChange={(e) => setNewDayName(e.target.value)}
            maxLength={80}
          />
          <button type="submit" className="btn btn--secondary" disabled={busy || !newDayName.trim()}>
            Add day
          </button>
        </form>
        {activeDayId && (
          <button
            type="button"
            className="btn btn--secondary btn--sm"
            style={{ marginTop: '0.5rem' }}
            disabled={busy}
            onClick={() => void removeDay(activeDayId)}
          >
            Delete selected day
          </button>
        )}
      </section>

      {activeDay && (
        <section className="app__card" style={{ marginTop: '1rem' }}>
          <h3 className="app__card-title">{activeDay.name} — exercises</h3>
          <p className="progress-text" style={{ marginBottom: '0.5rem' }}>
            <Link
              to={`/exercises?returnTo=${encodeURIComponent(`${location.pathname}${location.search}`)}`}
            >
              Open full catalog…
            </Link>
          </p>
          <ExerciseCreateInline
            userId={userId}
            onCreated={(ex) => void addExercise(ex.id)}
            {...(onError != null ? { onError } : {})}
            submitLabel="Create & add to day"
            className="program-edit__new-ex"
          />
          <input
            type="search"
            className="form-input"
            style={{ marginBottom: '0.75rem', marginTop: '0.75rem' }}
            placeholder="Search exercise to add…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {hits.length > 0 && (
            <ul className="workout-exercise-list" style={{ listStyle: 'none', padding: 0, marginBottom: '1rem' }}>
              {hits.map((ex) => (
                <li key={ex.id} className="workout-exercise-list__item">
                  <button type="button" className="workout-exercise-list__pick" onClick={() => void addExercise(ex.id)}>
                    <span>{ex.name}</span>
                    <span className="workout-exercise-list__meta">{exerciseKindLabel(ex.kind)}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}

          {activeDay.exercises.length === 0 ? (
            <p className="progress-text">No exercises. Search above to add from the catalog.</p>
          ) : (
            activeDay.exercises.map((pde, idx) => (
              <div key={pde.id} className="program-exercise-block">
                <div className="program-exercise-block__head">
                  <strong>{pde.exercise.name}</strong>
                  <select
                    className="form-input"
                    style={{ maxWidth: '16rem' }}
                    value={pde.progression_variant}
                    disabled={busy}
                    onChange={(e) => void setVariant(pde, e.target.value)}
                    aria-label="Progression variant"
                  >
                    {VARIANTS.map((v) => (
                      <option key={v.value} value={v.value}>
                        {v.label}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    className="btn btn--secondary btn--sm"
                    disabled={busy || idx === 0}
                    onClick={() => void moveExercise(pde, -1)}
                  >
                    Up
                  </button>
                  <button
                    type="button"
                    className="btn btn--secondary btn--sm"
                    disabled={busy || idx >= activeDay.exercises.length - 1}
                    onClick={() => void moveExercise(pde, 1)}
                  >
                    Down
                  </button>
                  <button type="button" className="btn btn--secondary btn--sm" disabled={busy} onClick={() => void removeExercise(pde.id)}>
                    Remove
                  </button>
                </div>
                <p className="progress-text" style={{ fontSize: '0.85rem', margin: '0.25rem 0 0.5rem' }}>
                  Set templates (used when starting a workout from this day). Empty = one blank working set.
                </p>
                <button
                  type="button"
                  className="btn btn--secondary btn--sm"
                  style={{ marginBottom: '0.5rem' }}
                  disabled={busy}
                  onClick={() => void primaryPreset(pde.id)}
                >
                  + Primary preset (1 top + 2 backoff)
                </button>
                <ul className="program-template-list">
                  {pde.set_templates.map((t) => (
                    <li key={t.id}>
                      <span>
                        {t.set_role} #{t.set_index}
                        {t.target_reps_min != null || t.target_reps_max != null
                          ? ` · reps ${t.target_reps_min ?? '—'}–${t.target_reps_max ?? '—'}`
                          : ''}
                        {t.percent_of_top != null ? ` · ${Math.round(t.percent_of_top * 100)}% top` : ''}
                      </span>
                      <button
                        type="button"
                        className="btn btn--secondary btn--sm"
                        disabled={busy}
                        onClick={() => void removeTemplate(pde.id, t.id)}
                      >
                        Remove
                      </button>
                    </li>
                  ))}
                </ul>
                <TemplateQuickAdd
                  disabled={busy}
                  onAdd={(body) => void addTemplate(pde.id, body)}
                />
              </div>
            ))
          )}
        </section>
      )}
    </div>
  );
}

function TemplateQuickAdd({
  disabled,
  onAdd,
}: {
  disabled: boolean;
  onAdd: (body: {
    set_role: string;
    target_reps_min?: number | null;
    target_reps_max?: number | null;
    percent_of_top?: number | null;
  }) => void;
}) {
  const [role, setRole] = useState('working');
  const [minR, setMinR] = useState('');
  const [maxR, setMaxR] = useState('');
  const [pct, setPct] = useState('');

  const submit = (e: FormEvent) => {
    e.preventDefault();
    onAdd({
      set_role: role,
      target_reps_min: minR === '' ? null : Number(minR),
      target_reps_max: maxR === '' ? null : Number(maxR),
      percent_of_top: pct === '' ? null : Number(pct) / 100,
    });
    setMinR('');
    setMaxR('');
    setPct('');
  };

  return (
    <form onSubmit={submit} className="program-template-form">
      <select className="form-input" value={role} onChange={(e) => setRole(e.target.value)} disabled={disabled}>
        <option value="top">top</option>
        <option value="backoff">backoff</option>
        <option value="working">working</option>
      </select>
      <input
        className="form-input"
        type="number"
        placeholder="reps min"
        value={minR}
        onChange={(e) => setMinR(e.target.value)}
        disabled={disabled}
      />
      <input
        className="form-input"
        type="number"
        placeholder="reps max"
        value={maxR}
        onChange={(e) => setMaxR(e.target.value)}
        disabled={disabled}
      />
      <input
        className="form-input"
        type="number"
        placeholder="% of top (e.g. 91)"
        value={pct}
        onChange={(e) => setPct(e.target.value)}
        disabled={disabled}
      />
      <button type="submit" className="btn btn--secondary btn--sm" disabled={disabled}>
        Add template
      </button>
    </form>
  );
}
