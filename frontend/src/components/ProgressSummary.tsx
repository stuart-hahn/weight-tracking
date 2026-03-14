import { Link } from 'react-router-dom';
import type { ProgressResponse } from '../types/api';
import { formatWeight } from '../utils/units';
import { copy } from '../copy';

interface ProgressSummaryProps {
  progress: ProgressResponse;
  userId: string;
  onGoalUpdated?: () => void;
  hero?: boolean;
}

export default function ProgressSummary({ progress, hero }: ProgressSummaryProps) {
  const progressPercent =
    progress.progress_percent != null ? progress.progress_percent : 0;
  const isBehind =
    progress.pace_status === 'slightly_behind' || progress.pace_status === 'behind';
  const showCalorieHint =
    isBehind && (progress.messages?.daily_calorie_message != null);

  return (
    <section className={`app__card ${hero ? 'app__card--hero' : ''}`} aria-label={copy.progressAtGlance}>
      <h2 className="app__card-title app__card-title--lg">{copy.progress}</h2>
      <p className="progress-text">
        {copy.current}: <span className="app__metric">{formatWeight(progress.current_weight_kg, progress.units)}</span> · {copy.goal}:{' '}
        <span className="app__metric">{formatWeight(progress.goal_weight_kg, progress.units)}</span>
        {progress.progress_percent != null && (
          <> · <span className="app__metric">{Math.round(progressPercent)}%</span> {copy.towardGoal}</>
        )}
      </p>
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
      {showCalorieHint && (
        <p className="progress-text mt-2">
          {progress.messages!.daily_calorie_message}
        </p>
      )}
      <p className="mt-4 mb-0">
        <Link to="/history" className="btn btn--secondary btn--sm">
          {copy.viewYourJourney}
        </Link>
      </p>
    </section>
  );
}
