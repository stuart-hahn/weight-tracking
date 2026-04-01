/**
 * Strongly-typed domain and API types for Body Fat Tracker.
 * All fields align with database schema and API contracts.
 */

export type ActivityLevel = 'sedentary' | 'light' | 'moderate' | 'very_active';

export type UnitsPreference = 'metric' | 'imperial';

export interface User {
  id: string;
  email: string;
  password_hash: string;
  age: number;
  sex: 'male' | 'female';
  height_cm: number;
  current_weight_kg: number;
  target_body_fat_percent: number;
  activity_level: ActivityLevel | null;
  lean_mass_kg: number | null;
  units: UnitsPreference;
  created_at: Date;
  updated_at: Date;
}

export interface UserCreateInput {
  email: string;
  password: string;
  age: number;
  sex: 'male' | 'female';
  height_cm: number;
  current_weight_kg: number;
  target_body_fat_percent: number;
  activity_level?: ActivityLevel | null;
  lean_mass_kg?: number | null;
  units?: UnitsPreference;
}

export interface UserUpdateInput {
  age?: number;
  sex?: 'male' | 'female';
  height_cm?: number;
  current_weight_kg?: number;
  target_body_fat_percent?: number;
  activity_level?: ActivityLevel | null;
  lean_mass_kg?: number | null;
  units?: UnitsPreference;
  onboarding_complete?: boolean;
  plan?: string | null;
  /** ISO date (YYYY-MM-DD) or datetime; null clears block start */
  training_block_started_at?: string | null;
  last_calibration_week_index?: number | null;
}

/** User without sensitive fields for API responses */
export interface UserProfile {
  id: string;
  email: string;
  age: number;
  sex: 'male' | 'female';
  height_cm: number;
  current_weight_kg: number;
  target_body_fat_percent: number;
  activity_level: ActivityLevel | null;
  lean_mass_kg: number | null;
  units: UnitsPreference;
  email_verified_at: string | null;
  onboarding_complete: boolean;
  plan: string | null;
  training_block_started_at: string | null;
  last_calibration_week_index: number | null;
  created_at: string;
  updated_at: string;
}

export interface DailyEntry {
  id: string;
  user_id: string;
  date: string; // YYYY-MM-DD
  weight_kg: number;
  calories: number | null;
  waist_cm: number | null;
  hip_cm: number | null;
  created_at: Date;
}

export interface DailyEntryCreateInput {
  date: string;
  weight_kg: number;
  calories?: number | null;
  waist_cm?: number | null;
  hip_cm?: number | null;
}

export interface DailyEntryUpdateInput {
  weight_kg?: number;
  calories?: number | null;
  waist_cm?: number | null;
  hip_cm?: number | null;
}

/** Weekly summary for progress */
export interface WeeklySummary {
  weight_change_kg: number | null;
  on_track: boolean | null;
  message: string;
}

/** Progress metrics with computed goal, trend, calories, and weekly summary */
export interface ProgressMetrics {
  user_id: string;
  units: UnitsPreference;
  start_weight_kg: number;
  current_weight_kg: number;
  goal_weight_kg: number;
  target_body_fat_percent: number;
  entries_count: number;
  latest_entry_date: string | null;
  weight_trend_kg_per_week: number | null;
  progress_percent: number | null;
  recommended_calories_min: number | null;
  recommended_calories_max: number | null;
  weekly_summary: WeeklySummary;
}

export interface OptionalMetricCreateInput {
  date: string; // YYYY-MM-DD
  body_fat_percent: number; // 0–100
}

export interface OptionalMetrics {
  user_id: string;
  date: string;
  body_fat_percent: number | null;
  created_at: Date;
}

/** Exercise kind for API and validation */
export type ExerciseKind = 'weight_reps' | 'bodyweight_reps' | 'time';

export interface ExerciseCreateInput {
  name: string;
  kind: ExerciseKind;
}

export interface ExerciseUpdateInput {
  name?: string;
  kind?: ExerciseKind;
}

/** POST .../exercises/:exerciseId/duplicate — copy visible exercise to user's catalog */
export interface ExerciseDuplicateInput {
  name?: string | null;
}

export interface WorkoutCreateInput {
  name?: string | null;
  notes?: string | null;
  clone_from_workout_id?: string | null;
  program_day_id?: string | null;
}

export interface WorkoutUpdateInput {
  name?: string | null;
  notes?: string | null;
  completed_at?: string | null; // ISO datetime; set to mark complete (use "now" convention: non-null string)
}

export interface WorkoutExerciseCreateInput {
  exercise_id: string;
  notes?: string | null;
  default_rest_seconds?: number | null;
  /** If this line uses a substitute exercise, primary exercise id for analytics */
  substituted_from_exercise_id?: string | null;
  /** Pre-fill sets (e.g. from template); otherwise one empty set is created */
  sets?: WorkoutSetCreateInput[];
}

export interface WorkoutExerciseUpdateInput {
  notes?: string | null;
  default_rest_seconds?: number | null;
  order_index?: number;
  /** Swap to another exercise (e.g. substitute); resets sets to one empty row */
  exercise_id?: string;
  substituted_from_exercise_id?: string | null;
}

export interface WorkoutSetCreateInput {
  weight_kg?: number | null;
  reps?: number | null;
  duration_sec?: number | null;
  notes?: string | null;
  rest_seconds_after?: number | null;
  rir?: number | null;
  set_role?: string | null;
  target_reps_min?: number | null;
  target_reps_max?: number | null;
  target_rir_min?: number | null;
  target_rir_max?: number | null;
  calibration_to_failure?: boolean;
  completed_at?: string | null;
  set_kind?: string | null;
  actual_rest_seconds?: number | null;
}

export interface WorkoutSetUpdateInput {
  weight_kg?: number | null;
  reps?: number | null;
  duration_sec?: number | null;
  notes?: string | null;
  rest_seconds_after?: number | null;
  rir?: number | null;
  set_role?: string | null;
  target_reps_min?: number | null;
  target_reps_max?: number | null;
  target_rir_min?: number | null;
  target_rir_max?: number | null;
  calibration_to_failure?: boolean;
  completed_at?: string | null;
  set_kind?: string | null;
  actual_rest_seconds?: number | null;
}

/** POST /exercises/:id/substitutions */
export interface ExerciseSubstitutionCreateInput {
  substitute_exercise_id: string;
}

/** POST /exercises/batch-insights */
export interface ExerciseBatchInsightsInput {
  exercise_ids: string[];
  progression_variant_by_exercise_id?: Record<string, string>;
}
