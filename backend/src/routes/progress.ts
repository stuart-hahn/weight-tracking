import { Router, type Response } from 'express';
import { prisma } from '../config/db.js';
import { requireAuth, type AuthRequest } from '../middleware/auth.js';
import {
  computeGoalWeightKg,
  computeWeightTrendKgPerWeek,
  computeWeightTrendWithUncertainty,
  computeProgressPercent,
  estimateGoalReachDate,
  estimateGoalReachDateWithRange,
  estimateLeanMassKg,
  getPaceStatus,
  getRecoverySuggestion,
} from '../services/progress.js';
import {
  computeTDEE,
  getRecommendedCalories,
  type ActivityLevel,
} from '../services/calories.js';
import { buildProgressMessages } from '../services/messaging.js';
import type { ProgressMetrics, WeeklySummary } from '../types/index.js';

const TREND_ENTRIES_LIMIT = 14;
const TARGET_KG_PER_WEEK = 0.5;
const ON_TRACK_TOLERANCE_KG = 0.4;

function getTodayInTimezone(timezone: string | null): string {
  const now = new Date();
  if (timezone) {
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    const parts = formatter.formatToParts(now);
    const y = parts.find((p) => p.type === 'year')?.value ?? '';
    const m = parts.find((p) => p.type === 'month')?.value ?? '';
    const d = parts.find((p) => p.type === 'day')?.value ?? '';
    return `${y}-${m}-${d}`;
  }
  return now.toISOString().slice(0, 10);
}

const router = Router({ mergeParams: true });

/** GET /api/users/:id/progress - Progress metrics (computed goal, current from entries, trend) */
router.get('/', requireAuth, async (req: AuthRequest, res: Response): Promise<void> => {
  const userId = req.params.id;
  if (req.userId !== userId) {
    res.status(403).json({ error: 'Forbidden' });
    return;
  }
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      currentWeightKg: true,
      heightCm: true,
      sex: true,
      targetBodyFatPercent: true,
      leanMassKg: true,
      age: true,
      activityLevel: true,
      units: true,
      timezone: true,
    },
  });
  if (!user) {
    res.status(404).json({ error: 'User not found' });
    return;
  }

  const startWeightKg = user.currentWeightKg;

  const latestEntry = await prisma.dailyEntry.findFirst({
    where: { userId },
    orderBy: { date: 'desc' },
    select: { date: true, weightKg: true },
  });
  const currentWeightKg = latestEntry ? latestEntry.weightKg : startWeightKg;

  const entriesForTrend = await prisma.dailyEntry.findMany({
    where: { userId },
    orderBy: { date: 'desc' },
    take: TREND_ENTRIES_LIMIT,
    select: { date: true, weightKg: true },
  });
  type TrendRow = { date: Date; weightKg: number };
  const trendEntries = entriesForTrend.reverse().map((e: TrendRow) => ({ date: e.date, weightKg: e.weightKg }));

  const goalWeightKg = computeGoalWeightKg({
    currentWeightKg: startWeightKg,
    heightCm: user.heightCm,
    sex: user.sex as 'male' | 'female',
    targetBodyFatPercent: user.targetBodyFatPercent,
    leanMassKg: user.leanMassKg,
  });

  const trendWithUncertainty = computeWeightTrendWithUncertainty(trendEntries);
  const weightTrendKgPerWeek = trendWithUncertainty?.trendKgPerWeek ?? computeWeightTrendKgPerWeek(trendEntries);
  const trendStdError = trendWithUncertainty?.trendStdError ?? null;
  const trendEntriesCount = trendWithUncertainty?.trendEntriesCount ?? null;

  const progressPercent = computeProgressPercent(startWeightKg, currentWeightKg, goalWeightKg);

  let estimatedGoalDate: string | null = null;
  let estimatedGoalMessage = '';
  let estimatedGoalDateEarly: string | null = null;
  let estimatedGoalDateLate: string | null = null;
  let estimateBasis: string | null = null;

  if (weightTrendKgPerWeek != null && Math.abs(weightTrendKgPerWeek) >= 0.001) {
    const movingTowardGoal =
      (goalWeightKg < currentWeightKg && weightTrendKgPerWeek < 0) ||
      (goalWeightKg > currentWeightKg && weightTrendKgPerWeek > 0);
    if (movingTowardGoal && trendWithUncertainty) {
      const rangeResult = estimateGoalReachDateWithRange(
        currentWeightKg,
        goalWeightKg,
        weightTrendKgPerWeek,
        trendStdError ?? 0
      );
      estimatedGoalDate = rangeResult.date;
      estimatedGoalDateEarly = rangeResult.dateEarly;
      estimatedGoalDateLate = rangeResult.dateLate;
      estimateBasis = rangeResult.basis;
    } else if (movingTowardGoal) {
      const result = estimateGoalReachDate(currentWeightKg, goalWeightKg, weightTrendKgPerWeek);
      estimatedGoalDate = result.date;
      estimatedGoalMessage = result.message;
      estimateBasis = 'Based on your recent weigh-ins.';
    } else {
      const result = estimateGoalReachDate(currentWeightKg, goalWeightKg, weightTrendKgPerWeek);
      estimatedGoalMessage = result.message;
    }
  } else {
    estimatedGoalMessage = 'Log at least 2 entries to see estimated goal date.';
  }

  const paceStatus = getPaceStatus(weightTrendKgPerWeek, currentWeightKg, goalWeightKg);
  const recovery = getRecoverySuggestion(currentWeightKg, goalWeightKg, weightTrendKgPerWeek, paceStatus);
  let recoveryMessage: string | null = recovery?.message ?? null;

  const effectiveLeanMassKg =
    user.leanMassKg ?? estimateLeanMassKg(currentWeightKg, user.heightCm, user.sex as 'male' | 'female');
  const leanMassIsEstimated = user.leanMassKg == null;

  let estimatedBodyFatPercent: number | null = null;
  if (
    currentWeightKg > 0 &&
    effectiveLeanMassKg < currentWeightKg
  ) {
    const raw = (1 - effectiveLeanMassKg / currentWeightKg) * 100;
    estimatedBodyFatPercent = Math.round(Math.max(0, Math.min(100, raw)) * 10) / 10;
  }

  const agg = await prisma.dailyEntry.aggregate({
    where: { userId },
    _max: { date: true },
  });
  const maxDate = agg._max.date;
  const countResult = await prisma.dailyEntry.count({ where: { userId } });

  const activityLevel: ActivityLevel = (user.activityLevel as ActivityLevel) ?? 'sedentary';
  const tdee = computeTDEE(
    currentWeightKg,
    user.heightCm,
    user.age,
    user.sex as 'male' | 'female',
    activityLevel
  );
  const caloriesRange = getRecommendedCalories(tdee, currentWeightKg, goalWeightKg);

  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  const weeklyEntries = await prisma.dailyEntry.findMany({
    where: { userId, date: { gte: sevenDaysAgo } },
    orderBy: { date: 'asc' },
    select: { date: true, weightKg: true },
  });
  let weekly_summary: WeeklySummary;
  if (weeklyEntries.length < 2) {
    weekly_summary = {
      weight_change_kg: null,
      on_track: null,
      message: 'Log at least 2 entries in the last 7 days to see weekly summary.',
    };
  } else {
    const firstW = weeklyEntries[0].weightKg;
    const lastW = weeklyEntries[weeklyEntries.length - 1].weightKg;
    const weightChangeKg = lastW - firstW;
    const targetPerWeek = goalWeightKg < currentWeightKg ? -TARGET_KG_PER_WEEK : TARGET_KG_PER_WEEK;
    const onTrack =
      Math.abs(weightChangeKg - targetPerWeek) <= ON_TRACK_TOLERANCE_KG ||
      (targetPerWeek < 0 && weightChangeKg <= 0) ||
      (targetPerWeek > 0 && weightChangeKg >= 0);
    weekly_summary = {
      weight_change_kg: weightChangeKg,
      on_track: onTrack,
      message:
        weightChangeKg >= 0
          ? `This week: +${weightChangeKg.toFixed(2)} kg. ${onTrack ? 'On track.' : 'Consider adjusting.'}`
          : `This week: ${weightChangeKg.toFixed(2)} kg. ${onTrack ? 'On track.' : 'Consider adjusting.'}`,
    };
  }

  if (recovery && caloriesRange.recommended_calories_min != null && caloriesRange.recommended_calories_max != null) {
    recoveryMessage = `To get back on track: aim for ${caloriesRange.recommended_calories_min}–${caloriesRange.recommended_calories_max} kcal for the next 2 weeks.`;
  }

  const todayIso = getTodayInTimezone(user.timezone);
  const latestDateStr = maxDate ? maxDate.toISOString().slice(0, 10) : null;
  const hasEntryToday = latestDateStr === todayIso;

  let loggingStreakDays: number | null = null;
  let entriesThisWeek: number = weeklyEntries.length;
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 31);
  const recentEntries = await prisma.dailyEntry.findMany({
    where: { userId, date: { gte: thirtyDaysAgo } },
    select: { date: true },
  });
  const entryDatesSet = new Set(recentEntries.map((e) => e.date.toISOString().slice(0, 10)));
  let streakDate = new Date(todayIso + 'T12:00:00');
  for (let i = 0; i < 31; i++) {
    const key = streakDate.toISOString().slice(0, 10);
    if (!entryDatesSet.has(key)) break;
    loggingStreakDays = i + 1;
    streakDate.setDate(streakDate.getDate() - 1);
  }

  const units = (user.units === 'imperial' ? 'imperial' : 'metric') as ProgressMetrics['units'];
  const messages = buildProgressMessages({
    progress_percent: progressPercent,
    weight_trend_kg_per_week: weightTrendKgPerWeek,
    trend_std_error: trendStdError ?? undefined,
    trend_entries_count: trendEntriesCount ?? undefined,
    weekly_summary,
    estimated_goal_date: estimatedGoalDate,
    estimated_goal_date_early: estimatedGoalDateEarly ?? undefined,
    estimated_goal_date_late: estimatedGoalDateLate ?? undefined,
    estimate_basis: estimateBasis ?? undefined,
    pace_status: paceStatus ?? undefined,
    recovery_message: recoveryMessage,
    recommended_calories_min: caloriesRange.recommended_calories_min,
    recommended_calories_max: caloriesRange.recommended_calories_max,
    has_entry_today: hasEntryToday,
    current_weight_kg: currentWeightKg,
    goal_weight_kg: goalWeightKg,
    units,
    logging_streak_days: loggingStreakDays ?? undefined,
    entries_this_week: entriesThisWeek,
  });

  const progress: ProgressMetrics = {
    user_id: userId,
    units,
    start_weight_kg: startWeightKg,
    current_weight_kg: currentWeightKg,
    goal_weight_kg: goalWeightKg,
    target_body_fat_percent: user.targetBodyFatPercent,
    entries_count: countResult,
    latest_entry_date: maxDate ? maxDate.toISOString().slice(0, 10) : null,
    weight_trend_kg_per_week: weightTrendKgPerWeek,
    progress_percent: progressPercent,
    recommended_calories_min: caloriesRange.recommended_calories_min,
    recommended_calories_max: caloriesRange.recommended_calories_max,
    weekly_summary,
    estimated_goal_date: estimatedGoalDate,
    ...(estimatedGoalMessage ? { estimated_goal_message: estimatedGoalMessage } : {}),
    lean_mass_kg: Math.round(effectiveLeanMassKg * 100) / 100,
    lean_mass_is_estimated: leanMassIsEstimated,
    ...(estimatedBodyFatPercent != null
      ? {
          estimated_body_fat_percent: estimatedBodyFatPercent,
          body_fat_is_estimated: true,
        }
      : {}),
    timezone: user.timezone ?? null,
    ...(trendStdError != null ? { trend_std_error: trendStdError } : {}),
    ...(trendEntriesCount != null ? { trend_entries_count: trendEntriesCount } : {}),
    ...(estimatedGoalDateEarly != null ? { estimated_goal_date_early: estimatedGoalDateEarly } : {}),
    ...(estimatedGoalDateLate != null ? { estimated_goal_date_late: estimatedGoalDateLate } : {}),
    ...(estimateBasis != null ? { estimate_basis: estimateBasis } : {}),
    ...(paceStatus != null ? { pace_status: paceStatus } : {}),
    ...(recovery != null
      ? {
          recovery: {
            recovery_weekly_rate_kg: recovery.recovery_weekly_rate_kg,
            recovery_calorie_adjustment_kcal: recovery.recovery_calorie_adjustment_kcal,
            message: recoveryMessage ?? recovery.message,
          },
        }
      : {}),
    messages,
    ...(loggingStreakDays != null ? { logging_streak_days: loggingStreakDays } : {}),
    entries_this_week: entriesThisWeek,
  };
  res.json(progress);
});

export default router;
