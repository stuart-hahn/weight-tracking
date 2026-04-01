import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { getExerciseHistory, getExercise, getUser } from '../api/client';
import { queryKeys } from '../api/queryKeys';
import type { ExerciseSessionHistoryRow, UnitsPreference } from '../types/api';
import { formatWeight } from '../utils/units';
import { estimated1RmEpley } from '../utils/estimated1rm';
import Page from '../components/layout/Page';
import PageHeader from '../components/layout/PageHeader';
import PageLoading from '../components/PageLoading';
import InlineStatusCard from '../components/ui/InlineStatusCard';

const CHART_H = 160;
const PAD = { t: 8, r: 12, b: 28, l: 40 };

function roundLoadKg(kg: number): number {
  return Math.round(kg * 10) / 10;
}

/** Most frequent top-set load in history rows (for "reps at fixed load" chart). */
function dominantTopSetLoadKg(rows: ExerciseSessionHistoryRow[]): number | null {
  const counts = new Map<number, number>();
  for (const r of rows) {
    if (r.top_set_weight_kg == null || r.top_set_weight_kg <= 0) continue;
    const key = roundLoadKg(r.top_set_weight_kg);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  let best: number | null = null;
  let bestCount = 0;
  for (const [k, c] of counts) {
    if (c > bestCount) {
      bestCount = c;
      best = k;
    }
  }
  return best;
}

interface ExerciseHistoryPageProps {
  userId: string;
}

export default function ExerciseHistoryPage({ userId }: ExerciseHistoryPageProps) {
  const { exerciseId } = useParams<{ exerciseId: string }>();
  const { data: profile } = useQuery({
    queryKey: queryKeys.user(userId),
    queryFn: () => getUser(userId),
  });
  const units: UnitsPreference = profile?.units ?? 'metric';
  const wrapRef = useRef<HTMLDivElement>(null);
  const [w, setW] = useState(320);

  const { data: exerciseMeta } = useQuery({
    queryKey: exerciseId ? queryKeys.exercise(userId, exerciseId) : ['exercise', 'noop'],
    queryFn: () => getExercise(userId, exerciseId!),
    enabled: Boolean(exerciseId),
  });

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: exerciseId ? queryKeys.exerciseHistory(userId, exerciseId) : ['exerciseHistory', 'noop'],
    queryFn: () => getExerciseHistory(userId, exerciseId!, { limit: 20 }),
    enabled: Boolean(exerciseId),
  });

  const exerciseName = exerciseMeta?.name ?? 'Exercise';

  useEffect(() => {
    if (!exerciseMeta?.name) return;
    const prev = document.title;
    document.title = `${exerciseMeta.name} — History`;
    return () => {
      document.title = prev;
    };
  }, [exerciseMeta?.name]);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setW(Math.max(260, el.clientWidth)));
    ro.observe(el);
    setW(Math.max(260, el.clientWidth));
    return () => ro.disconnect();
  }, []);

  const chronological = useMemo(() => (data?.rows ? [...data.rows].reverse() : []), [data?.rows]);

  const fixedLoadKg = useMemo(() => dominantTopSetLoadKg(data?.rows ?? []), [data?.rows]);

  const loadPts = useMemo(() => {
    const pts: { x: number; y: number; label: string }[] = [];
    const withW = chronological.filter((r) => r.top_set_weight_kg != null && r.top_set_weight_kg > 0);
    const vals = withW.map((r) => r.top_set_weight_kg!);
    if (vals.length === 0) return { pts: [] as typeof pts, min: 0, max: 1 };
    const min = Math.min(...vals);
    const max = Math.max(...vals);
    const span = Math.max(max - min, 1);
    withW.forEach((r, i) => {
      const x = PAD.l + (i / Math.max(withW.length - 1, 1)) * (w - PAD.l - PAD.r);
      const y = PAD.t + (1 - (r.top_set_weight_kg! - min) / span) * (CHART_H - PAD.t - PAD.b);
      pts.push({ x, y, label: r.completed_at.slice(0, 10) });
    });
    return { pts, min, max };
  }, [chronological, w]);

  const volPts = useMemo(() => {
    const withV = chronological.filter((r) => r.volume_kg > 0);
    if (withV.length === 0) return { pts: [] as { x: number; y: number }[], min: 0, max: 1 };
    const vals = withV.map((r) => r.volume_kg);
    const min = Math.min(...vals);
    const max = Math.max(...vals);
    const span = Math.max(max - min, 1);
    const pts: { x: number; y: number }[] = [];
    withV.forEach((r, i) => {
      const x = PAD.l + (i / Math.max(withV.length - 1, 1)) * (w - PAD.l - PAD.r);
      const y = PAD.t + (1 - (r.volume_kg - min) / span) * (CHART_H - PAD.t - PAD.b);
      pts.push({ x, y });
    });
    return { pts, min, max };
  }, [chronological, w]);

  const repsAtLoadPts = useMemo(() => {
    const empty = { pts: [] as { x: number; y: number }[], min: 0, max: 1, count: 0 };
    if (fixedLoadKg == null) return empty;
    const filtered = chronological.filter(
      (r) =>
        r.top_set_weight_kg != null &&
        roundLoadKg(r.top_set_weight_kg) === fixedLoadKg &&
        r.top_set_reps != null &&
        r.top_set_reps > 0
    );
    if (filtered.length === 0) return empty;
    const vals = filtered.map((r) => r.top_set_reps!);
    const min = Math.min(...vals);
    const max = Math.max(...vals);
    const span = Math.max(max - min, 1);
    const pts: { x: number; y: number }[] = [];
    filtered.forEach((r, i) => {
      const x = PAD.l + (i / Math.max(filtered.length - 1, 1)) * (w - PAD.l - PAD.r);
      const y = PAD.t + (1 - (r.top_set_reps! - min) / span) * (CHART_H - PAD.t - PAD.b);
      pts.push({ x, y });
    });
    return { pts, min, max, count: filtered.length };
  }, [chronological, fixedLoadKg, w]);

  if (!exerciseId) {
    return (
      <Page>
        <p className="progress-text">Missing exercise.</p>
      </Page>
    );
  }

  if (isLoading) {
    return <PageLoading />;
  }

  if (isError || !data) {
    return (
      <Page>
        <PageHeader title={`${exerciseName} — history`} description={<>Could not load history.</>} />
        <InlineStatusCard
          variant="error"
          title="History"
          message={error instanceof Error ? error.message : 'Failed to load'}
          actionLabel="Retry"
          onAction={() => void refetch()}
        />
        <p className="progress-text">
          <Link to="/exercises">← Exercises</Link>
        </p>
      </Page>
    );
  }

  return (
    <Page>
      <p className="progress-text">
        <Link to="/exercises">← Exercises</Link>
      </p>
      <PageHeader
        title={`${exerciseName} — history`}
        description={
          <>
            Completed sessions (newest first in the table). Charts are chronological (oldest → newest). Est. 1RM uses the Epley
            formula from the logged top set.
          </>
        }
      />

      {data.plateau && data.plateau_hint && (
        <section className="app__card exercise-history__plateau" aria-live="polite">
          <h3 className="app__card-title">Plateau note</h3>
          <p className="progress-text">{data.plateau_hint}</p>
        </section>
      )}

      <section className="app__card exercise-history__charts" ref={wrapRef}>
        <h3 className="app__card-title">Top set load</h3>
        <svg width={w} height={CHART_H} className="exercise-history__svg" role="img" aria-label="Top set load over time">
          {loadPts.pts.length > 1 && (
            <polyline
              fill="none"
              stroke="var(--color-accent, #3b82f6)"
              strokeWidth="2"
              points={loadPts.pts.map((p) => `${p.x},${p.y}`).join(' ')}
            />
          )}
          {loadPts.pts.map((p, i) => (
            <circle key={i} cx={p.x} cy={p.y} r={4} fill="var(--color-accent, #3b82f6)" />
          ))}
        </svg>
        <p className="progress-text exercise-history__chart-foot">
          {loadPts.pts.length === 0 ? 'No load data yet.' : `Range ${formatWeight(loadPts.min, units)} – ${formatWeight(loadPts.max, units)}`}
        </p>

        <h3 className="app__card-title exercise-history__vol-title">Volume (kg × reps)</h3>
        <svg width={w} height={CHART_H} className="exercise-history__svg" role="img" aria-label="Volume over time">
          {volPts.pts.length > 1 && (
            <polyline
              fill="none"
              stroke="var(--color-text-muted, #64748b)"
              strokeWidth="2"
              points={volPts.pts.map((p) => `${p.x},${p.y}`).join(' ')}
            />
          )}
          {volPts.pts.map((p, i) => (
            <circle key={i} cx={p.x} cy={p.y} r={4} fill="var(--color-text-muted, #64748b)" />
          ))}
        </svg>

        <h3 className="app__card-title exercise-history__vol-title">Top-set reps at fixed load</h3>
        <p className="progress-text exercise-history__chart-caption">
          {fixedLoadKg == null
            ? 'Not enough sessions with a logged top-set load to pick a fixed load.'
            : `Sessions where top set is ${formatWeight(fixedLoadKg, units)} (most common load in this window). Points: ${repsAtLoadPts.count}.`}
        </p>
        {repsAtLoadPts.pts.length > 0 ? (
          <svg width={w} height={CHART_H} className="exercise-history__svg" role="img" aria-label="Reps at fixed load over time">
            {repsAtLoadPts.pts.length > 1 && (
              <polyline
                fill="none"
                stroke="var(--color-accent-2, #0d9488)"
                strokeWidth="2"
                points={repsAtLoadPts.pts.map((p) => `${p.x},${p.y}`).join(' ')}
              />
            )}
            {repsAtLoadPts.pts.map((p, i) => (
              <circle key={i} cx={p.x} cy={p.y} r={4} fill="var(--color-accent-2, #0d9488)" />
            ))}
          </svg>
        ) : (
          fixedLoadKg != null && (
            <p className="progress-text exercise-history__chart-foot">No sessions at that load with reps logged for the top set.</p>
          )
        )}
      </section>

      <section className="app__card exercise-history__table-card">
        <h3 className="app__card-title">Sessions</h3>
        <div className="exercise-history__table-wrap">
          <table className="exercise-history__table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Top set</th>
                <th>Est. 1RM</th>
                <th>Reps / set</th>
                <th>Avg RIR</th>
                <th>Volume</th>
                <th>Sub</th>
              </tr>
            </thead>
            <tbody>
              {data.rows.map((r: ExerciseSessionHistoryRow) => {
                const e1 = estimated1RmEpley(r.top_set_weight_kg, r.top_set_reps);
                return (
                  <tr key={r.workout_id}>
                    <td>{r.completed_at.slice(0, 10)}</td>
                    <td>
                      {r.top_set_weight_kg != null
                        ? `${formatWeight(r.top_set_weight_kg, units)}${r.top_set_reps != null ? ` ×${r.top_set_reps}` : ''}`
                        : '—'}
                    </td>
                    <td>{e1 != null ? `${formatWeight(e1, units)}` : '—'}</td>
                    <td>{r.reps_per_set || '—'}</td>
                    <td>{r.avg_rir != null ? String(r.avg_rir) : '—'}</td>
                    <td>{r.volume_kg > 0 ? `${r.volume_kg}` : '—'}</td>
                    <td>{r.substituted ? 'Yes' : '—'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {data.rows.length === 0 && <p className="progress-text">No completed workouts with this exercise yet.</p>}
      </section>
    </Page>
  );
}
