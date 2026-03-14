import { useState, useEffect, useCallback, useRef, FormEvent } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { getEntries, getProgress, getOptionalMetrics, updateEntry, deleteEntry } from '../api/client';
import type { DailyEntryResponse, ProgressResponse } from '../types/api';
import { formatWeight, formatTrendMagnitude, kgToLb, lbToKg, cmToIn, inToCm } from '../utils/units';
import { getTodayInTimezone } from '../utils/date';
import PageLoading from './PageLoading';
import { FieldInput } from './Field';

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
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [localSuccess, setLocalSuccess] = useState<string | null>(null);
  const location = useLocation();
  const navigate = useNavigate();
  const editFirstInputRef = useRef<HTMLInputElement>(null);
  const editTriggerRef = useRef<HTMLButtonElement | null>(null);
  const deleteButtonRef = useRef<HTMLButtonElement>(null);
  const cancelConfirmRef = useRef<HTMLButtonElement>(null);

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
    setEditWeight(u === 'imperial' ? String(Math.round(kgToLb(editingEntry.weight_kg) * 10) / 10) : String(editingEntry.weight_kg));
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
        setLocalSuccess('Updated.');
        window.setTimeout(() => setLocalSuccess(null), 2500);
      } catch (err) {
        setEditError(err instanceof Error ? err.message : 'Failed to update entry');
      } finally {
        setEditSaving(false);
      }
    },
    [editingEntry, progress, editWeight, editCalories, editWaist, editHip, userId, onEntryUpdated]
  );

  const handleDeleteConfirm = useCallback(async () => {
    if (!editingEntry) return;
    setEditError(null);
    setEditSaving(true);
    setShowDeleteConfirm(false);
    try {
      await deleteEntry(userId, editingEntry.id);
      onEntryUpdated?.();
      setEditingEntry(null);
      setLocalSuccess('Entry removed.');
      window.setTimeout(() => setLocalSuccess(null), 2500);
    } catch (err) {
      setEditError(err instanceof Error ? err.message : 'Failed to delete entry');
    } finally {
      setEditSaving(false);
    }
  }, [editingEntry, userId, onEntryUpdated]);

  useEffect(() => {
    if (!showDeleteConfirm) return;
    cancelConfirmRef.current?.focus();
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setShowDeleteConfirm(false);
        deleteButtonRef.current?.focus();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [showDeleteConfirm]);

  const sortedEntries = [...entries].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
  );

  if (loading) {
    return <PageLoading title="Progress" />;
  }

  if (sortedEntries.length === 0) {
    return (
      <section className="app__card empty-state" aria-label="Progress">
        <h2 className="empty-state__title">No weigh-ins yet</h2>
        <p className="empty-state__text">
          Log your first weigh-in to see your progress and track your trend over time.
        </p>
        <Link to="/home" className="btn btn--primary" style={{ width: 'auto' }}>
          Log your first weigh-in
        </Link>
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
  const firstEntry = sortedEntries[0];
  const firstDateMs = new Date(firstEntry.date).getTime();
  const firstWeight = firstEntry.weight_kg;
  const trendPerDay = progress?.weight_trend_kg_per_week != null ? progress.weight_trend_kg_per_week / 7 : 0;
  const trendLinePoints =
    Math.abs(trendPerDay) >= 0.001
      ? sortedEntries
          .map((e) => {
            const days = (new Date(e.date).getTime() - firstDateMs) / (1000 * 60 * 60 * 24);
            const trendWeight = firstWeight + trendPerDay * days;
            return `${toX(new Date(e.date))},${toY(trendWeight)}`;
          })
          .join(' ')
      : null;
  const goalY = goalKg != null ? toY(goalKg) : null;
  const hasEntryToday =
    progress?.latest_entry_date != null &&
    progress.latest_entry_date === getTodayInTimezone(progress?.timezone ?? undefined);

  const yTicks = [minY, minY + range * 0.5, maxY].filter((v, i, a) => a.indexOf(v) === i);
  const xTicks = [sortedEntries[0]?.date, sortedEntries[Math.floor(sortedEntries.length / 2)]?.date, sortedEntries[sortedEntries.length - 1]?.date].filter(Boolean) as string[];
  const chartSummary = progress
    ? (progress.messages?.trend_message
        ? `${progress.messages.trend_message} ${sortedEntries.length} entries, ${formatWeight(minW, progress.units)}–${formatWeight(maxW, progress.units)}.${goalKg != null ? ` Goal: ${formatWeight(goalKg, progress.units)}.` : ''}`
        : (() => {
            const rangeAndGoal = `${sortedEntries.length} entries, ${formatWeight(minW, progress.units)}–${formatWeight(maxW, progress.units)}.${goalKg != null ? ` Goal: ${formatWeight(goalKg, progress.units)}.` : ''}`;
            const trend = progress.weight_trend_kg_per_week;
            if (trend == null) return rangeAndGoal;
            const absTrend = Math.abs(trend);
            const trendPhrase =
              absTrend < 0.02 ? 'Stable.' : `${trend < 0 ? 'Losing' : 'Gaining'} ${formatTrendMagnitude(absTrend, progress.units)}.`;
            return `${trendPhrase} ${rangeAndGoal}`;
          })())
    : '';

  return (
    <>
      {progress != null && !hasEntryToday && (
        <section className="app__card retention-banner" role="status" aria-live="polite">
          <p className="retention-banner__text">
            {progress.messages?.streak_message ?? progress.messages?.retention_message ?? <>No weigh-in today yet. <Link to="/home">Log one</Link> to update your trend and weekly summary.</>}
          </p>
        </section>
      )}
      <section className="app__card" aria-label="Progress, goal timeline, and weight history">
      <h2 className="app__card-title">Progress</h2>
      <figure className="chart-wrap" aria-label="Weight over time with goal line and trend">
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
          {trendLinePoints && (
            <polyline
              fill="none"
              stroke="var(--muted)"
              strokeDasharray="3 3"
              strokeWidth="1.5"
              points={trendLinePoints}
              aria-hidden
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
          {progress?.trend_entries_count != null && progress.trend_entries_count >= 2 && (
            <span style={{ display: 'block', marginTop: '0.25rem' }}>Based on your last {progress.trend_entries_count} weigh-ins.{trendLinePoints ? " Dashed line: where you're headed at your current pace." : ''}</span>
          )}
        </figcaption>
      </figure>
      {progress?.pace_status && (
        <p style={{ marginTop: '0.25rem', marginBottom: '0.5rem' }} role="status">
          <span className={`pace-badge pace-badge--${progress.pace_status}`} aria-label={`Pace: ${progress.pace_status.replace('_', ' ')}`}>
            {progress.pace_status === 'ahead' ? 'Ahead of pace' : progress.pace_status === 'on_track' ? 'On track' : progress.pace_status === 'slightly_behind' ? 'A bit behind' : 'Behind'}
          </span>
        </p>
      )}
      {progress?.estimated_goal_date && progress?.progress_percent != null && progress.progress_percent < 100 && (
        <div className="goal-timeline" style={{ marginBottom: '0.5rem' }} role="status" aria-label="Goal timeline">
          <div className="goal-timeline__bar">
            <span className="goal-timeline__marker goal-timeline__marker--start" aria-hidden />
            <span className="goal-timeline__marker goal-timeline__marker--now" style={{ left: `${progress.progress_percent}%` }} aria-hidden />
            <span className="goal-timeline__marker goal-timeline__marker--goal" aria-hidden />
          </div>
          <div className="goal-timeline__labels">
            <span>Start</span>
            <span>Now ({Math.round(progress.progress_percent)}%)</span>
            <span>Goal ~{new Date(progress.estimated_goal_date + 'T12:00:00').toLocaleDateString(undefined, { month: 'short', year: '2-digit' })}</span>
          </div>
        </div>
      )}
      {(progress?.messages?.goal_date_message ?? progress?.estimated_goal_date ?? progress?.estimated_goal_message) && (
        <p className="progress-text" style={{ marginTop: '0.25rem', marginBottom: '0.5rem' }} role="status">
          {progress.messages?.goal_date_message ?? (progress.estimated_goal_date
            ? `Estimated to reach goal: ${new Date(progress.estimated_goal_date + 'T12:00:00').toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}.${progress.estimate_basis ? ` ${progress.estimate_basis}` : ''}`
            : progress.estimated_goal_message ?? '')}
        </p>
      )}
      {progress?.messages?.recovery_message && (
        <p className="progress-text" style={{ marginTop: '0.25rem', marginBottom: '0.5rem' }} role="status">
          {progress.messages.recovery_message}
        </p>
      )}
      {progress?.messages?.uncertainty_message && (
        <p className="progress-text" style={{ marginTop: '0.25rem', marginBottom: '0.5rem', fontSize: '0.9rem' }} role="status">
          {progress.messages.uncertainty_message}
        </p>
      )}
      {progress && progress.lean_mass_kg != null && (
        <p className="progress-text" style={{ marginTop: '0.25rem', marginBottom: '0.5rem' }}>
          Lean mass: {formatWeight(progress.lean_mass_kg, progress.units)} ({progress.lean_mass_is_estimated ? 'we estimated this from your profile' : 'you set'}).
        </p>
      )}
      {progress && progress.estimated_body_fat_percent != null && (
        <p className="progress-text" style={{ marginTop: '0.25rem', marginBottom: '0.5rem' }}>
          Estimated body fat: {progress.estimated_body_fat_percent.toFixed(1)}%—based on your current weight and lean mass.
        </p>
      )}
      {progress && (
        <>
          <details className="progress-text" style={{ marginTop: '0.75rem', fontSize: '0.85rem' }}>
            <summary style={{ cursor: 'pointer', color: 'var(--muted)' }}>How we calculate</summary>
            <p style={{ marginTop: '0.5rem', marginBottom: 0 }}>
              Goal weight comes from your target body fat % and lean mass (we estimate lean mass from your height, weight, and sex if you don&apos;t set it). The estimated goal date is based on your recent weigh-in trend—more weigh-ins give a more reliable estimate.
            </p>
          </details>
          <p style={{ marginTop: '0.5rem', marginBottom: 0 }}>
            <Link to="/settings" className="btn btn--secondary btn--sm">
              Change goal
            </Link>
          </p>
        </>
      )}
      <h3 className="app__card-title app__card-title--sm mt-6">Weight history</h3>
      {localSuccess && (
        <p className="app__success" role="status" style={{ marginTop: '0.5rem', marginBottom: 0 }}>
          {localSuccess}
        </p>
      )}
      {editingEntry && progress && (
        <section className="app__card" style={{ marginTop: '1rem' }} aria-label="Edit entry">
          <h4 className="app__card-title app__card-title--sm">Edit entry ({editingEntry.date})</h4>
          {editError && <div className="app__error" role="alert" style={{ marginBottom: '0.75rem' }}>{editError}</div>}
          <form onSubmit={handleEditSubmit} noValidate>
            <FieldInput
              ref={editFirstInputRef}
              id="edit-entry-weight"
              label={`Weight (${progress.units === 'imperial' ? 'lb' : 'kg'})`}
              type="number"
              min={progress.units === 'imperial' ? 20 : 1}
              max={progress.units === 'imperial' ? 1100 : 500}
              step={0.1}
              value={editWeight}
              onChange={(e) => setEditWeight(e.target.value)}
            />
            <FieldInput
              id="edit-entry-calories"
              label="Calories (optional)"
              type="number"
              min={0}
              max={10000}
              value={editCalories}
              onChange={(e) => setEditCalories(e.target.value)}
            />
            <FieldInput
              id="edit-entry-waist"
              label={`Waist (${progress.units === 'imperial' ? 'in' : 'cm'})`}
              type="number"
              min={1}
              max={200}
              step={0.1}
              value={editWaist}
              onChange={(e) => setEditWaist(e.target.value)}
            />
            <FieldInput
              id="edit-entry-hip"
              label={`Hip (${progress.units === 'imperial' ? 'in' : 'cm'})`}
              type="number"
              min={1}
              max={200}
              step={0.1}
              value={editHip}
              onChange={(e) => setEditHip(e.target.value)}
            />
            <div className="form-actions">
              <button type="submit" className="btn btn--primary" disabled={editSaving}>
                {editSaving ? 'Saving…' : 'Save'}
              </button>
              <button type="button" className="btn btn--secondary" onClick={() => setEditingEntry(null)} disabled={editSaving}>
                Cancel
              </button>
              <button type="button" className="btn btn--secondary btn--danger" onClick={() => setShowDeleteConfirm(true)} disabled={editSaving} ref={deleteButtonRef}>
                Delete
              </button>
            </div>
          </form>
        </section>
      )}
      {showDeleteConfirm && editingEntry && (
        <div className="dialog-overlay" role="dialog" aria-modal="true" aria-labelledby="delete-dialog-title" aria-describedby="delete-dialog-desc">
          <div className="dialog-overlay__content app__card">
            <h2 id="delete-dialog-title" className="app__card-title" style={{ marginTop: 0 }}>Delete entry?</h2>
            <p id="delete-dialog-desc" className="progress-text">
              Delete this weigh-in for {editingEntry.date}? This can&apos;t be undone.
            </p>
            <div className="form-actions">
              <button type="button" className="btn btn--primary btn--danger" onClick={handleDeleteConfirm} disabled={editSaving}>
                {editSaving ? 'Deleting…' : 'Delete'}
              </button>
              <button type="button" className="btn btn--secondary" ref={cancelConfirmRef} onClick={() => { setShowDeleteConfirm(false); deleteButtonRef.current?.focus(); }} disabled={editSaving}>
                Cancel
              </button>
            </div>
          </div>
        </div>
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
                display: 'grid',
                gridTemplateColumns: '1fr minmax(5rem, auto) minmax(5rem, auto) minmax(3.5rem, auto)',
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
              <span>{e.calories != null ? `${e.calories} kcal` : '—'}</span>
              <span>{bodyFatByDate[e.date] != null ? `${bodyFatByDate[e.date]}% BF` : '—'}</span>
            </button>
          </li>
        ))}
      </ul>
    </section>
    </>
  );
}
