import { useState, useEffect, useCallback, useRef, FormEvent } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { getEntries, getProgress, getOptionalMetrics, updateEntry, deleteEntry } from '../api/client';
import type { DailyEntryResponse, ProgressResponse } from '../types/api';
import { formatWeight, kgToLb, lbToKg, cmToIn, inToCm } from '../utils/units';
import PageLoading from './PageLoading';

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

interface EntryHistoryProps {
  userId: string;
  refreshTrigger?: number;
  onEntryUpdated?: () => void;
}

const CHART_HEIGHT = 180;
const CHART_PADDING = { top: 8, right: 8, bottom: 24, left: 36 };

export default function EntryHistory({ userId, refreshTrigger = 0, onEntryUpdated }: EntryHistoryProps) {
  const [entries, setEntries] = useState<DailyEntryResponse[]>([]);
  const [progress, setProgress] = useState<ProgressResponse | null>(null);
  const [bodyFatByDate, setBodyFatByDate] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [editingEntry, setEditingEntry] = useState<DailyEntryResponse | null>(null);
  const [editWeight, setEditWeight] = useState('');
  const [editCalories, setEditCalories] = useState('');
  const [editWaist, setEditWaist] = useState('');
  const [editHip, setEditHip] = useState('');
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const location = useLocation();
  const navigate = useNavigate();
  const editFirstInputRef = useRef<HTMLInputElement>(null);
  const editTriggerRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    Promise.all([getEntries(userId), getProgress(userId), getOptionalMetrics(userId)])
      .then(([e, p, om]) => {
        if (!cancelled) {
          setEntries(e);
          setProgress(p);
          const map: Record<string, number> = {};
          for (const m of om) {
            if (m.body_fat_percent != null) map[m.date] = m.body_fat_percent;
          }
          setBodyFatByDate(map);
        }
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [userId, refreshTrigger]);

  useEffect(() => {
    const editDate = (location.state as { editDate?: string } | null)?.editDate;
    if (editDate && entries.length > 0 && !editingEntry) {
      const entry = entries.find((e) => e.date === editDate);
      if (entry) setEditingEntry(entry);
      navigate(location.pathname, { replace: true, state: {} });
    }
  }, [location.state, entries, editingEntry, navigate, location.pathname]);

  useEffect(() => {
    if (!editingEntry || !progress) return;
    const u = progress.units;
    setEditWeight(u === 'imperial' ? String(Math.round(kgToLb(editingEntry.weight_kg))) : String(editingEntry.weight_kg));
    setEditCalories(editingEntry.calories != null ? String(editingEntry.calories) : '');
    setEditWaist(editingEntry.waist_cm != null ? (u === 'imperial' ? String(Math.round(cmToIn(editingEntry.waist_cm) * 10) / 10) : String(editingEntry.waist_cm)) : '');
    setEditHip(editingEntry.hip_cm != null ? (u === 'imperial' ? String(Math.round(cmToIn(editingEntry.hip_cm) * 10) / 10) : String(editingEntry.hip_cm)) : '');
    setEditError(null);
  }, [editingEntry, progress]);

  useEffect(() => {
    if (editingEntry) {
      editFirstInputRef.current?.focus();
    } else {
      editTriggerRef.current?.focus();
      editTriggerRef.current = null;
    }
  }, [editingEntry]);

  const handleEditSubmit = useCallback(
    async (e: FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      if (!editingEntry || !progress) return;
      setEditError(null);
      const u = progress.units;
      let weightKg = Number(editWeight);
      if (u === 'imperial') weightKg = lbToKg(weightKg);
      if (Number.isNaN(weightKg) || weightKg <= 0 || weightKg > 500) {
        setEditError('Please enter a valid weight.');
        return;
      }
      const body: { weight_kg: number; calories: number | null; waist_cm: number | null; hip_cm: number | null } = {
        weight_kg: weightKg,
        calories: editCalories.trim() === '' ? null : (Number(editCalories) || null),
        waist_cm: null,
        hip_cm: null,
      };
      if (editWaist.trim() !== '') {
        const w = u === 'imperial' ? inToCm(Number(editWaist)) : Number(editWaist);
        if (!Number.isNaN(w) && w > 0 && w <= 200) body.waist_cm = w;
      }
      if (editHip.trim() !== '') {
        const h = u === 'imperial' ? inToCm(Number(editHip)) : Number(editHip);
        if (!Number.isNaN(h) && h > 0 && h <= 200) body.hip_cm = h;
      }
      setEditSaving(true);
      try {
        await updateEntry(userId, editingEntry.id, body);
        onEntryUpdated?.();
        setEditingEntry(null);
      } catch (err) {
        setEditError(err instanceof Error ? err.message : 'Failed to update entry');
      } finally {
        setEditSaving(false);
      }
    },
    [editingEntry, progress, editWeight, editCalories, editWaist, editHip, userId, onEntryUpdated]
  );

  const handleDeleteEntry = useCallback(async () => {
    if (!editingEntry) return;
    if (!window.confirm(`Delete entry for ${editingEntry.date}?`)) return;
    setEditError(null);
    setEditSaving(true);
    try {
      await deleteEntry(userId, editingEntry.id);
      onEntryUpdated?.();
      setEditingEntry(null);
    } catch (err) {
      setEditError(err instanceof Error ? err.message : 'Failed to delete entry');
    } finally {
      setEditSaving(false);
    }
  }, [editingEntry, userId, onEntryUpdated]);

  const sortedEntries = [...entries].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
  );

  if (loading) {
    return <PageLoading title="Progress" />;
  }

  if (sortedEntries.length === 0) {
    return (
      <section className="app__card" aria-label="Progress">
        <h2 className="app__card-title">Progress</h2>
        <p className="progress-text">
          No entries yet. <Link to="/log">Log your first weight</Link>.
        </p>
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

  const yTicks = [minY, minY + range * 0.5, maxY].filter((v, i, a) => a.indexOf(v) === i);
  const xTicks = [sortedEntries[0]?.date, sortedEntries[Math.floor(sortedEntries.length / 2)]?.date, sortedEntries[sortedEntries.length - 1]?.date].filter(Boolean) as string[];
  const chartSummary = progress
    ? `Weight from ${formatWeight(minW, progress.units)} to ${formatWeight(maxW, progress.units)} over ${sortedEntries.length} entries.${goalKg != null ? ` Goal: ${formatWeight(goalKg, progress.units)}.` : ''}`
    : '';

  return (
    <>
      {progress != null && !hasEntryToday && (
        <section className="app__card retention-banner" role="status" aria-live="polite">
          <p className="retention-banner__text">
            Haven&apos;t logged today? <Link to="/log">Log your weight</Link> to update your trend and weekly summary.
          </p>
        </section>
      )}
      <section className="app__card" aria-label="Progress">
      <h2 className="app__card-title">Progress</h2>
      <figure className="chart-wrap" style={{ width: '100%', maxWidth: width, margin: '0 auto 1rem' }} aria-label="Weight over time">
        <svg
          viewBox={`0 0 ${width} ${CHART_HEIGHT}`}
          preserveAspectRatio="xMidYMid meet"
          className="weight-chart"
          aria-hidden
        >
          {yTicks.map((kg) => (
            <text
              key={kg}
              x={CHART_PADDING.left - 4}
              y={toY(kg) + 4}
              textAnchor="end"
              fontSize="10"
              fill="var(--muted)"
            >
              {progress ? formatWeight(kg, progress.units).replace(/\s/g, '') : `${kg}`}
            </text>
          ))}
          {xTicks.map((d) => (
            <text
              key={d}
              x={toX(new Date(d))}
              y={CHART_HEIGHT - 4}
              textAnchor="middle"
              fontSize="10"
              fill="var(--muted)"
            >
              {d}
            </text>
          ))}
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
        <figcaption className="progress-text" style={{ marginTop: '0.25rem', fontSize: '0.8rem' }}>
          {chartSummary}
        </figcaption>
      </figure>
      <h3 className="app__card-title" style={{ fontSize: '0.9rem', marginTop: '1rem' }}>Weight history</h3>
      {editingEntry && progress && (
        <section className="app__card" style={{ marginTop: '1rem' }} aria-label="Edit entry">
          <h4 className="app__card-title" style={{ fontSize: '0.9rem' }}>Edit entry ({editingEntry.date})</h4>
          {editError && <div className="app__error" role="alert" style={{ marginBottom: '0.75rem' }}>{editError}</div>}
          <form onSubmit={handleEditSubmit} noValidate>
            <div className="form-group">
              <label className="form-label" htmlFor="edit-entry-weight">Weight ({progress.units === 'imperial' ? 'lb' : 'kg'})</label>
              <input
                ref={editFirstInputRef}
                id="edit-entry-weight"
                type="number"
                className="form-input"
                min={progress.units === 'imperial' ? 20 : 1}
                max={progress.units === 'imperial' ? 1100 : 500}
                step={progress.units === 'imperial' ? 1 : 0.1}
                value={editWeight}
                onChange={(e) => setEditWeight(e.target.value)}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Calories (optional)</label>
              <input
                type="number"
                className="form-input"
                min={0}
                max={10000}
                value={editCalories}
                onChange={(e) => setEditCalories(e.target.value)}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Waist ({progress.units === 'imperial' ? 'in' : 'cm'})</label>
              <input
                type="number"
                className="form-input"
                min={1}
                max={200}
                step={0.1}
                value={editWaist}
                onChange={(e) => setEditWaist(e.target.value)}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Hip ({progress.units === 'imperial' ? 'in' : 'cm'})</label>
              <input
                type="number"
                className="form-input"
                min={1}
                max={200}
                step={0.1}
                value={editHip}
                onChange={(e) => setEditHip(e.target.value)}
              />
            </div>
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginTop: '0.75rem' }}>
              <button type="submit" className="btn btn--primary" style={{ flex: 1, minWidth: '6rem' }} disabled={editSaving}>
                {editSaving ? 'Saving…' : 'Save'}
              </button>
              <button type="button" className="btn btn--secondary" onClick={() => setEditingEntry(null)} disabled={editSaving}>
                Cancel
              </button>
              <button type="button" className="btn btn--secondary" onClick={handleDeleteEntry} disabled={editSaving} style={{ color: 'var(--danger)' }}>
                Delete
              </button>
            </div>
          </form>
        </section>
      )}
      <ul className="entry-list" style={{ listStyle: 'none', margin: 0, padding: 0, marginTop: '0.5rem' }}>
        {[...sortedEntries].reverse().map((e) => (
          <li key={e.id}>
            <button
              type="button"
              className="entry-row"
              onClick={(ev) => { editTriggerRef.current = ev.currentTarget; setEditingEntry(e); }}
              style={{
                width: '100%',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '0.5rem 0',
                borderBottom: '1px solid var(--border)',
                gap: '1rem',
                background: 'transparent',
                borderLeft: 'none',
                borderRight: 'none',
                borderTop: 'none',
                color: 'inherit',
                font: 'inherit',
                textAlign: 'left',
                cursor: 'pointer',
              }}
            >
              <span>{e.date}</span>
              <span><strong>{progress ? formatWeight(e.weight_kg, progress.units) : `${e.weight_kg} kg`}</strong></span>
              {e.calories != null && <span>{e.calories} kcal</span>}
              {bodyFatByDate[e.date] != null && <span>{bodyFatByDate[e.date]}% BF</span>}
            </button>
          </li>
        ))}
      </ul>
    </section>
    </>
  );
}
