/**
 * Motivational messaging: builds user-facing message slots from progress and optional streak data.
 * Science-backed framing: celebrate progress, encourage consistency, realistic course correction.
 */

export interface ProgressMessagesInput {
  progress_percent: number | null;
  weight_trend_kg_per_week: number | null;
  trend_std_error?: number | null;
  trend_entries_count?: number | null;
  weekly_summary: {
    weight_change_kg: number | null;
    on_track: boolean | null;
    message: string;
  };
  estimated_goal_date: string | null;
  estimated_goal_date_early?: string | null;
  estimated_goal_date_late?: string | null;
  estimate_basis?: string | null;
  pace_status: 'ahead' | 'on_track' | 'slightly_behind' | 'behind' | null;
  recovery_message: string | null;
  recommended_calories_min: number | null;
  recommended_calories_max: number | null;
  has_entry_today: boolean;
  current_weight_kg: number;
  goal_weight_kg: number;
  units: 'metric' | 'imperial';
  /** Consecutive days with at least one entry (from today or yesterday backward). */
  logging_streak_days?: number;
  /** Entries in the last 7 days. */
  entries_this_week?: number;
}

export interface ProgressMessages {
  progress_celebration?: string;
  trend_message: string;
  weekly_message: string;
  goal_date_message?: string;
  recovery_message?: string;
  streak_message?: string;
  retention_message?: string;
  uncertainty_message?: string;
  daily_calorie_message?: string;
}

function formatDateShort(iso: string): string {
  const d = new Date(iso + 'T12:00:00');
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

export function buildProgressMessages(input: ProgressMessagesInput): ProgressMessages {
  const {
    progress_percent,
    weight_trend_kg_per_week,
    trend_std_error,
    trend_entries_count,
    weekly_summary,
    estimated_goal_date,
    estimated_goal_date_early,
    estimated_goal_date_late,
    estimate_basis,
    pace_status,
    recovery_message,
    recommended_calories_min,
    recommended_calories_max,
    has_entry_today,
    current_weight_kg,
    goal_weight_kg,
    units,
    logging_streak_days,
    entries_this_week,
  } = input;

  const losing = goal_weight_kg < current_weight_kg;
  const trendAbs = weight_trend_kg_per_week != null ? Math.abs(weight_trend_kg_per_week) : 0;
  const trendWord = weight_trend_kg_per_week != null && weight_trend_kg_per_week < 0 ? 'Losing' : 'Gaining';
  const lowConfidence = (trend_entries_count != null && trend_entries_count < 5) ||
    (trend_std_error != null && weight_trend_kg_per_week != null && trend_std_error > Math.abs(weight_trend_kg_per_week) * 0.8);

  const out: ProgressMessages = {
    trend_message: '',
    weekly_message: weekly_summary.message,
  };

  if (weight_trend_kg_per_week != null && Math.abs(weight_trend_kg_per_week) >= 0.02) {
    const mag = trendAbs.toFixed(1);
    const unit = units === 'imperial' ? 'lb' : 'kg';
    if (pace_status === 'on_track') {
      out.trend_message = `${trendWord} ~${mag} ${unit}/week. Right on target.`;
    } else if (pace_status === 'ahead') {
      out.trend_message = `${trendWord} ~${mag} ${unit}/week. You're ahead of pace.`;
    } else if (pace_status === 'slightly_behind' || pace_status === 'behind') {
      out.trend_message = `${trendWord} ~${mag} ${unit}/week.`;
    } else {
      out.trend_message = `${trendWord} ~${mag} ${unit}/week.`;
    }
  } else if (weight_trend_kg_per_week != null) {
    out.trend_message = 'Weight is stable. Log consistently to see your trend.';
  } else {
    out.trend_message = 'Log at least 2 entries to see your trend.';
  }

  if (progress_percent != null) {
    if (progress_percent >= 100) {
      out.progress_celebration = "You've reached your goal weight. Great work.";
    } else if (progress_percent >= 75) {
      out.progress_celebration = "You're about 75% of the way to your goal weight.";
    } else if (progress_percent >= 50) {
      out.progress_celebration = "You're halfway to your goal weight.";
    } else if (progress_percent >= 25) {
      out.progress_celebration = "You're about 25% of the way to your goal weight.";
    }
  }

  if (estimated_goal_date) {
    if (estimated_goal_date_early && estimated_goal_date_late && estimated_goal_date_early !== estimated_goal_date_late) {
      out.goal_date_message = `At this pace, around ${formatDateShort(estimated_goal_date)} (roughly ${formatDateShort(estimated_goal_date_early)} – ${formatDateShort(estimated_goal_date_late)}).`;
    } else {
      out.goal_date_message = `At this pace, you could reach your goal around ${formatDateShort(estimated_goal_date)}.`;
    }
    if (estimate_basis) {
      out.goal_date_message += ` ${estimate_basis}`;
    }
  }

  if (recovery_message) {
    out.recovery_message = recovery_message;
  }

  if (recommended_calories_min != null && recommended_calories_max != null) {
    out.daily_calorie_message = `Aim for ${recommended_calories_min}–${recommended_calories_max} kcal/day to stay on track.`;
  }

  if (logging_streak_days != null && logging_streak_days >= 2 && !has_entry_today) {
    out.streak_message = `${logging_streak_days}-day logging streak. Log today to keep it.`;
  } else if (entries_this_week != null && entries_this_week >= 5 && !has_entry_today) {
    out.streak_message = `You've logged ${entries_this_week} days this week. Log today to keep your progress visible.`;
  }

  if (!has_entry_today) {
    out.retention_message = 'Log your weight when you can—it keeps your trend and estimate accurate.';
  }

  if (lowConfidence && weight_trend_kg_per_week != null && estimated_goal_date) {
    out.uncertainty_message = 'Keep logging for a few more days to lock in your estimate.';
  } else if (trend_entries_count != null && trend_entries_count < 2) {
    out.uncertainty_message = 'Log at least 2 entries to see an estimated goal date.';
  }

  return out;
}
