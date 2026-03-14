/**
 * TDEE (Mifflin–St Jeor) and safe calorie range for ~0.5 kg/week.
 * Type-safe, deterministic.
 */

export type ActivityLevel = 'sedentary' | 'light' | 'moderate' | 'very_active';

const ACTIVITY_MULTIPLIER: Record<ActivityLevel, number> = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  very_active: 1.725,
};

/**
 * BMR via Mifflin–St Jeor. Weight kg, height cm.
 */
function mifflinStJeor(weightKg: number, heightCm: number, age: number, sex: 'male' | 'female'): number {
  const base = 10 * weightKg + 6.25 * heightCm - 5 * age;
  return sex === 'male' ? base + 5 : base - 161;
}

/**
 * TDEE in kcal/day.
 */
export function computeTDEE(
  weightKg: number,
  heightCm: number,
  age: number,
  sex: 'male' | 'female',
  activityLevel: ActivityLevel
): number {
  const bmr = mifflinStJeor(weightKg, heightCm, age, sex);
  const multiplier = ACTIVITY_MULTIPLIER[activityLevel];
  return Math.round(bmr * multiplier);
}

/** ~500 kcal/day ≈ 0.5 kg/week */
const DEFICIT_SURPLUS_KCAL = 500;

/** ~7700 kcal per kg body mass change (approximate). */
const KCAL_PER_KG = 7700;

const EMPIRICAL_TDEE_MIN = 1000;
const EMPIRICAL_TDEE_MAX = 4000;

export interface RecommendedCaloriesResult {
  recommended_calories_min: number;
  recommended_calories_max: number;
}

/**
 * Compute empirical TDEE from average logged intake and observed weight trend.
 * For weight loss: deficit = |trend| * 7700/7 kcal/day, so TDEE = avgIntake + deficit.
 * For weight gain: surplus = trend * 7700/7, so TDEE = avgIntake - surplus.
 * Returns null if trend is too small (stable weight) or inputs invalid.
 * Result is clamped to [EMPIRICAL_TDEE_MIN, EMPIRICAL_TDEE_MAX].
 */
export function computeEmpiricalTDEE(
  avgCaloriesPerDay: number,
  trendKgPerWeek: number,
  losing: boolean
): number | null {
  if (avgCaloriesPerDay <= 0 || avgCaloriesPerDay > 10000) return null;
  const absTrend = Math.abs(trendKgPerWeek);
  if (absTrend < 0.01) return null; // effectively stable, can't infer TDEE
  const deficitOrSurplusPerDay = (absTrend * KCAL_PER_KG) / 7;
  const tdee =
    losing
      ? avgCaloriesPerDay + deficitOrSurplusPerDay
      : avgCaloriesPerDay - deficitOrSurplusPerDay;
  const clamped = Math.max(EMPIRICAL_TDEE_MIN, Math.min(EMPIRICAL_TDEE_MAX, Math.round(tdee)));
  return clamped;
}

/**
 * Safe range for ~0.5 kg/week toward goal. Loss: deficit; gain: surplus; else maintain.
 */
export function getRecommendedCalories(
  tdee: number,
  currentWeightKg: number,
  goalWeightKg: number
): RecommendedCaloriesResult {
  const diff = goalWeightKg - currentWeightKg;
  if (diff < -0.5) {
    return {
      recommended_calories_min: Math.max(1200, Math.round(tdee - DEFICIT_SURPLUS_KCAL - 100)),
      recommended_calories_max: Math.max(1200, Math.round(tdee - DEFICIT_SURPLUS_KCAL + 100)),
    };
  }
  if (diff > 0.5) {
    return {
      recommended_calories_min: Math.round(tdee + DEFICIT_SURPLUS_KCAL - 100),
      recommended_calories_max: Math.round(tdee + DEFICIT_SURPLUS_KCAL + 100),
    };
  }
  return {
    recommended_calories_min: Math.round(tdee - 100),
    recommended_calories_max: Math.round(tdee + 100),
  };
}
