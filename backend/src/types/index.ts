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
  timezone?: string | null;
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
  timezone: string | null;
  email_verified_at: string | null;
  onboarding_complete: boolean;
  plan: string | null;
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

/** Message slots for progress UI (motivational messaging) */
export interface ProgressMessagesType {
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

/** Recovery suggestion when user is behind pace */
export interface RecoveryType {
  recovery_weekly_rate_kg: number;
  recovery_calorie_adjustment_kcal: number | null;
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
  estimated_goal_date?: string | null;
  estimated_goal_message?: string;
  lean_mass_kg?: number;
  lean_mass_is_estimated?: boolean;
  estimated_body_fat_percent?: number | null;
  body_fat_is_estimated?: boolean;
  timezone?: string | null;
  trend_std_error?: number | null;
  trend_entries_count?: number | null;
  estimated_goal_date_early?: string | null;
  estimated_goal_date_late?: string | null;
  estimate_basis?: string | null;
  pace_status?: 'ahead' | 'on_track' | 'slightly_behind' | 'behind' | null;
  recovery?: RecoveryType | null;
  messages?: ProgressMessagesType;
  logging_streak_days?: number | null;
  entries_this_week?: number | null;
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
