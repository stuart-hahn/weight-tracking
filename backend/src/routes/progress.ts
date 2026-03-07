import { Router, type Response } from 'express';
import { prisma } from '../config/db.js';
import { requireAuth, type AuthRequest } from '../middleware/auth.js';
import {
  computeGoalWeightKg,
  computeWeightTrendKgPerWeek,
  computeProgressPercent,
} from '../services/progress.js';
import {
  computeTDEE,
  getRecommendedCalories,
  type ActivityLevel,
} from '../services/calories.js';
import type { ProgressMetrics, WeeklySummary } from '../types/index.js';

const TREND_ENTRIES_LIMIT = 14;
const TARGET_KG_PER_WEEK = 0.5;
const ON_TRACK_TOLERANCE_KG = 0.4;

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
  const trendEntries = entriesForTrend.reverse().map((e) => ({ date: e.date, weightKg: e.weightKg }));

  const goalWeightKg = computeGoalWeightKg({
    currentWeightKg: startWeightKg,
    heightCm: user.heightCm,
    sex: user.sex as 'male' | 'female',
    targetBodyFatPercent: user.targetBodyFatPercent,
    leanMassKg: user.leanMassKg,
  });

  const weightTrendKgPerWeek = computeWeightTrendKgPerWeek(trendEntries);

  const progressPercent = computeProgressPercent(startWeightKg, currentWeightKg, goalWeightKg);

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

  const progress: ProgressMetrics = {
    user_id: userId,
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
  };
  res.json(progress);
});

export default router;
