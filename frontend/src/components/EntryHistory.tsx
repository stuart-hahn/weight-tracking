import { useState, useEffect, useCallback, FormEvent, useMemo, useRef } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { getEntries, getProgress, getOptionalMetrics, updateEntry, deleteEntry, upsertOptionalMetric, deleteOptionalMetric } from '../api/client';
import type { DailyEntryResponse, ProgressResponse } from '../types/api';
import { formatWeight, kgToLb, lbToKg, cmToIn, inToCm } from '../utils/units';
import PageLoading from './PageLoading';
import InlineStatusCard from './ui/InlineStatusCard';
import RetentionBanner from './ui/RetentionBanner';
import Page from './layout/Page';
import PageHeader from './layout/PageHeader';
import Dialog from './ui/Dialog';
import ConfirmDialog from './ui/ConfirmDialog';
import { useTimeZone } from '../context/TimeZonePreference';

interface EntryHistoryProps {
  userId: string;
  refreshTrigger?: number;
  onEntryUpdated?: () => void;
}

const CHART_HEIGHT = 180;
const CHART_PADDING = { top: 8, right: 8, bottom: 24, left: 36 };
const CHART_MIN_WIDTH = 280;
const CHART_MAX_WIDTH = 720;

export default function EntryHistory({ userId, refreshTrigger = 0, onEntryUpdated }: EntryHistoryProps) {
  const { todayISO } = useTimeZone();
  const [entries, setEntries] = useState<DailyEntryResponse[]>([]);
  const [progress, setProgress] = useState<ProgressResponse | null>(null);
  const [bodyFatByDate, setBodyFatByDate] = useState<Record<string, number>>({});
  const [optionalMetricsLoadError, setOptionalMetricsLoadError] = useState<string | null>(null);
  const [optionalMetricsLoading, setOptionalMetricsLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [editingEntry, setEditingEntry] = useState<DailyEntryResponse | null>(null);
  const [editWeight, setEditWeight] = useState('');
  const [editCalories, setEditCalories] = useState('');
  const [editWaist, setEditWaist] = useState('');
  const [editHip, setEditHip] = useState('');
  const [editBodyFat, setEditBodyFat] = useState('');
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const editWeightRef = useRef<HTMLInputElement | null>(null);
  const chartWrapRef = useRef<HTMLElement | null>(null);
  const [chartWidth, setChartWidth] = useState<number>(320);

  const loadOptionalMetrics = useCallback(() => {
    let cancelled = false;
    setOptionalMetricsLoading(true);
    setOptionalMetricsLoadError(null);
    getOptionalMetrics(userId)
      .then((om) => {
        if (cancelled) return;
        const map: Record<string, number> = {};
        for (const m of om) {
          if (m.body_fat_percent != null) map[m.date] = m.body_fat_percent;
        }
        setBodyFatByDate(map);
        setOptionalMetricsLoadError(null);
      })
      .catch((e) => {
        if (!cancelled) setOptionalMetricsLoadError(e instanceof Error ? e.message : 'Failed to load optional metrics');
      })
      .finally(() => {
        if (!cancelled) setOptionalMetricsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [userId]);

  const loadAll = useCallback(() => {
    let cancelled = false;
    setLoading(true);
    setLoadError(null);
    Promise.all([getEntries(userId), getProgress(userId)])
      .then(([e, p]) => {
        if (!cancelled) {
          setEntries(e);
          setProgress(p);
          setLoadError(null);
        }
      })
      .catch((e) => {
        if (!cancelled) setLoadError(e instanceof Error ? e.message : 'Failed to load progress');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [userId]);

  useEffect(() => {
    const cleanup = loadAll();
    return cleanup;
  }, [loadAll, refreshTrigger]);

  useEffect(() => {
    if (loadError) return;
    const cleanup = loadOptionalMetrics();
    return cleanup;
  }, [loadOptionalMetrics, loadError, refreshTrigger]);

  useEffect(() => {
    const editDate = (location.state as { editDate?: string } | null)?.editDate;
    if (editDate && entries.length > 0 && !editingEntry) {
      const entry = entries.find((e) => e.date === editDate);
      if (entry) setEditingEntry(entry);
      navigate(location.pathname, { replace: true, state: {} });
    }
  }, [location.state, entries, editingEntry, navigate, location.pathname]);

  useEffect(() => {
    const el = chartWrapRef.current;
    if (!el) return;

    const clamp = (n: number) => Math.max(CHART_MIN_WIDTH, Math.min(CHART_MAX_WIDTH, n));

    const update = () => {
      const w = Math.round(el.getBoundingClientRect().width);
      if (w > 0) setChartWidth(clamp(w));
    };

    update();

    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', update);
      return () => window.removeEventListener('resize', update);
    }

    const ro = new ResizeObserver(() => update());
    ro.observe(el);
    return () => ro.disconnect();
  }, [entries.length]);

  useEffect(() => {
    if (!editingEntry || !progress) return;
    const u = progress.units;
    setEditWeight(u === 'imperial' ? String(Math.round(kgToLb(editingEntry.weight_kg))) : String(editingEntry.weight_kg));
    setEditCalories(editingEntry.calories != null ? String(editingEntry.calories) : '');
    setEditWaist(editingEntry.waist_cm != null ? (u === 'imperial' ? String(Math.round(cmToIn(editingEntry.waist_cm) * 10) / 10) : String(editingEntry.waist_cm)) : '');
    setEditHip(editingEntry.hip_cm != null ? (u === 'imperial' ? String(Math.round(cmToIn(editingEntry.hip_cm) * 10) / 10) : String(editingEntry.hip_cm)) : '');
    setEditBodyFat(bodyFatByDate[editingEntry.date] != null ? String(bodyFatByDate[editingEntry.date]) : '');
    setEditError(null);
  }, [editingEntry, progress, bodyFatByDate]);

  const closeEdit = () => {
    if (editSaving) return;
    setEditError(null);
    setConfirmDeleteOpen(false);
    setEditingEntry(null);
  };

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

      const caloriesValue = (() => {
        const s = editCalories.trim();
        if (s === '') return null;
        const n = Number(s);
        if (Number.isNaN(n)) return null;
        if (n < 0 || n > 10000) return null;
        return n;
      })();

      const body: { weight_kg: number; calories: number | null; waist_cm: number | null; hip_cm: number | null } = {
        weight_kg: weightKg,
        calories: caloriesValue,
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

      const existingBodyFat = bodyFatByDate[editingEntry.date];
      const nextBodyFat = (() => {
        const s = editBodyFat.trim();
        if (s === '') return null;
        const n = Number(s);
        if (Number.isNaN(n)) return null;
        if (n < 0 || n > 100) return null;
        return n;
      })();

      setEditSaving(true);
      try {
        await updateEntry(userId, editingEntry.id, body);
        if (nextBodyFat != null) {
          await upsertOptionalMetric(userId, editingEntry.date, nextBodyFat);
        } else if (existingBodyFat != null) {
          await deleteOptionalMetric(userId, editingEntry.date);
        }
        onEntryUpdated?.();
        closeEdit();
      } catch (err) {
        setEditError(err instanceof Error ? err.message : 'Failed to update entry');
      } finally {
        setEditSaving(false);
      }
    },
    [editingEntry, progress, editWeight, editCalories, editWaist, editHip, editBodyFat, userId, onEntryUpdated, bodyFatByDate]
  );

  const handleDeleteEntry = useCallback(async () => {
    if (!editingEntry) return;
    setEditError(null);
    setEditSaving(true);
    try {
      await deleteEntry(userId, editingEntry.id);
      if (bodyFatByDate[editingEntry.date] != null) {
        await deleteOptionalMetric(userId, editingEntry.date);
      }
      onEntryUpdated?.();
      closeEdit();
    } catch (err) {
      setEditError(err instanceof Error ? err.message : 'Failed to delete entry');
    } finally {
      setEditSaving(false);
    }
  }, [editingEntry, userId, onEntryUpdated, bodyFatByDate]);

  const sortedEntries = [...entries].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
  );

  const chartModel = useMemo(() => {
    if (sortedEntries.length === 0) return null;
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
    return { weights, minW, maxW, goalKg, minY, maxY, range, minD, maxD, dateRange };
  }, [sortedEntries, progress?.goal_weight_kg]);

  const minW = chartModel?.minW ?? 0;
  const maxW = chartModel?.maxW ?? 0;
  const goalKg = chartModel?.goalKg ?? null;
  const minY = chartModel?.minY ?? 0;
  const maxY = chartModel?.maxY ?? 0;
  const range = chartModel?.range ?? 1;
  const minD = chartModel?.minD ?? 0;
  const dateRange = chartModel?.dateRange ?? 1;

  const width = chartWidth;
  const innerW = width - CHART_PADDING.left - CHART_PADDING.right;
  const innerH = CHART_HEIGHT - CHART_PADDING.top - CHART_PADDING.bottom;

  const toX = (date: Date) =>
    CHART_PADDING.left + (innerW * (date.getTime() - minD)) / dateRange;
  const toY = (kg: number) =>
    CHART_PADDING.top + innerH - (innerH * (kg - minY)) / range;

  const points = useMemo(
    () => (chartModel ? sortedEntries.map((e) => `${toX(new Date(e.date))},${toY(e.weight_kg)}`).join(' ') : ''),
    [sortedEntries, chartModel, minD, dateRange, minY, range]
  );
  const goalY = goalKg != null ? toY(goalKg) : null;
  const hasEntryToday =
    progress?.latest_entry_date != null &&
    progress.latest_entry_date === todayISO;

  const yTicks = [minY, minY + range * 0.5, maxY].filter((v, i, a) => a.indexOf(v) === i);
  const xTicks = [sortedEntries[0]?.date, sortedEntries[Math.floor(sortedEntries.length / 2)]?.date, sortedEntries[sortedEntries.length - 1]?.date].filter(Boolean) as string[];
  const chartSummary = progress
    ? `Weight from ${formatWeight(minW, progress.units)} to ${formatWeight(maxW, progress.units)} over ${sortedEntries.length} entries.${goalKg != null ? ` Goal: ${formatWeight(goalKg, progress.units)}.` : ''}`
    : '';

  const svgTitleId = 'progress-chart-title';
  const svgDescId = 'progress-chart-desc';

  return (
    <Page>
      <PageHeader
        title="Progress"
        description={<>Review your trend, then click any day to edit weight, calories, or measurements.</>}
        actions={
          <Link to="/log" className="btn btn--secondary btn--sm">
            Log today
          </Link>
        }
      />

      {loading && <PageLoading title="Progress" />}
      {!loading && loadError && (
        <InlineStatusCard
          variant="error"
          title="Progress"
          message={loadError}
          actionLabel="Retry"
          onAction={() => void loadAll()}
        />
      )}
      {!loading && !loadError && sortedEntries.length === 0 && (
        <section className="app__card" aria-label="Progress">
          <h2 className="app__card-title">History</h2>
          <p className="progress-text">
            No entries yet. <Link to="/log">Log your first weight</Link>.
          </p>
        </section>
      )}

      {!loading && !loadError && sortedEntries.length > 0 && chartModel && (
        <>
          {optionalMetricsLoadError && (
            <InlineStatusCard
              variant="error"
              title="Body fat metrics"
              message={optionalMetricsLoadError}
              actionLabel={optionalMetricsLoading ? 'Loading…' : 'Retry'}
              onAction={() => {
                if (optionalMetricsLoading) return;
                void loadOptionalMetrics();
              }}
            />
          )}
          {progress != null && !hasEntryToday && (
            <RetentionBanner>
              Haven&apos;t logged today? <Link to="/log">Log your weight</Link> to update your trend and weekly summary.
            </RetentionBanner>
          )}

          <section className="app__card" aria-label="Progress">
            <h2 className="app__card-title">Trend</h2>
            <figure
              ref={(el) => {
                chartWrapRef.current = el;
              }}
              className="progress-chart"
              aria-label="Weight over time"
            >
              <svg
                viewBox={`0 0 ${width} ${CHART_HEIGHT}`}
                preserveAspectRatio="xMidYMid meet"
                className="weight-chart"
                role="img"
                aria-labelledby={`${svgTitleId} ${svgDescId}`}
              >
                <title id={svgTitleId}>Weight over time</title>
                <desc id={svgDescId}>{chartSummary}</desc>
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
                  <text key={d} x={toX(new Date(d))} y={CHART_HEIGHT - 4} textAnchor="middle" fontSize="10" fill="var(--muted)">
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
                <polyline fill="none" stroke="var(--accent)" strokeWidth="2" points={points} />
                {sortedEntries.map((e) => (
                  <circle key={e.id} cx={toX(new Date(e.date))} cy={toY(e.weight_kg)} r="3" fill="var(--accent)" />
                ))}
              </svg>
              <figcaption className="progress-text progress-chart__caption">
                {chartSummary}
              </figcaption>
            </figure>

            <h3 className="app__card-title progress-history__title">History</h3>
            {progress && (
              <p className="progress-text progress-history__summary">
                Latest: {formatWeight(sortedEntries[sortedEntries.length - 1].weight_kg, progress.units)} · Range: {formatWeight(minW, progress.units)}–
                {formatWeight(maxW, progress.units)}
                {goalKg != null ? ` · Goal: ${formatWeight(goalKg, progress.units)}` : ''}
              </p>
            )}

            <Dialog
              open={editingEntry != null && progress != null}
              title={editingEntry ? <>Edit entry — {editingEntry.date}</> : 'Edit entry'}
              description={<>Update weight, calories, or measurements. Press Esc to close.</>}
              onClose={closeEdit}
              initialFocusRef={editWeightRef}
              closeOnBackdrop={!editSaving}
              size="md"
            >
              {editingEntry && progress && (
                <>
                  <ConfirmDialog
                    open={confirmDeleteOpen}
                    title="Delete entry?"
                    message={
                      <>
                        This will permanently delete the entry for <strong>{editingEntry.date}</strong>. This cannot be undone.
                      </>
                    }
                    confirmLabel="Delete"
                    cancelLabel="Cancel"
                    variant="danger"
                    busy={editSaving}
                    onClose={() => {
                      if (editSaving) return;
                      setConfirmDeleteOpen(false);
                    }}
                    onConfirm={() => {
                      void handleDeleteEntry().finally(() => setConfirmDeleteOpen(false));
                    }}
                  />

                  {editError && (
                    <div className="app__error" role="alert" style={{ marginBottom: '0.75rem' }}>
                      {editError}
                    </div>
                  )}

                  <form onSubmit={handleEditSubmit} noValidate>
                    <div className="form-group">
                      <label className="form-label" htmlFor="edit-entry-weight">
                        Weight ({progress.units === 'imperial' ? 'lb' : 'kg'})
                      </label>
                      <input
                        ref={editWeightRef}
                        id="edit-entry-weight"
                        type="number"
                        className="form-input"
                        min={progress.units === 'imperial' ? 20 : 1}
                        max={progress.units === 'imperial' ? 1100 : 500}
                        step={progress.units === 'imperial' ? 1 : 0.1}
                        value={editWeight}
                        onChange={(e) => setEditWeight(e.target.value)}
                        disabled={editSaving}
                      />
                    </div>
                    <div className="form-group">
                      <label className="form-label" htmlFor="edit-entry-calories">
                        Calories (optional)
                      </label>
                      <input
                        id="edit-entry-calories"
                        type="number"
                        className="form-input"
                        min={0}
                        max={10000}
                        value={editCalories}
                        onChange={(e) => setEditCalories(e.target.value)}
                        disabled={editSaving}
                      />
                    </div>
                    <div className="form-group">
                      <label className="form-label" htmlFor="edit-entry-waist">
                        Waist ({progress.units === 'imperial' ? 'in' : 'cm'})
                      </label>
                      <input
                        id="edit-entry-waist"
                        type="number"
                        className="form-input"
                        min={1}
                        max={200}
                        step={0.1}
                        value={editWaist}
                        onChange={(e) => setEditWaist(e.target.value)}
                        disabled={editSaving}
                      />
                    </div>
                    <div className="form-group">
                      <label className="form-label" htmlFor="edit-entry-hip">
                        Hip ({progress.units === 'imperial' ? 'in' : 'cm'})
                      </label>
                      <input
                        id="edit-entry-hip"
                        type="number"
                        className="form-input"
                        min={1}
                        max={200}
                        step={0.1}
                        value={editHip}
                        onChange={(e) => setEditHip(e.target.value)}
                        disabled={editSaving}
                      />
                    </div>
                    <div className="form-group">
                      <label className="form-label" htmlFor="edit-entry-bodyfat">
                        Body fat % (optional)
                      </label>
                      <input
                        id="edit-entry-bodyfat"
                        type="number"
                        className="form-input"
                        min={0}
                        max={100}
                        step={0.1}
                        value={editBodyFat}
                        onChange={(e) => setEditBodyFat(e.target.value)}
                        disabled={editSaving}
                        placeholder="e.g. 22"
                      />
                      <div className="form-hint form-hint--tight">
                        Leave blank to clear.
                      </div>
                    </div>

                    <div className="ui-dialog__actions ui-dialog__actions--spread">
                      <button type="submit" className="btn btn--primary" disabled={editSaving}>
                        {editSaving ? 'Saving…' : 'Save'}
                      </button>
                      <button type="button" className="btn btn--secondary" onClick={closeEdit} disabled={editSaving}>
                        Cancel
                      </button>
                      <button
                        type="button"
                        className="btn btn--danger"
                        onClick={() => setConfirmDeleteOpen(true)}
                        disabled={editSaving}
                      >
                        Delete…
                      </button>
                    </div>
                  </form>
                </>
              )}
            </Dialog>

            <ul className="entry-list">
              {[...sortedEntries].reverse().map((e) => (
                <li key={e.id}>
                  <button
                    type="button"
                    className="entry-row"
                    onClick={(ev) => {
                      void ev;
                      setEditingEntry(e);
                    }}
                  >
                    <span className="entry-row__date">{e.date}</span>
                    <span className="entry-row__weight">
                      <strong>{progress ? formatWeight(e.weight_kg, progress.units) : `${e.weight_kg} kg`}</strong>
                    </span>
                    <span
                      className={
                        e.calories != null ? 'entry-row__calories' : 'entry-row__calories entry-row__calories--empty'
                      }
                    >
                      {e.calories != null ? `${e.calories} kcal` : '—'}
                    </span>
                    <span
                      className={
                        bodyFatByDate[e.date] != null
                          ? 'entry-row__extra'
                          : 'entry-row__extra entry-row__extra--empty'
                      }
                    >
                      {bodyFatByDate[e.date] != null ? `${bodyFatByDate[e.date]}% BF` : '—'}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        </>
      )}
    </Page>
  );
}
