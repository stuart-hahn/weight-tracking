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

export interface RecommendedCaloriesResult {
  recommended_calories_min: number;
  recommended_calories_max: number;
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
