/**
 * Progress calculations: goal weight from target body fat, weight trend.
 * Type-safe and deterministic.
 */

export interface UserForGoalWeight {
  currentWeightKg: number;
  heightCm: number;
  sex: 'male' | 'female';
  targetBodyFatPercent: number;
  leanMassKg: number | null;
}

/**
 * Estimate lean body mass (kg) using Boer equations.
 * Weight in kg, height in cm.
 */
export function estimateLeanMassKg(weightKg: number, heightCm: number, sex: 'male' | 'female'): number {
  if (sex === 'male') {
    return 0.407 * weightKg + 0.267 * heightCm - 19.2;
  }
  return 0.252 * weightKg + 0.473 * heightCm - 48.3;
}

/**
 * Compute goal weight (kg) to reach target body fat %.
 * Uses lean mass if provided; otherwise estimates from current weight/height/sex.
 */
export function computeGoalWeightKg(user: UserForGoalWeight): number {
  const targetBf = user.targetBodyFatPercent / 100;
  if (targetBf >= 1 || targetBf <= 0) {
    return user.currentWeightKg;
  }
  const leanMass =
    user.leanMassKg != null && user.leanMassKg > 0
      ? user.leanMassKg
      : estimateLeanMassKg(user.currentWeightKg, user.heightCm, user.sex);
  const goal = leanMass / (1 - targetBf);
  return Math.max(20, Math.min(500, goal));
}

export interface EntryForTrend {
  date: Date;
  weightKg: number;
}

/**
 * Compute weight trend as kg per week (positive = gaining, negative = losing).
 * Uses first and last entry over the period; returns null if fewer than 2 entries.
 */
export function computeWeightTrendKgPerWeek(entries: EntryForTrend[]): number | null {
  if (entries.length < 2) return null;
  const sorted = [...entries].sort((a, b) => a.date.getTime() - b.date.getTime());
  const first = sorted[0];
  const last = sorted[sorted.length - 1];
  const daysDiff = (last.date.getTime() - first.date.getTime()) / (1000 * 60 * 60 * 24);
  if (daysDiff <= 0) return null;
  const weeks = daysDiff / 7;
  const weightDiff = last.weightKg - first.weightKg;
  return weightDiff / weeks;
}

export interface TrendWithUncertainty {
  trendKgPerWeek: number;
  trendStdError: number;
  trendEntriesCount: number;
}

const MS_PER_DAY = 1000 * 60 * 60 * 24;

/**
 * Compute weight trend via least-squares linear regression (weight vs days from first).
 * Returns slope as kg per week, its standard error, and entry count.
 * More stable than first-last; enables confidence intervals.
 */
export function computeWeightTrendWithUncertainty(entries: EntryForTrend[]): TrendWithUncertainty | null {
  if (entries.length < 2) return null;
  const sorted = [...entries].sort((a, b) => a.date.getTime() - b.date.getTime());
  const t0 = sorted[0].date.getTime();
  const n = sorted.length;
  let sumX = 0;
  let sumY = 0;
  let sumXX = 0;
  let sumXY = 0;
  for (const e of sorted) {
    const x = (e.date.getTime() - t0) / MS_PER_DAY; // days from first
    const y = e.weightKg;
    sumX += x;
    sumY += y;
    sumXX += x * x;
    sumXY += x * y;
  }
  const meanX = sumX / n;
  const meanY = sumY / n;
  const sxx = sumXX - n * meanX * meanX;
  if (sxx < 1e-10) return null; // no spread in time
  const slopePerDay = (sumXY - n * meanX * meanY) / sxx;
  const slopePerWeek = slopePerDay * 7;

  let sse = 0;
  for (const e of sorted) {
    const x = (e.date.getTime() - t0) / MS_PER_DAY;
    const yPred = meanY + slopePerDay * (x - meanX);
    sse += (e.weightKg - yPred) ** 2;
  }
  const mse = n > 2 ? sse / (n - 2) : 0;
  const slopeStdErrorPerDay = mse > 0 && sxx > 0 ? Math.sqrt(mse / sxx) : 0;
  const trendStdError = slopeStdErrorPerDay * 7;

  return {
    trendKgPerWeek: slopePerWeek,
    trendStdError,
    trendEntriesCount: n,
  };
}

/**
 * Compute progress percent (0–100) for weight loss: (start - current) / (start - goal) * 100.
 * For weight gain, (current - start) / (goal - start) * 100.
 * Returns null if direction is unclear or goal equals start.
 */
export function computeProgressPercent(
  startWeightKg: number,
  currentWeightKg: number,
  goalWeightKg: number
): number | null {
  const diffToGoal = goalWeightKg - startWeightKg;
  const diffCurrent = currentWeightKg - startWeightKg;
  if (Math.abs(diffToGoal) < 0.01) return null;
  const ratio = diffCurrent / diffToGoal;
  const percent = ratio * 100;
  if (percent < 0) return 0;
  if (percent > 100) return 100;
  return percent;
}

export interface EstimatedGoalResult {
  date: string | null;
  message: string;
}

/**
 * Estimate when the user will reach goal weight based on current trend.
 * Returns date (YYYY-MM-DD) when trend is toward goal; otherwise null with message.
 */
export function estimateGoalReachDate(
  currentWeightKg: number,
  goalWeightKg: number,
  trendKgPerWeek: number | null
): EstimatedGoalResult {
  if (trendKgPerWeek == null || Math.abs(trendKgPerWeek) < 0.001) {
    return { date: null, message: "Log at least 2 weigh-ins and we'll show an estimated goal date." };
  }
  const movingTowardGoal =
    (goalWeightKg < currentWeightKg && trendKgPerWeek < 0) ||
    (goalWeightKg > currentWeightKg && trendKgPerWeek > 0);
  if (!movingTowardGoal) {
    return { date: null, message: "Your trend has moved away from your goal lately. Get back on pace and we'll show an estimate again." };
  }
  const kgToGo = goalWeightKg - currentWeightKg;
  const weeks = kgToGo / trendKgPerWeek;
  const targetDate = new Date();
  targetDate.setDate(targetDate.getDate() + Math.round(weeks * 7));
  return { date: targetDate.toISOString().slice(0, 10), message: '' };
}

export interface GoalReachDateWithRange {
  date: string;
  dateEarly: string;
  dateLate: string;
  message: string;
  basis: string;
}

/**
 * Estimate goal reach date with confidence range using trend and its standard error.
 * Uses approximate 50% interval: early = optimistic (sooner), late = conservative (later).
 */
export function estimateGoalReachDateWithRange(
  currentWeightKg: number,
  goalWeightKg: number,
  trendKgPerWeek: number,
  trendStdError: number
): GoalReachDateWithRange {
  const kgToGo = goalWeightKg - currentWeightKg;
  const weeks = kgToGo / trendKgPerWeek;
  const addDays = (days: number): string => {
    const d = new Date();
    d.setDate(d.getDate() + Math.round(days));
    return d.toISOString().slice(0, 10);
  };
  const pointDate = addDays(weeks * 7);

  let weeksEarly = weeks;
  let weeksLate = weeks;
  if (trendStdError > 0 && Math.abs(trendKgPerWeek) > 1e-6) {
    const trendEarly = trendKgPerWeek - 0.674 * trendStdError;
    const trendLate = trendKgPerWeek + 0.674 * trendStdError;
    if (Math.abs(trendEarly) > 1e-6) weeksEarly = kgToGo / trendEarly;
    if (Math.abs(trendLate) > 1e-6) weeksLate = kgToGo / trendLate;
  }
  const dateEarly = addDays(weeksEarly * 7);
  const dateLate = addDays(weeksLate * 7);

  return {
    date: pointDate,
    dateEarly,
    dateLate,
    message: '',
    basis: 'Based on your recent weigh-ins.',
  };
}

/** Approximate standard normal CDF for completion probability. */
function normalCDF(z: number): number {
  const a1 = 0.254829592;
  const a2 = -0.284496736;
  const a3 = 1.421413741;
  const a4 = -1.453152027;
  const a5 = 1.061405429;
  const p = 0.3275911;
  const t = 1 / (1 + p * Math.abs(z));
  const y = 1 - ((((a5 * t + a4) * t + a3) * t + a2) * t + a1) * t * Math.exp(-z * z);
  return z >= 0 ? y : 1 - y;
}

/**
 * Probability (0–1) of reaching goal by target date given current trend and uncertainty.
 * Uses normal approximation: required rate vs distribution of trend.
 */
export function completionProbability(
  currentWeightKg: number,
  goalWeightKg: number,
  targetDate: Date,
  trendKgPerWeek: number,
  trendStdError: number
): number | null {
  const kgToGo = goalWeightKg - currentWeightKg;
  const now = new Date();
  const daysRemaining = (targetDate.getTime() - now.getTime()) / MS_PER_DAY;
  const weeksRemaining = daysRemaining / 7;
  if (weeksRemaining <= 0) return null;
  const requiredRatePerWeek = kgToGo / weeksRemaining;
  if (trendStdError <= 0) {
    return trendKgPerWeek >= requiredRatePerWeek - 1e-6 ? 1 : 0;
  }
  const z = (requiredRatePerWeek - trendKgPerWeek) / trendStdError;
  const p = 1 - normalCDF(z);
  return Math.max(0, Math.min(1, p));
}

export type PaceStatus = 'ahead' | 'on_track' | 'slightly_behind' | 'behind';

const TARGET_KG_PER_WEEK = 0.5;
const ON_TRACK_TOLERANCE = 0.15;
const SLIGHTLY_BEHIND_TOLERANCE = 0.35;

/**
 * Classify pace vs target 0.5 kg/week (loss or gain) for motivational messaging.
 */
export function getPaceStatus(
  trendKgPerWeek: number | null,
  currentWeightKg: number,
  goalWeightKg: number
): PaceStatus | null {
  if (trendKgPerWeek == null) return null;
  const losing = goalWeightKg < currentWeightKg;
  const target = losing ? -TARGET_KG_PER_WEEK : TARGET_KG_PER_WEEK;
  const diff = trendKgPerWeek - target;
  const absDiff = Math.abs(diff);
  if (absDiff <= ON_TRACK_TOLERANCE) return 'on_track';
  if (losing && diff < 0) return 'ahead'; // trend more negative than target
  if (!losing && diff > 0) return 'ahead'; // trend more positive than target
  if (absDiff <= SLIGHTLY_BEHIND_TOLERANCE) return 'slightly_behind';
  return 'behind';
}

export interface RecoverySuggestion {
  recovery_weekly_rate_kg: number;
  recovery_calorie_adjustment_kcal: number | null;
  message: string;
}

/**
 * When user is behind, suggest weekly rate and optional calorie adjustment to get back on track.
 * Suggests target rate (0.5 kg/week) and optional calorie tweak from gap vs current trend.
 */
export function getRecoverySuggestion(
  currentWeightKg: number,
  goalWeightKg: number,
  trendKgPerWeek: number | null,
  paceStatus: PaceStatus | null
): RecoverySuggestion | null {
  if (paceStatus !== 'slightly_behind' && paceStatus !== 'behind') return null;
  if (trendKgPerWeek == null) return null;
  const targetRate = goalWeightKg < currentWeightKg ? -TARGET_KG_PER_WEEK : TARGET_KG_PER_WEEK;
  const gap = Math.abs(targetRate - trendKgPerWeek);
  if (gap < 0.05) return null;

  const extraKcalPerDay = Math.abs(gap * 1000); // ~1000 kcal per kg per week rough
  const adjustment = Math.min(200, Math.round(extraKcalPerDay / 10) * 10);

  return {
    recovery_weekly_rate_kg: targetRate,
    recovery_calorie_adjustment_kcal: adjustment > 0 ? adjustment : null,
    message: `To get back on track, aim for about ${targetRate < 0 ? Math.abs(targetRate).toFixed(1) : targetRate.toFixed(1)} kg per week.${adjustment > 0 ? ` A small change of around ${adjustment} kcal per day can help.` : ''}`,
  };
}
