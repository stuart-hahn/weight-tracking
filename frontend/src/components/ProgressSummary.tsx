import { useState, useCallback, FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { updateUser } from '../api/client';
import type { ProgressResponse } from '../types/api';
import { formatWeight } from '../utils/units';

interface ProgressSummaryProps {
  progress: ProgressResponse;
  userId: string;
  onGoalUpdated?: () => void;
}

export default function ProgressSummary({ progress, userId, onGoalUpdated }: ProgressSummaryProps) {
  const [showEditGoal, setShowEditGoal] = useState(false);
  const [targetBf, setTargetBf] = useState(String(progress.target_body_fat_percent));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const progressPercent =
    progress.progress_percent != null ? progress.progress_percent : 0;
  const recommendation =
    progress.messages?.daily_calorie_message ??
    (progress.recommended_calories_min != null && progress.recommended_calories_max != null
      ? `Staying around ${progress.recommended_calories_min}–${progress.recommended_calories_max} kcal/day can keep you on track.`
      : null);

  const handleGoalSubmit = useCallback(
    async (e: FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      setError(null);
      const num = Number(targetBf);
      if (Number.isNaN(num) || num <= 0 || num >= 100) {
        setError('Target body fat % must be between 1 and 99');
        return;
      }
      setSaving(true);
      try {
        await updateUser(userId, { target_body_fat_percent: num });
        setShowEditGoal(false);
        onGoalUpdated?.();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to update goal');
      } finally {
        setSaving(false);
      }
    },
    [userId, targetBf, onGoalUpdated]
  );

  return (
    <section className="app__card" aria-label="Progress at a glance">
      <h2 className="app__card-title">Progress</h2>
      <p className="progress-text">
        Current: {formatWeight(progress.current_weight_kg, progress.units)} · Goal:{' '}
        {formatWeight(progress.goal_weight_kg, progress.units)}
        {progress.progress_percent != null && (
          <> · {Math.round(progressPercent)}% of the way there</>
        )}
      </p>
      {progress.messages?.progress_celebration && (
        <p className="progress-text" style={{ marginTop: '0.5rem' }} role="status">
          {progress.messages.progress_celebration}
        </p>
      )}
      <div
        className="progress-bar"
        role="progressbar"
        aria-valuenow={progressPercent}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div
          className="progress-bar__fill"
          style={{ width: `${progressPercent}%` }}
        />
      </div>
      {progress.pace_status && (
        <p style={{ marginTop: '0.5rem' }} role="status">
          <span
            className={`pace-badge pace-badge--${progress.pace_status}`}
            aria-label={`Pace: ${progress.pace_status.replace('_', ' ')}`}
          >
            {progress.pace_status === 'ahead'
              ? 'Ahead of pace'
              : progress.pace_status === 'on_track'
                ? 'On track'
                : progress.pace_status === 'slightly_behind'
                  ? 'A bit behind'
                  : 'Behind'}
          </span>
        </p>
      )}
      {progress.messages?.trend_message && (
        <p className="progress-text" style={{ marginTop: '0.5rem' }} role="status">
          {progress.messages.trend_message}
        </p>
      )}
      {recommendation && (
        <p className="progress-text" style={{ marginTop: '0.5rem' }}>
          {recommendation}
        </p>
      )}
      <details className="progress-text" style={{ marginTop: '0.5rem', fontSize: '0.8rem' }}>
        <summary style={{ cursor: 'pointer', color: 'var(--muted)' }}>How we calculate</summary>
        <p style={{ marginTop: '0.35rem', marginBottom: 0 }}>
          Goal weight comes from your target body fat % and lean mass. The date estimate uses your recent weigh-in trend.
        </p>
      </details>
      {!showEditGoal ? (
        <p style={{ marginTop: '0.75rem', marginBottom: 0 }}>
          <button
            type="button"
            className="btn btn--secondary"
            style={{ padding: '0.35rem 0.75rem', fontSize: '0.85rem' }}
            onClick={() => setShowEditGoal(true)}
          >
            Change goal
          </button>
        </p>
      ) : (
        <form onSubmit={handleGoalSubmit} noValidate style={{ marginTop: '0.75rem', paddingTop: '0.75rem', borderTop: '1px solid var(--border)' }}>
          {error && <p className="form-error" role="alert" style={{ marginBottom: '0.5rem' }}>{error}</p>}
          <div className="form-group" style={{ marginBottom: '0.5rem' }}>
            <label className="form-label" htmlFor="progress-summary-target-bf">
              Target body fat (%)
            </label>
            <input
              id="progress-summary-target-bf"
              type="number"
              className="form-input"
              min={1}
              max={99}
              step={0.5}
              value={targetBf}
              onChange={(e) => setTargetBf(e.target.value)}
            />
          </div>
          <button type="submit" className="btn btn--primary" style={{ marginRight: '0.5rem' }} disabled={saving}>
            {saving ? 'Saving…' : 'Save'}
          </button>
          <button type="button" className="btn btn--secondary" onClick={() => { setShowEditGoal(false); setError(null); setTargetBf(String(progress.target_body_fat_percent)); }} disabled={saving}>
            Cancel
          </button>
        </form>
      )}
      <p style={{ marginTop: '1rem', marginBottom: 0 }}>
        <Link to="/history" className="btn btn--secondary" style={{ display: 'inline-block', width: 'auto', padding: '0.5rem 1rem', fontSize: '0.9rem' }}>
          See full progress
        </Link>
      </p>
    </section>
  );
}
