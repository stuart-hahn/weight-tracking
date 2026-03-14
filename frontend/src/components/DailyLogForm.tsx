import { useState, useCallback, FormEvent, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { getProgress, getEntries, updateEntry } from '../api/client';
import type { CreateEntryRequest, ProgressResponse, DailyEntryResponse } from '../types/api';
import { formatWeight, formatTrend, formatWeightChange, lbToKg, kgToLb, inToCm } from '../utils/units';
import { getTodayInTimezone, getYesterdayInTimezone } from '../utils/date';
import ProgressSummary from './ProgressSummary';
import { FieldInput } from './Field';

export interface OptionalBodyFatSubmit {
  date: string;
  body_fat_percent: number;
}

export type DailyLogFormVariant = 'full' | 'home';

interface DailyLogFormProps {
  onSubmit: (body: CreateEntryRequest, optionalBodyFat?: OptionalBodyFatSubmit) => Promise<void>;
  onError?: (message: string | null) => void;
  userId: string;
  /** Increment to refetch progress (e.g. after saving an entry) */
  refreshTrigger?: number;
  /** 'home' = compact progress summary + today; 'full' = full progress card (e.g. on History) */
  variant?: DailyLogFormVariant;
}

export default function DailyLogForm({ onSubmit, onError, userId, refreshTrigger = 0, variant = 'full' }: DailyLogFormProps) {
  const [date, setDate] = useState(() => getTodayInTimezone());
  const [weightKg, setWeightKg] = useState('');
  const [calories, setCalories] = useState('');
  const [optionalOpen, setOptionalOpen] = useState(false);
  const [bodyFatOpen, setBodyFatOpen] = useState(false);
  const [bodyFatPercent, setBodyFatPercent] = useState('');
  const [waistCm, setWaistCm] = useState('');
  const [hipCm, setHipCm] = useState('');
  const [progress, setProgress] = useState<ProgressResponse | null>(null);
  const [progressError, setProgressError] = useState(false);
  const [retryTrigger, setRetryTrigger] = useState(0);
  const [weightError, setWeightError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [duplicateDate, setDuplicateDate] = useState<string | null>(null);
  const [savedMessage, setSavedMessage] = useState<string | null>(null);
  const [showFormForOtherDate, setShowFormForOtherDate] = useState(false);
  const [showEditTodayForm, setShowEditTodayForm] = useState(false);
  const [todayEntry, setTodayEntry] = useState<DailyEntryResponse | null>(null);
  const [editTodayWeight, setEditTodayWeight] = useState('');
  const [editTodayCalories, setEditTodayCalories] = useState('');
  const [editTodaySaving, setEditTodaySaving] = useState(false);
  const [editTodayError, setEditTodayError] = useState<string | null>(null);
  const prevProgressRef = useRef<ProgressResponse | null>(null);

  useEffect(() => {
    let cancelled = false;
    setProgressError(false);
    getProgress(userId)
      .then((p) => {
        if (!cancelled) {
          setProgress(p);
          setProgressError(false);
        }
      })
      .catch(() => {
        if (!cancelled) setProgressError(true);
      });
    return () => { cancelled = true; };
  }, [userId, refreshTrigger, retryTrigger]);

  const units = progress?.units ?? 'metric';
  const handleSubmit = useCallback(
    async (e: FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      setWeightError(null);
      let weightKgNum = Number(weightKg);
      if (units === 'imperial') weightKgNum = lbToKg(weightKgNum);
      if (Number.isNaN(weightKgNum) || weightKgNum <= 0 || weightKgNum > 500) {
        setWeightError('Please enter a valid weight.');
        return;
      }
      const body: CreateEntryRequest = {
        date,
        weight_kg: weightKgNum,
      };
      if (calories.trim() !== '') {
        const cal = Number(calories);
        if (!Number.isNaN(cal) && cal >= 0 && cal <= 10000) body.calories = cal;
      }
      if (optionalOpen) {
        let w = Number(waistCm);
        let h = Number(hipCm);
        if (units === 'imperial') {
          w = inToCm(w);
          h = inToCm(h);
        }
        if (!Number.isNaN(w) && w > 0 && w <= 200) body.waist_cm = w;
        if (!Number.isNaN(h) && h > 0 && h <= 200) body.hip_cm = h;
      }
      const bf = bodyFatPercent.trim() !== '' ? Number(bodyFatPercent) : NaN;
      const optionalBodyFat: OptionalBodyFatSubmit | undefined =
        !Number.isNaN(bf) && bf >= 0 && bf <= 100 ? { date, body_fat_percent: bf } : undefined;
      setDuplicateDate(null);
      setSavedMessage(null);
      setSubmitting(true);
      if (progress) {
        prevProgressRef.current = progress;
        const goalKg = progress.goal_weight_kg;
        const startKg = progress.start_weight_kg;
        const newPercent =
          goalKg != null && startKg !== goalKg
            ? Math.min(100, Math.max(0, ((weightKgNum - startKg) / (goalKg - startKg)) * 100))
            : progress.progress_percent;
        setProgress({
          ...progress,
          current_weight_kg: weightKgNum,
          latest_entry_date: date,
          entries_count: progress.entries_count + 1,
          progress_percent: newPercent ?? 0,
        });
      }
      try {
        await onSubmit(body, optionalBodyFat);
        setSavedMessage('Got it. Your progress is updated.');
        window.setTimeout(() => setSavedMessage(null), 3000);
      } catch (err) {
        if (prevProgressRef.current) {
          setProgress(prevProgressRef.current);
          prevProgressRef.current = null;
        }
        const msg = err instanceof Error ? err.message : 'Failed to save entry';
        if (msg.includes('already exists') || msg.includes('Entry already')) {
          setDuplicateDate(date);
          onError?.(null);
        } else {
          onError?.(msg);
        }
      } finally {
        setSubmitting(false);
      }
    },
    [date, weightKg, calories, optionalOpen, waistCm, hipCm, bodyFatPercent, units, progress, onSubmit, onError]
  );

  const handleEditTodaySubmit = useCallback(
    async (e: FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      if (!todayEntry || !progress) return;
      setEditTodayError(null);
      const u = progress.units;
      let weightKgNum = Number(editTodayWeight);
      if (u === 'imperial') weightKgNum = lbToKg(weightKgNum);
      if (Number.isNaN(weightKgNum) || weightKgNum <= 0 || weightKgNum > 500) {
        setEditTodayError('Please enter a valid weight.');
        return;
      }
      const cal = editTodayCalories.trim() !== '' ? Number(editTodayCalories) : null;
      const caloriesVal = cal != null && !Number.isNaN(cal) && cal >= 0 && cal <= 10000 ? cal : null;
      setEditTodaySaving(true);
      try {
        await updateEntry(userId, todayEntry.id, {
          weight_kg: weightKgNum,
          calories: caloriesVal,
        });
        const p = await getProgress(userId);
        setProgress(p);
        setShowEditTodayForm(false);
        setTodayEntry(null);
      } catch (err) {
        setEditTodayError(err instanceof Error ? err.message : 'Failed to update.');
      } finally {
        setEditTodaySaving(false);
      }
    },
    [todayEntry, progress, editTodayWeight, editTodayCalories, userId]
  );

  const progressPercent =
    progress?.progress_percent != null ? progress.progress_percent : 0;

  const hasEntryToday =
    progress?.latest_entry_date != null &&
    progress.latest_entry_date === getTodayInTimezone(progress?.timezone ?? undefined);

  const todayIso = progress ? getTodayInTimezone(progress.timezone ?? undefined) : '';
  useEffect(() => {
    if (!showEditTodayForm || !userId || !progress || !hasEntryToday || variant !== 'home') return;
    let cancelled = false;
    getEntries(userId)
      .then((entries) => {
        if (cancelled) return;
        const today = entries.find((e) => e.date === todayIso);
        if (today) {
          setTodayEntry(today);
          const u = progress.units;
          setEditTodayWeight(u === 'imperial' ? String(Math.round(kgToLb(today.weight_kg) * 10) / 10) : String(today.weight_kg));
          setEditTodayCalories(today.calories != null ? String(today.calories) : '');
        }
      })
      .catch(() => { if (!cancelled) setTodayEntry(null); });
    return () => { cancelled = true; };
  }, [showEditTodayForm, userId, progress, hasEntryToday, variant, todayIso]);

  return (
    <>
      {progress === null && progressError && (
        <section className="app__card" aria-label="Progress load error" role="alert">
          <p className="progress-text">We couldn&apos;t load your progress. Check your connection and try again.</p>
          <button
            type="button"
            className="btn btn--primary"
            style={{ marginTop: '0.75rem' }}
            onClick={() => setRetryTrigger((t) => t + 1)}
          >
            Retry
          </button>
        </section>
      )}
      {progress === null && !progressError && (
        <section className="app__card" aria-label="Loading progress" aria-busy="true">
          <div className="skeleton skeleton-line" style={{ width: '6rem', height: '1rem', marginBottom: '0.75rem' }} aria-hidden />
          <div className="skeleton skeleton-line" style={{ width: '100%', marginBottom: '0.5rem' }} aria-hidden />
          <div className="skeleton skeleton-line skeleton-line--short" style={{ marginBottom: '0.75rem' }} aria-hidden />
          <div className="progress-bar" style={{ marginTop: '0.5rem' }}>
            <div className="skeleton" style={{ height: '8px', width: '40%', borderRadius: '4px' }} aria-hidden />
          </div>
        </section>
      )}
      {progress !== null && !hasEntryToday && (
        <section className="app__card retention-banner" role="status" aria-live="polite">
          <p className="retention-banner__text">
            {progress.messages?.streak_message ?? progress.messages?.retention_message ?? "You haven't logged today yet. Adding a weigh-in will keep your trend and weekly summary up to date."}
          </p>
        </section>
      )}
      {progress !== null && variant === 'home' && (
        <ProgressSummary
          progress={progress}
          userId={userId}
          onGoalUpdated={() => getProgress(userId).then(setProgress)}
        />
      )}
      {progress !== null && variant === 'full' && (
        <section className="app__card" aria-label="Progress summary, pace, and goal estimate">
          <h2 className="app__card-title">Progress</h2>
          <p className="progress-text">
            Current: {formatWeight(progress.current_weight_kg, progress.units)} · Goal: {formatWeight(progress.goal_weight_kg, progress.units)} ·{' '}
            {progress.entries_count} entries
            {progress.weight_trend_kg_per_week != null && !progress.messages?.trend_message && (
              <> · {formatTrend(progress.weight_trend_kg_per_week, progress.units)}</>
            )}
          </p>
          {progress.messages?.progress_celebration && (
            <p className="progress-text" style={{ marginTop: '0.5rem' }} role="status">
              {progress.messages.progress_celebration}
            </p>
          )}
          <div className="progress-bar" role="progressbar" aria-valuenow={progressPercent} aria-valuemin={0} aria-valuemax={100}>
            <div
              className="progress-bar__fill"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
          {progress.pace_status && (
            <p style={{ marginTop: '0.5rem' }} role="status">
              <span className={`pace-badge pace-badge--${progress.pace_status}`} aria-label={`Pace: ${progress.pace_status.replace('_', ' ')}`}>
                {progress.pace_status === 'ahead' ? 'Ahead of pace' : progress.pace_status === 'on_track' ? 'On track' : progress.pace_status === 'slightly_behind' ? 'A bit behind' : 'Behind'}
              </span>
            </p>
          )}
          {progress.messages?.trend_message && (
            <p className="progress-text" style={{ marginTop: '0.5rem' }} role="status">
              {progress.messages.trend_message}
            </p>
          )}
          {(progress.messages?.daily_calorie_message ?? (progress.recommended_calories_min != null && progress.recommended_calories_max != null)) && (
            <p className="progress-text" style={{ marginTop: '0.75rem' }}>
              {progress.messages?.daily_calorie_message ?? `Staying around ${progress.recommended_calories_min}–${progress.recommended_calories_max} kcal/day can keep you on track.`}
            </p>
          )}
          {(progress.messages?.weekly_message ?? progress.weekly_summary?.message) && (
            <p className="progress-text" style={{ marginTop: '0.5rem' }}>
              {progress.messages?.weekly_message ?? (progress.weekly_summary!.weight_change_kg != null
                ? `This week: ${formatWeightChange(progress.weekly_summary!.weight_change_kg, progress.units)}. ${progress.weekly_summary!.on_track ? "You're on track." : 'A small change could help—see the suggestion below.'}`
                : progress.weekly_summary!.message)}
            </p>
          )}
          {(progress.messages?.goal_date_message ?? progress.estimated_goal_date ?? progress.estimated_goal_message) && (
            <p className="progress-text" style={{ marginTop: '0.5rem' }} role="status">
              {progress.messages?.goal_date_message ?? (progress.estimated_goal_date
                ? `Estimated to reach goal: ${new Date(progress.estimated_goal_date + 'T12:00:00').toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}.${progress.estimate_basis ? ` ${progress.estimate_basis}` : ''}`
                : progress.estimated_goal_message ?? '')}
            </p>
          )}
          {progress.messages?.recovery_message && (
            <p className="progress-text" style={{ marginTop: '0.5rem' }} role="status">
              {progress.messages.recovery_message}
            </p>
          )}
          {progress.messages?.uncertainty_message && (
            <p className="progress-text" style={{ marginTop: '0.5rem', fontSize: '0.9rem' }} role="status">
              {progress.messages.uncertainty_message}
            </p>
          )}
          {progress.estimated_goal_date && progressPercent != null && progressPercent < 100 && (
            <div className="goal-timeline" role="status" aria-label="Goal timeline">
              <div className="goal-timeline__bar">
                <span className="goal-timeline__marker goal-timeline__marker--start" aria-hidden />
                <span className="goal-timeline__marker goal-timeline__marker--now" style={{ left: `${progressPercent}%` }} aria-hidden />
                <span className="goal-timeline__marker goal-timeline__marker--goal" aria-hidden />
              </div>
              <div className="goal-timeline__labels">
                <span>Start</span>
                <span>Now ({Math.round(progressPercent)}%)</span>
                <span>Goal ~{new Date(progress.estimated_goal_date + 'T12:00:00').toLocaleDateString(undefined, { month: 'short', year: '2-digit' })}</span>
              </div>
            </div>
          )}
          {progress.lean_mass_kg != null && (
            <p className="progress-text" style={{ marginTop: '0.5rem' }}>
              Lean mass: {formatWeight(progress.lean_mass_kg, progress.units)} ({progress.lean_mass_is_estimated ? 'we estimated this from your profile' : 'you set'}).
            </p>
          )}
          {progress.estimated_body_fat_percent != null && (
            <p className="progress-text" style={{ marginTop: '0.5rem' }}>
              Estimated body fat: {progress.estimated_body_fat_percent.toFixed(1)}%—based on your current weight and lean mass.
            </p>
          )}
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
        </section>
      )}

      {progress !== null && hasEntryToday && !showFormForOtherDate ? (
        <section className="app__card" aria-labelledby="today-entry-heading">
          <h2 id="today-entry-heading" className="app__card-title">
            Today&apos;s entry
          </h2>
          <p className="progress-text">
            You logged {formatWeight(progress.current_weight_kg, progress.units)} for today.
          </p>
          {progress.entries_count === 1 && (
            <p className="progress-text" style={{ marginTop: '0.5rem' }} role="status">
              You&apos;re off to a good start. Log again when you can to see your trend.
            </p>
          )}
          {variant === 'home' && !showEditTodayForm && (
            <p style={{ marginTop: '1rem' }}>
              <button
                type="button"
                className="btn btn--primary"
                style={{ display: 'inline-block', width: 'auto', paddingLeft: '1.25rem', paddingRight: '1.25rem' }}
                onClick={() => setShowEditTodayForm(true)}
              >
                Update today&apos;s entry
              </button>
            </p>
          )}
          {variant === 'home' && showEditTodayForm && todayEntry && (
            <form onSubmit={handleEditTodaySubmit} noValidate style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid var(--border)' }}>
              {editTodayError && <p className="form-error" role="alert" style={{ marginBottom: '0.5rem' }}>{editTodayError}</p>}
              <FieldInput
                id="edit-today-weight"
                label={`Weight (${units === 'imperial' ? 'lb' : 'kg'})`}
                type="number"
                min={units === 'imperial' ? 20 : 1}
                max={units === 'imperial' ? 1100 : 500}
                step={0.1}
                value={editTodayWeight}
                onChange={(e) => setEditTodayWeight(e.target.value)}
              />
              <FieldInput
                id="edit-today-calories"
                label="Calories (optional)"
                type="number"
                min={0}
                max={10000}
                value={editTodayCalories}
                onChange={(e) => setEditTodayCalories(e.target.value)}
              />
              <div className="form-actions">
                <button type="submit" className="btn btn--primary" disabled={editTodaySaving}>
                  {editTodaySaving ? 'Saving…' : 'Save'}
                </button>
                <button type="button" className="btn btn--secondary" onClick={() => { setShowEditTodayForm(false); setTodayEntry(null); setEditTodayError(null); }} disabled={editTodaySaving}>
                  Cancel
                </button>
              </div>
            </form>
          )}
          {variant === 'home' && showEditTodayForm && !todayEntry && (
            <p className="progress-text" style={{ marginTop: '1rem' }}>Loading…</p>
          )}
          {variant !== 'home' && (
            <p style={{ marginTop: '1rem' }}>
              <Link to="/history" state={{ editDate: getTodayInTimezone(progress?.timezone ?? undefined) }} className="btn btn--primary" style={{ display: 'inline-block', width: 'auto', paddingLeft: '1.25rem', paddingRight: '1.25rem' }}>
                Edit today&apos;s entry
              </Link>
            </p>
          )}
          <button
            type="button"
            className="btn btn--secondary"
            style={{ marginTop: '0.75rem' }}
            onClick={() => { setShowFormForOtherDate(true); setDate(getYesterdayInTimezone(progress?.timezone ?? undefined)); setShowEditTodayForm(false); setTodayEntry(null); }}
          >
            Log another date
          </button>
        </section>
      ) : (
      <section className="app__card" aria-labelledby="log-heading">
        <h2 id="log-heading" className="app__card-title">
          {hasEntryToday && showFormForOtherDate ? 'Log another date' : 'Log today'}
        </h2>
        <form onSubmit={handleSubmit} noValidate>
          <FieldInput
            id="log-date"
            label="Date"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            max={getTodayInTimezone(progress?.timezone ?? undefined)}
            required
          />
          <FieldInput
            id="log-weight"
            label={`Weight (${units === 'imperial' ? 'lb' : 'kg'})`}
            type="number"
            min={units === 'imperial' ? 20 : 1}
            max={units === 'imperial' ? 1100 : 500}
            step={0.1}
            placeholder={units === 'imperial' ? '176.4' : '75.0'}
            value={weightKg}
            onChange={(e) => { setWeightKg(e.target.value); setWeightError(null); }}
            error={weightError}
            required
          />
          {duplicateDate && (
            <p className="form-error" role="alert" style={{ marginTop: '0.5rem' }}>
              You&apos;ve already logged this date.{' '}
              <Link to="/history" state={{ editDate: duplicateDate }}>Edit that entry instead</Link>.
            </p>
          )}
          <FieldInput
            id="log-calories"
            label="Calories (optional)"
            type="number"
            min={0}
            max={10000}
            step={1}
            placeholder="2000"
            value={calories}
            onChange={(e) => setCalories(e.target.value)}
          />

          <p className="form-hint" style={{ marginBottom: '0.75rem' }}>
            Optional: body fat %, waist, hip. Expand below if you track these.
          </p>
          <div className="collapsible">
            <button
              type="button"
              className="collapsible__trigger"
              onClick={() => setBodyFatOpen(!bodyFatOpen)}
              aria-expanded={bodyFatOpen}
            >
              Optional: body fat %
              <span className="collapsible__chevron" aria-hidden>▼</span>
            </button>
            <div className="collapsible__content" hidden={!bodyFatOpen}>
              <div className="collapsible__inner">
                <FieldInput
                  id="log-bodyfat"
                  label="Body fat (%)"
                  type="number"
                  min={0}
                  max={100}
                  step={0.1}
                  placeholder="e.g. 22"
                  value={bodyFatPercent}
                  onChange={(e) => setBodyFatPercent(e.target.value)}
                />
              </div>
            </div>
          </div>

          <div className="collapsible">
            <button
              type="button"
              className="collapsible__trigger"
              onClick={() => setOptionalOpen(!optionalOpen)}
              aria-expanded={optionalOpen}
            >
              Optional: waist / hip
              <span className="collapsible__chevron" aria-hidden>▼</span>
            </button>
            <div className="collapsible__content" hidden={!optionalOpen}>
              <div className="collapsible__inner">
                <FieldInput
                  id="log-waist"
                  label={`Waist (${units === 'imperial' ? 'in' : 'cm'})`}
                  type="number"
                  min={1}
                  max={200}
                  step={0.1}
                  placeholder="80"
                  value={waistCm}
                  onChange={(e) => setWaistCm(e.target.value)}
                />
                <FieldInput
                  id="log-hip"
                  label={`Hip (${units === 'imperial' ? 'in' : 'cm'})`}
                  type="number"
                  min={1}
                  max={200}
                  step={0.1}
                  placeholder="95"
                  value={hipCm}
                  onChange={(e) => setHipCm(e.target.value)}
                />
              </div>
            </div>
          </div>

          <button type="submit" className="btn btn--primary form-actions__primary" disabled={submitting}>
            {submitting ? 'Saving…' : 'Save entry'}
          </button>
          {savedMessage && (
            <p className="app__success" style={{ marginTop: '1rem', marginBottom: 0 }} role="status">
              {savedMessage}{' '}
              <Link to="/history" className="app__title-link" style={{ fontSize: 'inherit', fontWeight: 600 }}>
                View progress
              </Link>
            </p>
          )}
        </form>
      </section>
      )}
    </>
  );
}
