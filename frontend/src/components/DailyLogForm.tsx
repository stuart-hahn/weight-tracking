import { useState, useCallback, FormEvent, useEffect, useRef } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Check } from 'lucide-react';
import { getProgress, getEntries, updateEntry } from '../api/client';
import type { CreateEntryRequest, ProgressResponse, DailyEntryResponse } from '../types/api';
import { formatWeight, lbToKg, kgToLb, inToCm } from '../utils/units';
import { getTodayInTimezone, getYesterdayInTimezone } from '../utils/date';
import { copy } from '../copy';
import ProgressSummary from './ProgressSummary';
import { FieldInput } from './Field';

export interface OptionalBodyFatSubmit {
  date: string;
  body_fat_percent: number;
}

export type DailyLogFormVariant = 'home';

interface DailyLogFormProps {
  onSubmit: (body: CreateEntryRequest, optionalBodyFat?: OptionalBodyFatSubmit) => Promise<void>;
  onError?: (message: string | null) => void;
  userId: string;
  /** Increment to refetch progress (e.g. after saving an entry) */
  refreshTrigger?: number;
  /** 'home' = compact progress summary + today; 'full' = full progress card (e.g. on History) */
  variant?: DailyLogFormVariant;
}

export default function DailyLogForm({ onSubmit, onError, userId, refreshTrigger = 0, variant = 'home' }: DailyLogFormProps) {
  const location = useLocation();
  const navigate = useNavigate();
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
  const [savedButtonFeedback, setSavedButtonFeedback] = useState(false);
  const [showFormForOtherDate, setShowFormForOtherDate] = useState(false);
  const [showEditTodayForm, setShowEditTodayForm] = useState(false);
  const [todayEntry, setTodayEntry] = useState<DailyEntryResponse | null>(null);
  const [editTodayWeight, setEditTodayWeight] = useState('');
  const [editTodayCalories, setEditTodayCalories] = useState('');
  const [editTodaySaving, setEditTodaySaving] = useState(false);
  const [editTodayError, setEditTodayError] = useState<string | null>(null);
  const prevProgressRef = useRef<ProgressResponse | null>(null);

  // When navigating from History "Add entry", open the "Log another date" form immediately
  useEffect(() => {
    const state = location.state as { openLogForm?: boolean } | null;
    if (variant === 'home' && state?.openLogForm) {
      setShowFormForOtherDate(true);
      setShowEditTodayForm(false);
      setTodayEntry(null);
      setDate(getYesterdayInTimezone(progress?.timezone ?? undefined));
      navigate(location.pathname, { replace: true, state: {} });
    }
  }, [variant, location.state, location.pathname, navigate, progress?.timezone]);

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
        setWeightError(copy.pleaseEnterValidWeight);
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
        setSavedMessage(copy.savedSuccess);
        setSavedButtonFeedback(true);
        window.setTimeout(() => setSavedMessage(null), 3000);
        window.setTimeout(() => setSavedButtonFeedback(false), 1800);
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
        setEditTodayError(copy.pleaseEnterValidWeight);
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
        setEditTodayError(err instanceof Error ? err.message : copy.failedToUpdate);
      } finally {
        setEditTodaySaving(false);
      }
    },
    [todayEntry, progress, editTodayWeight, editTodayCalories, userId]
  );

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

  const content = (
    <>
      {progress === null && progressError && (
        <section className="app__card" aria-label="Progress load error" role="alert">
          <p className="progress-text">{copy.progressLoadError}</p>
          <button
            type="button"
            className="btn btn--primary"
            style={{ marginTop: '0.75rem' }}
            onClick={() => setRetryTrigger((t) => t + 1)}
          >
            {copy.retry}
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
            {progress.messages?.streak_message ?? progress.messages?.retention_message ?? copy.todayWeighInWaiting}
          </p>
        </section>
      )}
      {progress !== null && (
        <ProgressSummary
          progress={progress}
          userId={userId}
          onGoalUpdated={() => getProgress(userId).then(setProgress)}
          hero
        />
      )}

      {progress !== null && hasEntryToday && !showFormForOtherDate ? (
        <section className="app__card" aria-labelledby="today-entry-heading">
          <h2 id="today-entry-heading" className="app__card-title">
            {copy.todayEntry}
          </h2>
          <p className="progress-text">
            {copy.youLogged} {formatWeight(progress.current_weight_kg, progress.units)} {copy.forToday}
          </p>
          {progress.entries_count === 1 && (
            <p className="progress-text" style={{ marginTop: '0.5rem' }} role="status">
              {copy.offToGoodStart}
            </p>
          )}
          {variant === 'home' && !showEditTodayForm && (
            <div className="form-actions home-card-actions">
              <button
                type="button"
                className="btn btn--primary btn--sm"
                onClick={() => { setShowFormForOtherDate(true); setDate(getYesterdayInTimezone(progress?.timezone ?? undefined)); setShowEditTodayForm(false); setTodayEntry(null); }}
              >
                {copy.logAnotherDate}
              </button>
              <button
                type="button"
                className="btn btn--secondary btn--sm"
                onClick={() => setShowEditTodayForm(true)}
              >
                {copy.updateTodaysEntry}
              </button>
            </div>
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
                  {copy.cancel}
                </button>
              </div>
            </form>
          )}
          {variant === 'home' && showEditTodayForm && !todayEntry && (
            <p className="progress-text" style={{ marginTop: '1rem' }}>Loading…</p>
          )}
          {variant !== 'home' && (
            <div className="form-actions home-card-actions">
              <Link to="/history" state={{ editDate: getTodayInTimezone(progress?.timezone ?? undefined) }} className="btn btn--primary btn--sm">
                {copy.editTodaysEntry}
              </Link>
              <Link to="/home" state={{ openLogForm: true }} className="btn btn--secondary btn--sm">
                {copy.logAnotherDate}
              </Link>
            </div>
          )}
          {variant === 'home' && !showEditTodayForm && (
            <p className="progress-text mt-4">
              {copy.missingDayHint}
            </p>
          )}
        </section>
      ) : (
      <section className="app__card" aria-labelledby="log-heading">
        <h2 id="log-heading" className="app__card-title">
          {hasEntryToday && showFormForOtherDate ? copy.logAnotherDate : copy.logToday}
        </h2>
        {hasEntryToday && showFormForOtherDate && (
          <p className="progress-text mb-3 text-sm" role="status">
            {copy.logAnotherDateHint} <strong>{date}</strong>. {copy.changeDateIfNeeded}
          </p>
        )}
        <form onSubmit={handleSubmit} noValidate>
          <fieldset disabled={submitting} aria-busy={submitting} style={{ border: 'none', margin: 0, padding: 0 }}>
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
              {copy.alreadyLoggedThisDate}{' '}
              <Link to="/history" state={{ editDate: duplicateDate }}>{copy.editThatEntryInstead}</Link>.
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
            {copy.optionalBodyFatHint}
          </p>
          <div className="collapsible">
            <button
              type="button"
              className="collapsible__trigger"
              onClick={() => setBodyFatOpen(!bodyFatOpen)}
              aria-expanded={bodyFatOpen}
            >
              {copy.optionalBodyFat}
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
              {copy.optionalWaistHip}
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

          <button type="submit" className={`btn btn--primary form-actions__primary ${submitting ? 'btn--loading' : ''} ${savedButtonFeedback ? 'btn--success' : ''}`} disabled={submitting} aria-busy={submitting}>
            {savedButtonFeedback ? (
              <>
                <Check size={20} aria-hidden className="btn__icon" />
                {copy.saved}
              </>
            ) : submitting ? (
              copy.saving
            ) : (
              copy.saveEntry
            )}
          </button>
          </fieldset>
          {savedMessage && (
            <p className="app__success" style={{ marginTop: '1rem', marginBottom: 0 }} role="status">
              {savedMessage}{' '}
              <Link to="/history" className="app__title-link" style={{ fontSize: 'inherit', fontWeight: 600 }}>
                {copy.viewProgress}
              </Link>
            </p>
          )}
        </form>
      </section>
      )}
    </>
  );

  return variant === 'home' ? (
    <div className="home-stagger">{content}</div>
  ) : (
    content
  );
}
