import { useState, useCallback, FormEvent, useEffect } from 'react';
import { getProgress } from '../api/client';
import type { CreateEntryRequest, ProgressResponse } from '../types/api';
import { formatWeight, formatTrend, formatWeightChange, lbToKg, inToCm } from '../utils/units';

interface DailyLogFormProps {
  onSubmit: (body: CreateEntryRequest) => void;
  userId: string;
  /** Increment to refetch progress (e.g. after saving an entry) */
  refreshTrigger?: number;
}

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

export default function DailyLogForm({ onSubmit, userId, refreshTrigger = 0 }: DailyLogFormProps) {
  const [date, setDate] = useState(todayISO);
  const [weightKg, setWeightKg] = useState('');
  const [calories, setCalories] = useState('');
  const [optionalOpen, setOptionalOpen] = useState(false);
  const [waistCm, setWaistCm] = useState('');
  const [hipCm, setHipCm] = useState('');
  const [progress, setProgress] = useState<ProgressResponse | null>(null);

  useEffect(() => {
    let cancelled = false;
    getProgress(userId)
      .then((p) => {
        if (!cancelled) setProgress(p);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [userId, refreshTrigger]);

  const units = progress?.units ?? 'metric';
  const handleSubmit = useCallback(
    (e: FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      let weightKgNum = Number(weightKg);
      if (units === 'imperial') weightKgNum = lbToKg(weightKgNum);
      if (Number.isNaN(weightKgNum) || weightKgNum <= 0 || weightKgNum > 500) return;
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
      onSubmit(body);
    },
    [date, weightKg, calories, optionalOpen, waistCm, hipCm, units, onSubmit]
  );

  const progressPercent =
    progress?.progress_percent != null ? progress.progress_percent : 0;

  return (
    <>
      {progress !== null && (
        <section className="app__card" aria-label="Progress summary">
          <h2 className="app__card-title">Progress</h2>
          <p className="progress-text">
            Current: {formatWeight(progress.current_weight_kg, progress.units)} · Goal: {formatWeight(progress.goal_weight_kg, progress.units)} ·{' '}
            {progress.entries_count} entries
            {progress.weight_trend_kg_per_week != null && (
              <> · {formatTrend(progress.weight_trend_kg_per_week, progress.units)}</>
            )}
          </p>
          <div className="progress-bar" role="progressbar" aria-valuenow={progressPercent} aria-valuemin={0} aria-valuemax={100}>
            <div
              className="progress-bar__fill"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
          {(progress.recommended_calories_min != null && progress.recommended_calories_max != null) && (
            <p className="progress-text" style={{ marginTop: '0.75rem' }}>
              Aim for {progress.recommended_calories_min}–{progress.recommended_calories_max} kcal/day
            </p>
          )}
          {progress.weekly_summary && (
            <p className="progress-text" style={{ marginTop: '0.5rem' }}>
              {progress.weekly_summary.weight_change_kg != null
                ? `This week: ${formatWeightChange(progress.weekly_summary.weight_change_kg, progress.units)}. ${progress.weekly_summary.on_track ? 'On track.' : 'Consider adjusting.'}`
                : progress.weekly_summary.message}
            </p>
          )}
        </section>
      )}

      <section className="app__card" aria-labelledby="log-heading">
        <h2 id="log-heading" className="app__card-title">
          Log today
        </h2>
        <form onSubmit={handleSubmit} noValidate>
          <div className="form-group">
            <label className="form-label" htmlFor="log-date">
              Date
            </label>
            <input
              id="log-date"
              type="date"
              className="form-input"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              required
            />
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor="log-weight">
              Weight ({units === 'imperial' ? 'lb' : 'kg'})
            </label>
            <input
              id="log-weight"
              type="number"
              className="form-input"
              min={units === 'imperial' ? 20 : 1}
              max={units === 'imperial' ? 1100 : 500}
              step={units === 'imperial' ? 1 : 0.1}
              placeholder={units === 'imperial' ? '165' : '75.0'}
              value={weightKg}
              onChange={(e) => setWeightKg(e.target.value)}
              required
            />
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor="log-calories">
              Calories (optional)
            </label>
            <input
              id="log-calories"
              type="number"
              className="form-input"
              min={0}
              max={10000}
              step={1}
              placeholder="2000"
              value={calories}
              onChange={(e) => setCalories(e.target.value)}
            />
          </div>

          <div className="collapsible">
            <button
              type="button"
              className="collapsible__trigger"
              onClick={() => setOptionalOpen(!optionalOpen)}
              aria-expanded={optionalOpen}
            >
              Optional: waist / hip
              <span aria-hidden>{optionalOpen ? '−' : '+'}</span>
            </button>
            <div className="collapsible__content" hidden={!optionalOpen}>
              <div className="collapsible__inner">
                <div className="form-group">
                  <label className="form-label" htmlFor="log-waist">
                    Waist ({units === 'imperial' ? 'in' : 'cm'})
                  </label>
                  <input
                    id="log-waist"
                    type="number"
                    className="form-input"
                    min={1}
                    max={200}
                    step={0.1}
                    placeholder="80"
                    value={waistCm}
                    onChange={(e) => setWaistCm(e.target.value)}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label" htmlFor="log-hip">
                    Hip ({units === 'imperial' ? 'in' : 'cm'})
                  </label>
                  <input
                    id="log-hip"
                    type="number"
                    className="form-input"
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
          </div>

          <button type="submit" className="btn btn--primary" style={{ marginTop: '1rem' }}>
            Save entry
          </button>
        </form>
      </section>
    </>
  );
}
