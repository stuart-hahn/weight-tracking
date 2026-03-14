import { useState, useEffect, useCallback, useRef, FormEvent } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { getEntries, getProgress, getOptionalMetrics, updateEntry, deleteEntry, createEntry, upsertOptionalMetric } from '../api/client';
import type { DailyEntryResponse, ProgressResponse, CreateEntryRequest } from '../types/api';
import { formatWeight, formatTrendMagnitude, kgToLb, lbToKg, cmToIn, inToCm } from '../utils/units';
import { getTodayInTimezone } from '../utils/date';
import { copy } from '../copy';
import PageLoading from './PageLoading';
import EmptyStateIllustration from './EmptyStateIllustration';
import { FieldInput } from './Field';

interface EntryHistoryProps {
  userId: string;
  refreshTrigger?: number;
  onEntryUpdated?: () => void;
}

const CHART_HEIGHT = 180;
const CHART_PADDING = { top: 8, right: 44, bottom: 24, left: 36 };

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
  const dialogContentRef = useRef<HTMLDivElement>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [addDate, setAddDate] = useState('');
  const [addWeight, setAddWeight] = useState('');
  const [addCalories, setAddCalories] = useState('');
  const [addBodyFat, setAddBodyFat] = useState('');
  const [addWaist, setAddWaist] = useState('');
  const [addHip, setAddHip] = useState('');
  const [addOptionalOpen, setAddOptionalOpen] = useState(false);
  const [addBodyFatOpen, setAddBodyFatOpen] = useState(false);
  const [addSubmitting, setAddSubmitting] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);
  const [addDuplicateDate, setAddDuplicateDate] = useState<string | null>(null);
  const addFormFirstInputRef = useRef<HTMLInputElement>(null);
  const addFormButtonRef = useRef<HTMLButtonElement>(null);

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

  useEffect(() => {
    if (showAddForm) {
      setAddDate(getTodayInTimezone(progress?.timezone ?? undefined));
      setAddWeight('');
      setAddCalories('');
      setAddBodyFat('');
      setAddWaist('');
      setAddHip('');
      setAddError(null);
      setAddDuplicateDate(null);
      addFormFirstInputRef.current?.focus({ preventScroll: true });
    } else {
      addFormButtonRef.current?.focus({ preventScroll: true });
    }
  }, [showAddForm]);

  const handleAddSubmit = useCallback(
    async (e: FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      if (!progress) return;
      setAddError(null);
      setAddDuplicateDate(null);
      const units = progress.units;
      let weightKgNum = Number(addWeight);
      if (units === 'imperial') weightKgNum = lbToKg(weightKgNum);
      if (Number.isNaN(weightKgNum) || weightKgNum <= 0 || weightKgNum > 500) {
        setAddError(copy.pleaseEnterValidWeight);
        return;
      }
      const body: CreateEntryRequest = {
        date: addDate,
        weight_kg: weightKgNum,
      };
      if (addCalories.trim() !== '') {
        const cal = Number(addCalories);
        if (!Number.isNaN(cal) && cal >= 0 && cal <= 10000) body.calories = cal;
      }
      if (addOptionalOpen) {
        let w = Number(addWaist);
        let h = Number(addHip);
        if (units === 'imperial') {
          w = inToCm(w);
          h = inToCm(h);
        }
        if (!Number.isNaN(w) && w > 0 && w <= 200) body.waist_cm = w;
        if (!Number.isNaN(h) && h > 0 && h <= 200) body.hip_cm = h;
      }
      const bf = addBodyFat.trim() !== '' ? Number(addBodyFat) : NaN;
      const hasBodyFat = !Number.isNaN(bf) && bf >= 0 && bf <= 100;
      setAddSubmitting(true);
      try {
        const newEntry = await createEntry(userId, body);
        if (hasBodyFat) {
          await upsertOptionalMetric(userId, addDate, bf);
        }
        setEntries((prev) => [...prev, newEntry].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()));
        const [p, om] = await Promise.all([getProgress(userId), getOptionalMetrics(userId)]);
        setProgress(p);
        const map: Record<string, number> = {};
        for (const m of om) {
          if (m.body_fat_percent != null) map[m.date] = m.body_fat_percent;
        }
        setBodyFatByDate(map);
        setShowAddForm(false);
        setLocalSuccess(copy.weighInAdded);
        window.setTimeout(() => setLocalSuccess(null), 2500);
        onEntryUpdated?.();
      } catch (err) {
        const msg = err instanceof Error ? err.message : copy.failedToSaveWeighIn;
        if (msg.includes('already exists') || msg.includes('Entry already')) {
          setAddDuplicateDate(addDate);
        } else {
          setAddError(msg);
        }
      } finally {
        setAddSubmitting(false);
      }
    },
    [userId, progress, addDate, addWeight, addCalories, addOptionalOpen, addWaist, addHip, addBodyFat, onEntryUpdated]
  );

  const handleEditSubmit = useCallback(
    async (e: FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      if (!editingEntry || !progress) return;
      setEditError(null);
      const u = progress.units;
      let weightKg = Number(editWeight);
      if (u === 'imperial') weightKg = lbToKg(weightKg);
      if (Number.isNaN(weightKg) || weightKg <= 0 || weightKg > 500) {
        setEditError(copy.pleaseEnterValidWeight);
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
      const prevEntries = entries;
      const optimisticEntry = { ...editingEntry, weight_kg: body.weight_kg, calories: body.calories, waist_cm: body.waist_cm, hip_cm: body.hip_cm };
      setEntries((prev) => prev.map((e) => (e.id === editingEntry.id ? optimisticEntry : e)));
      setEditingEntry(null);
      try {
        await updateEntry(userId, editingEntry.id, body);
        onEntryUpdated?.();
        setLocalSuccess(copy.updated);
        window.setTimeout(() => setLocalSuccess(null), 2500);
      } catch (err) {
        setEntries(prevEntries);
        setEditingEntry(editingEntry);
        setEditError(err instanceof Error ? err.message : copy.failedToUpdateEntry);
      } finally {
        setEditSaving(false);
      }
    },
    [editingEntry, progress, editWeight, editCalories, editWaist, editHip, userId, onEntryUpdated, entries]
  );

  const handleDeleteConfirm = useCallback(async () => {
    if (!editingEntry) return;
    setEditError(null);
    setEditSaving(true);
    setShowDeleteConfirm(false);
    const prevEntries = entries;
    const entryToRemove = editingEntry;
    setEntries((prev) => prev.filter((e) => e.id !== entryToRemove.id));
    setEditingEntry(null);
    try {
      await deleteEntry(userId, entryToRemove.id);
      onEntryUpdated?.();
      setLocalSuccess(copy.entryRemoved);
      window.setTimeout(() => setLocalSuccess(null), 2500);
    } catch (err) {
      setEntries(prevEntries);
      setEditError(err instanceof Error ? err.message : copy.failedToDeleteEntry);
    } finally {
      setEditSaving(false);
    }
  }, [editingEntry, userId, onEntryUpdated, entries]);

  useEffect(() => {
    if (!showDeleteConfirm) return;
    cancelConfirmRef.current?.focus();
    const container = dialogContentRef.current;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setShowDeleteConfirm(false);
        deleteButtonRef.current?.focus();
        return;
      }
      if (e.key !== 'Tab' || !container) return;
      const focusable = container.querySelectorAll<HTMLElement>('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey) {
        if (document.activeElement === first) {
          e.preventDefault();
          last?.focus();
        }
      } else {
        if (document.activeElement === last) {
          e.preventDefault();
          first?.focus();
        }
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [showDeleteConfirm]);

  const sortedEntries = [...entries].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
  );

  if (loading) {
    return <PageLoading title={copy.progress} />;
  }

  if (sortedEntries.length === 0) {
    return (
      <section className="app__card empty-state" aria-label="Progress">
        <EmptyStateIllustration />
        <h2 className="empty-state__title">{copy.emptyHistoryTitle}</h2>
        <p className="empty-state__text">
          {copy.emptyHistoryText}
        </p>
        <Link to="/home" className="btn btn--primary btn--inline">
          {copy.logFirstWeighIn}
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
  const chartTakeaway = progress?.messages?.trend_message
    ? progress.messages.trend_message.trim()
    : (() => {
        if (!progress || sortedEntries.length === 0) return '';
        const trend = progress.weight_trend_kg_per_week;
        const n = sortedEntries.length;
        const goalStr = goalKg != null ? ` Goal: ${formatWeight(goalKg, progress.units)}.` : '';
        if (trend == null) {
          return `${n} entries, ${formatWeight(minW, progress.units)} to ${formatWeight(maxW, progress.units)}.${goalStr}`;
        }
        const absTrend = Math.abs(trend);
        const trendPhrase =
          absTrend < 0.02 ? 'Stable.' : `${trend < 0 ? 'Losing' : 'Gaining'} ${formatTrendMagnitude(absTrend, progress.units)}.`;
        return `${trendPhrase} ${n} entries, ${formatWeight(minW, progress.units)} to ${formatWeight(maxW, progress.units)}.${goalStr}`;
      })();
  const lastEntry = sortedEntries.length > 0 ? sortedEntries[sortedEntries.length - 1] : null;
  const startWeightKg = firstEntry?.weight_kg;
  const currentWeightKg = lastEntry?.weight_kg ?? progress?.current_weight_kg;
  const hasTrendFromBackend = Boolean(progress?.messages?.trend_message);
  const chartRangeSentence = (() => {
    if (!hasTrendFromBackend || !progress || sortedEntries.length === 0 || startWeightKg == null || currentWeightKg == null) return '';
    const n = sortedEntries.length;
    const goalStr = goalKg != null ? ` Your goal is ${formatWeight(goalKg, progress.units)}.` : '';
    const diff = Math.abs(startWeightKg - currentWeightKg);
    if (diff < 0.1) {
      return `You've stayed around ${formatWeight(currentWeightKg, progress.units)} over ${n} weigh-ins.${goalStr}`;
    }
    return `You've gone from ${formatWeight(startWeightKg, progress.units)} to ${formatWeight(currentWeightKg, progress.units)} over ${n} weigh-ins.${goalStr}`;
  })();
  const chartSummaryAria = [chartTakeaway, chartRangeSentence].filter(Boolean).join(' ');

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
      <h2 className="app__card-title app__card-title--lg">Progress</h2>
      <figure className="chart-wrap" role="img" aria-label={chartSummaryAria || chartTakeaway || 'Weight over time with goal line and trend'}>
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
        <figcaption className="progress-text mt-1 text-xs">
          {chartTakeaway && <span>{chartTakeaway}</span>}
          {chartRangeSentence && <span> {chartRangeSentence}</span>}
          {progress?.trend_entries_count != null && progress.trend_entries_count >= 2 && (
            <span className="chart-figcaption-note">
              {' '}
              {trendLinePoints
                ? `This trend is based on your last ${progress.trend_entries_count} weigh-ins, and the dashed line shows where you're headed if you keep this pace.`
                : `This trend is based on your last ${progress.trend_entries_count} weigh-ins.`}
            </span>
          )}
        </figcaption>
      </figure>
      {progress?.pace_status && (
        <p className="mt-1 mb-2" role="status">
          <span className={`pace-badge pace-badge--${progress.pace_status}`} aria-label={`Pace: ${progress.pace_status.replace('_', ' ')}`}>
            {progress.pace_status === 'ahead' ? copy.paceAhead : progress.pace_status === 'on_track' ? copy.paceOnTrack : progress.pace_status === 'slightly_behind' ? copy.paceSlightlyBehind : copy.paceBehind}
          </span>
        </p>
      )}
      {progress?.estimated_goal_date && progress?.progress_percent != null && progress.progress_percent < 100 && (
        <div className="goal-timeline mb-2" role="status" aria-label="Goal timeline">
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
        <p className="progress-text mt-1 mb-2" role="status">
          {progress.messages?.goal_date_message ?? (progress.estimated_goal_date
            ? `At this pace, you could reach your goal around ${new Date(progress.estimated_goal_date + 'T12:00:00').toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}. That's based on your recent weigh-in trend.`
            : progress.estimated_goal_message ?? '')}
        </p>
      )}
      {progress?.messages?.recovery_message && (
        <p className="progress-text mt-1 mb-2" role="status">
          {progress.messages.recovery_message}
        </p>
      )}
      {progress?.messages?.uncertainty_message && (
        <p className="progress-text mt-1 mb-2 text-sm" role="status">
          {progress.messages.uncertainty_message}
        </p>
      )}
      {progress && (
        <>
          <details className="progress-text mt-3 text-sm">
            <summary className="details-summary">{copy.progressDetails}</summary>
            <div className="mt-2">
              {progress.lean_mass_kg != null && (
                <p className="mb-2">
                  {copy.leanMass}: {formatWeight(progress.lean_mass_kg, progress.units)} ({progress.lean_mass_is_estimated ? copy.leanMassEstimated : copy.leanMassYouSet}).
                </p>
              )}
              {progress.estimated_body_fat_percent != null && (
                <p className="mb-2">
                  {copy.estimatedBodyFatFromWeight(progress.estimated_body_fat_percent)}
                </p>
              )}
              <p className="mb-0">
                {copy.howWeCalculateFull}
              </p>
            </div>
          </details>
          <p className="mt-2 mb-0">
            <Link to="/settings" className="btn btn--secondary btn--sm">
              {copy.changeGoalInSettings}
            </Link>
          </p>
        </>
      )}
      <h3 className="app__card-title app__card-title--lg mt-6">Weight history</h3>
      <section className="history-add-entry-bar mt-2 mb-4" aria-label="Add weigh-in">
        {!showAddForm ? (
          <>
            <button
              type="button"
              ref={addFormButtonRef}
              className="btn btn--primary btn--sm"
              onClick={() => setShowAddForm(true)}
            >
              {copy.addWeighIn}
            </button>
            <p className="history-add-entry-bar__hint">Add a weigh-in for any date.</p>
          </>
        ) : (
          <div className="history-add-form">
            <h4 className="app__card-title app__card-title--sm mb-3">New weigh-in</h4>
            {addError && (
              <div className="app__error mb-3" role="alert">
                {addError}
              </div>
            )}
            {addDuplicateDate && (
              <p className="form-error mb-3" role="alert">
                {copy.alreadyWeighInFor(addDuplicateDate)} <button type="button" className="btn btn--sm ml-1" onClick={() => { setEditingEntry(entries.find((e) => e.date === addDuplicateDate) ?? null); setAddDuplicateDate(null); setShowAddForm(false); }}>{copy.editItInstead}</button>
              </p>
            )}
            <form onSubmit={handleAddSubmit} noValidate>
              <fieldset className="fieldset-reset" disabled={addSubmitting} aria-busy={addSubmitting}>
                <FieldInput
                  ref={addFormFirstInputRef}
                  id="add-entry-date"
                  label="Date"
                  type="date"
                  value={addDate}
                  onChange={(e) => setAddDate(e.target.value)}
                  max={getTodayInTimezone(progress?.timezone ?? undefined)}
                  required
                />
                <FieldInput
                  id="add-entry-weight"
                  label={`Weight (${progress?.units === 'imperial' ? 'lb' : 'kg'})`}
                  type="number"
                  min={progress?.units === 'imperial' ? 20 : 1}
                  max={progress?.units === 'imperial' ? 1100 : 500}
                  step={0.1}
                  placeholder={progress?.units === 'imperial' ? '176.4' : '75.0'}
                  value={addWeight}
                  onChange={(e) => setAddWeight(e.target.value)}
                  required
                />
                <FieldInput
                  id="add-entry-calories"
                  label="Calories (optional)"
                  type="number"
                  min={0}
                  max={10000}
                  step={1}
                  placeholder="2000"
                  value={addCalories}
                  onChange={(e) => setAddCalories(e.target.value)}
                />
                <p className="form-hint mb-2 text-sm">Optional: body fat %, waist, hip</p>
                <div className="collapsible">
                  <button
                    type="button"
                    className="collapsible__trigger"
                    onClick={() => setAddBodyFatOpen(!addBodyFatOpen)}
                    aria-expanded={addBodyFatOpen}
                  >
                    Optional: body fat %
                    <span className="collapsible__chevron" aria-hidden>▼</span>
                  </button>
                  <div className="collapsible__content" hidden={!addBodyFatOpen}>
                    <div className="collapsible__inner">
                      <FieldInput
                        id="add-entry-bodyfat"
                        label="Body fat (%)"
                        type="number"
                        min={0}
                        max={100}
                        step={0.1}
                        placeholder="e.g. 22"
                        value={addBodyFat}
                        onChange={(e) => setAddBodyFat(e.target.value)}
                      />
                    </div>
                  </div>
                </div>
                <div className="collapsible">
                  <button
                    type="button"
                    className="collapsible__trigger"
                    onClick={() => setAddOptionalOpen(!addOptionalOpen)}
                    aria-expanded={addOptionalOpen}
                  >
                    Optional: waist / hip
                    <span className="collapsible__chevron" aria-hidden>▼</span>
                  </button>
                  <div className="collapsible__content" hidden={!addOptionalOpen}>
                    <div className="collapsible__inner">
                      <FieldInput
                        id="add-entry-waist"
                        label={`Waist (${progress?.units === 'imperial' ? 'in' : 'cm'})`}
                        type="number"
                        min={1}
                        max={200}
                        step={0.1}
                        placeholder="80"
                        value={addWaist}
                        onChange={(e) => setAddWaist(e.target.value)}
                      />
                      <FieldInput
                        id="add-entry-hip"
                        label={`Hip (${progress?.units === 'imperial' ? 'in' : 'cm'})`}
                        type="number"
                        min={1}
                        max={200}
                        step={0.1}
                        placeholder="95"
                        value={addHip}
                        onChange={(e) => setAddHip(e.target.value)}
                      />
                    </div>
                  </div>
                </div>
                <div className="form-actions mt-4">
                  <button type="submit" className={`btn btn--primary ${addSubmitting ? 'btn--loading' : ''}`} disabled={addSubmitting} aria-busy={addSubmitting}>
                    {addSubmitting ? copy.saving : copy.saveWeighIn}
                  </button>
                  <button
                    type="button"
                    className="btn btn--secondary"
                    onClick={() => { setShowAddForm(false); setAddError(null); setAddDuplicateDate(null); }}
                    disabled={addSubmitting}
                  >
                    {copy.cancel}
                  </button>
                </div>
              </fieldset>
            </form>
          </div>
        )}
      </section>
      {localSuccess && (
        <p className="app__success mt-2 mb-0" role="status">
          {localSuccess}
        </p>
      )}
      {editingEntry && progress && (
        <section className="app__card mt-4" aria-label={copy.editEntry}>
          <h4 className="app__card-title app__card-title--sm">{copy.editEntry} ({editingEntry.date})</h4>
          {editError && <div className="app__error mb-3" role="alert">{editError}</div>}
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
                {editSaving ? copy.saving : 'Save'}
              </button>
              <button type="button" className="btn btn--secondary" onClick={() => setEditingEntry(null)} disabled={editSaving}>
                {copy.cancel}
              </button>
              <button type="button" className="btn btn--secondary btn--danger" onClick={() => setShowDeleteConfirm(true)} disabled={editSaving} ref={deleteButtonRef}>
                {copy.deleteEntry}
              </button>
            </div>
          </form>
        </section>
      )}
      {showDeleteConfirm && editingEntry && (
        <div className="dialog-overlay" role="dialog" aria-modal="true" aria-labelledby="delete-dialog-title" aria-describedby="delete-dialog-desc">
          <div className="dialog-overlay__content app__card" ref={dialogContentRef}>
            <h2 id="delete-dialog-title" className="app__card-title app__card-title--first">{copy.deleteEntryTitle}</h2>
            <p id="delete-dialog-desc" className="progress-text">
              {copy.deleteEntryConfirm(editingEntry.date)}
            </p>
            <div className="form-actions">
              <button type="button" className="btn btn--primary btn--danger" onClick={handleDeleteConfirm} disabled={editSaving}>
                {editSaving ? copy.deleting : copy.deleteEntry}
              </button>
              <button type="button" className="btn btn--secondary" ref={cancelConfirmRef} onClick={() => { setShowDeleteConfirm(false); deleteButtonRef.current?.focus(); }} disabled={editSaving}>
                {copy.cancel}
              </button>
            </div>
          </div>
        </div>
      )}
      <div className="entry-list-wrap">
      <ul className="entry-list">
        {[...sortedEntries].reverse().map((e) => {
          const weightStr = progress ? formatWeight(e.weight_kg, progress.units) : `${e.weight_kg} kg`;
          const calStr = e.calories != null ? `${e.calories} kcal` : 'no calories';
          const bfStr = bodyFatByDate[e.date] != null ? `${bodyFatByDate[e.date]}% body fat` : 'no body fat';
          const rowLabel = `Weigh-in ${e.date}, ${weightStr}, ${calStr}, ${bfStr}. Click to edit.`;
          return (
          <li key={e.id}>
            <button
              type="button"
              className="entry-row"
              aria-label={rowLabel}
              onClick={(ev) => { editTriggerRef.current = ev.currentTarget; setEditingEntry(e); }}
            >
              <span>{e.date}</span>
              <span className="entry-row__weight">{progress ? formatWeight(e.weight_kg, progress.units) : `${e.weight_kg} kg`}</span>
              <span className="entry-row__calories">{e.calories != null ? `${e.calories} kcal` : '—'}</span>
              <span className="entry-row__bf">{bodyFatByDate[e.date] != null ? `${bodyFatByDate[e.date]}% BF` : '—'}</span>
            </button>
          </li>
          );
        })}
      </ul>
      </div>
    </section>
    </>
  );
}
