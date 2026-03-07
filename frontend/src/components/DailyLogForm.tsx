import { useState, useCallback, FormEvent, useEffect } from 'react';
import { getProgress } from '../api/client';
import type { CreateEntryRequest } from '../types/api';

interface DailyLogFormProps {
  onSubmit: (body: CreateEntryRequest) => void;
  userId: string;
}

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

export default function DailyLogForm({ onSubmit, userId }: DailyLogFormProps) {
  const [date, setDate] = useState(todayISO);
  const [weightKg, setWeightKg] = useState('');
  const [calories, setCalories] = useState('');
  const [optionalOpen, setOptionalOpen] = useState(false);
  const [waistCm, setWaistCm] = useState('');
  const [hipCm, setHipCm] = useState('');
  const [progress, setProgress] = useState<{
    current_weight_kg: number;
    goal_weight_kg: number;
    entries_count: number;
  } | null>(null);

  useEffect(() => {
    let cancelled = false;
    getProgress(userId)
      .then((p) => {
        if (!cancelled) setProgress(p);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [userId]);

  const handleSubmit = useCallback(
    (e: FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      const weightNum = Number(weightKg);
      if (Number.isNaN(weightNum) || weightNum <= 0 || weightNum > 500) return;
      const body: CreateEntryRequest = {
        date,
        weight_kg: weightNum,
      };
      if (calories.trim() !== '') {
        const cal = Number(calories);
        if (!Number.isNaN(cal) && cal >= 0 && cal <= 10000) body.calories = cal;
      }
      if (optionalOpen) {
        const w = Number(waistCm);
        const h = Number(hipCm);
        if (!Number.isNaN(w) && w > 0 && w <= 200) body.waist_cm = w;
        if (!Number.isNaN(h) && h > 0 && h <= 200) body.hip_cm = h;
      }
      onSubmit(body);
    },
    [date, weightKg, calories, optionalOpen, waistCm, hipCm, onSubmit]
  );

  const progressPercent =
    progress ? Math.min(100, progress.entries_count * 5) : 0;

  return (
    <>
      {progress !== null && (
        <section className="app__card" aria-label="Progress summary">
          <h2 className="app__card-title">Progress</h2>
          <p className="progress-text">
            Current: {progress.current_weight_kg} kg · Goal: {progress.goal_weight_kg} kg ·{' '}
            {progress.entries_count} entries
          </p>
          <div className="progress-bar" role="progressbar" aria-valuenow={progressPercent} aria-valuemin={0} aria-valuemax={100}>
            <div
              className="progress-bar__fill"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
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
              Weight (kg)
            </label>
            <input
              id="log-weight"
              type="number"
              className="form-input"
              min={1}
              max={500}
              step={0.1}
              placeholder="75.0"
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
                    Waist (cm)
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
                    Hip (cm)
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
