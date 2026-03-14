import { useState, useCallback, FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { updateUser } from '../api/client';
import type { ProgressResponse } from '../types/api';
import { formatWeight } from '../utils/units';
import { copy } from '../copy';
import { FieldInput } from './Field';

interface ProgressSummaryProps {
  progress: ProgressResponse;
  userId: string;
  onGoalUpdated?: () => void;
  hero?: boolean;
}

export default function ProgressSummary({ progress, userId, onGoalUpdated, hero }: ProgressSummaryProps) {
  const [showEditGoal, setShowEditGoal] = useState(false);
  const [targetBf, setTargetBf] = useState(String(progress.target_body_fat_percent));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const progressPercent =
    progress.progress_percent != null ? progress.progress_percent : 0;
  const recommendation =
    progress.messages?.daily_calorie_message ??
    (progress.recommended_calories_min != null && progress.recommended_calories_max != null
      ? copy.stayingAroundCalories(progress.recommended_calories_min, progress.recommended_calories_max)
      : null);

  const handleGoalSubmit = useCallback(
    async (e: FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      setError(null);
      const num = Number(targetBf);
      if (Number.isNaN(num) || num <= 0 || num >= 100) {
        setError(copy.targetBodyFatInvalid);
        return;
      }
      setSaving(true);
      try {
        await updateUser(userId, { target_body_fat_percent: num });
        setShowEditGoal(false);
        onGoalUpdated?.();
      } catch (err) {
        setError(err instanceof Error ? err.message : copy.failedToUpdateGoal);
      } finally {
        setSaving(false);
      }
    },
    [userId, targetBf, onGoalUpdated]
  );

  return (
    <section className={`app__card ${hero ? 'app__card--hero' : ''}`} aria-label={copy.progressAtGlance}>
      <h2 className="app__card-title app__card-title--lg">{copy.progress}</h2>
      <p className="progress-text">
        {copy.current}: <span className="app__metric">{formatWeight(progress.current_weight_kg, progress.units)}</span> · {copy.goal}:{' '}
        <span className="app__metric">{formatWeight(progress.goal_weight_kg, progress.units)}</span>
        {progress.progress_percent != null && (
          <> · <span className="app__metric">{Math.round(progressPercent)}%</span> {copy.ofTheWayThere}</>
        )}
      </p>
      {progress.messages?.progress_celebration && (
        <p className="progress-text mt-2" role="status">
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
        <p className="mt-2" role="status">
          <span
            className={`pace-badge pace-badge--${progress.pace_status}`}
            aria-label={`Pace: ${progress.pace_status.replace('_', ' ')}`}
          >
            {progress.pace_status === 'ahead'
              ? copy.paceAhead
              : progress.pace_status === 'on_track'
                ? copy.paceOnTrack
                : progress.pace_status === 'slightly_behind'
                  ? copy.paceSlightlyBehind
                  : copy.paceBehind}
          </span>
        </p>
      )}
      {progress.messages?.trend_message && (
        <p className="progress-text mt-2" role="status">
          {progress.messages.trend_message}
        </p>
      )}
      {recommendation && (
        <p className="progress-text mt-2">
          {recommendation}
        </p>
      )}
      <details className="progress-text mt-2 text-xs">
        <summary className="details-summary">{copy.howWeCalculate}</summary>
        <p className="mt-1 mb-0">
          {copy.howWeCalculateBody}
        </p>
      </details>
      {!showEditGoal ? (
        <p className="mt-3 mb-0">
          <button
            type="button"
            className="btn btn--secondary btn--sm"
            onClick={() => setShowEditGoal(true)}
          >
            {copy.changeGoal}
          </button>
        </p>
      ) : (
        <form className="form-section" onSubmit={handleGoalSubmit} noValidate>
          <FieldInput
            id="progress-summary-target-bf"
            label={copy.targetBodyFatPercent}
            type="number"
            min={1}
            max={99}
            step={0.5}
            value={targetBf}
            onChange={(e) => setTargetBf(e.target.value)}
            error={error}
          />
          <button type="submit" className="btn btn--primary mr-2" disabled={saving}>
            {saving ? copy.saving : 'Save'}
          </button>
          <button type="button" className="btn btn--secondary" onClick={() => { setShowEditGoal(false); setError(null); setTargetBf(String(progress.target_body_fat_percent)); }} disabled={saving}>
            Cancel
          </button>
        </form>
      )}
      <p className="mt-4 mb-0">
        <Link to="/history" className="btn btn--secondary btn--sm">
          {copy.seeFullProgress}
        </Link>
      </p>
    </section>
  );
}
