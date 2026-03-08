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
    return { date: null, message: 'Log at least 2 entries to see estimated goal date.' };
  }
  const movingTowardGoal =
    (goalWeightKg < currentWeightKg && trendKgPerWeek < 0) ||
    (goalWeightKg > currentWeightKg && trendKgPerWeek > 0);
  if (!movingTowardGoal) {
    return { date: null, message: 'Trend is moving away from goal. Adjust habits to see an estimate.' };
  }
  const kgToGo = goalWeightKg - currentWeightKg;
  const weeks = kgToGo / trendKgPerWeek;
  const targetDate = new Date();
  targetDate.setDate(targetDate.getDate() + Math.round(weeks * 7));
  return { date: targetDate.toISOString().slice(0, 10), message: '' };
}
