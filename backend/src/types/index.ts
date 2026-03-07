/**
 * Strongly-typed domain and API types for Body Fat Tracker.
 * All fields align with database schema and API contracts.
 */

export type ActivityLevel = 'sedentary' | 'light' | 'moderate' | 'very_active';

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
}

export interface UserUpdateInput {
  age?: number;
  sex?: 'male' | 'female';
  height_cm?: number;
  current_weight_kg?: number;
  target_body_fat_percent?: number;
  activity_level?: ActivityLevel | null;
  lean_mass_kg?: number | null;
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

/** Progress metrics (Phase 2 will add full calculations) */
export interface ProgressMetrics {
  user_id: string;
  current_weight_kg: number;
  goal_weight_kg: number;
  target_body_fat_percent: number;
  entries_count: number;
  latest_entry_date: string | null;
  /** Placeholder for trend data in Phase 2 */
  weight_trend_kg_per_week: number | null;
}

export interface OptionalMetrics {
  user_id: string;
  date: string;
  body_fat_percent: number | null;
  created_at: Date;
}
