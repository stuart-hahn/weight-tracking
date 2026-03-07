import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { getEntries, getProgress } from '../api/client';
import type { DailyEntryResponse, ProgressResponse } from '../types/api';
import { formatWeight } from '../utils/units';

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

interface EntryHistoryProps {
  userId: string;
  refreshTrigger?: number;
}

const CHART_HEIGHT = 180;
const CHART_PADDING = { top: 8, right: 8, bottom: 24, left: 36 };

export default function EntryHistory({ userId, refreshTrigger = 0 }: EntryHistoryProps) {
  const [entries, setEntries] = useState<DailyEntryResponse[]>([]);
  const [progress, setProgress] = useState<ProgressResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    Promise.all([getEntries(userId), getProgress(userId)])
      .then(([e, p]) => {
        if (!cancelled) {
          setEntries(e);
          setProgress(p);
        }
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [userId, refreshTrigger]);

  const sortedEntries = [...entries].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
  );

  if (loading) {
    return (
      <section className="app__card" aria-label="Entry history">
        <h2 className="app__card-title">History</h2>
        <p className="progress-text">Loading…</p>
      </section>
    );
  }

  if (sortedEntries.length === 0) {
    return (
      <section className="app__card" aria-label="Entry history">
        <h2 className="app__card-title">History</h2>
        <p className="progress-text">No entries yet. Log your first above.</p>
      </section>
    );
  }

  const weights = sortedEntries.map((e) => e.weight_kg);
  const minW = Math.min(...weights);
  const maxW = Math.max(...weights);
  const goalKg = progress?.goal_weight_kg;
  const minY = goalKg != null && goalKg < minW ? goalKg : minW;
  const maxY = goalKg != null && goalKg > maxW ? goalKg : maxW;
  const range = maxY - minY || 1;
  const dates = sortedEntries.map((e) => new Date(e.date).getTime());
  const minD = Math.min(...dates);
  const maxD = Math.max(...dates);
  const dateRange = maxD - minD || 1;

  const width = 320;
  const innerW = width - CHART_PADDING.left - CHART_PADDING.right;
  const innerH = CHART_HEIGHT - CHART_PADDING.top - CHART_PADDING.bottom;

  const toX = (date: Date) =>
    CHART_PADDING.left + (innerW * (date.getTime() - minD)) / dateRange;
  const toY = (kg: number) =>
    CHART_PADDING.top + innerH - (innerH * (kg - minY)) / range;

  const points = sortedEntries
    .map((e) => `${toX(new Date(e.date))},${toY(e.weight_kg)}`)
    .join(' ');
  const goalY = goalKg != null ? toY(goalKg) : null;
  const hasEntryToday =
    progress?.latest_entry_date != null &&
    progress.latest_entry_date === todayISO();

  return (
    <>
      {progress != null && !hasEntryToday && (
        <section className="app__card retention-banner" role="status" aria-live="polite">
          <p className="retention-banner__text">
            Haven&apos;t logged today? <Link to="/log">Log your weight</Link> to update your trend and weekly summary.
          </p>
        </section>
      )}
      <section className="app__card" aria-label="Entry history">
      <h2 className="app__card-title">History</h2>
      <div className="chart-wrap" style={{ width: '100%', maxWidth: width, margin: '0 auto 1rem' }}>
        <svg
          viewBox={`0 0 ${width} ${CHART_HEIGHT}`}
          preserveAspectRatio="xMidYMid meet"
          className="weight-chart"
          aria-hidden
        >
          {goalY != null && goalY >= CHART_PADDING.top && goalY <= CHART_HEIGHT - CHART_PADDING.bottom && (
            <line
              x1={CHART_PADDING.left}
              y1={goalY}
              x2={width - CHART_PADDING.right}
              y2={goalY}
              stroke="var(--warn)"
              strokeDasharray="4 2"
              strokeWidth="1"
            />
          )}
          <polyline
            fill="none"
            stroke="var(--accent)"
            strokeWidth="2"
            points={points}
          />
          {sortedEntries.map((e) => (
            <circle
              key={e.id}
              cx={toX(new Date(e.date))}
              cy={toY(e.weight_kg)}
              r="3"
              fill="var(--accent)"
            />
          ))}
        </svg>
        {goalKg != null && progress && (
          <p className="progress-text" style={{ marginTop: '0.25rem', fontSize: '0.8rem' }}>
            Dashed line: goal {formatWeight(goalKg, progress.units)}
          </p>
        )}
      </div>
      <ul className="entry-list" style={{ listStyle: 'none', margin: 0, padding: 0 }}>
        {[...sortedEntries].reverse().map((e) => (
          <li
            key={e.id}
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              padding: '0.5rem 0',
              borderBottom: '1px solid var(--border)',
              gap: '1rem',
            }}
          >
            <span>{e.date}</span>
            <span><strong>{progress ? formatWeight(e.weight_kg, progress.units) : `${e.weight_kg} kg`}</strong></span>
            {e.calories != null && <span>{e.calories} kcal</span>}
          </li>
        ))}
      </ul>
    </section>
    </>
  );
}
