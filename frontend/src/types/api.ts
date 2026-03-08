/** API response and request types – aligned with backend */

export type ActivityLevel = 'sedentary' | 'light' | 'moderate' | 'very_active';

export type UnitsPreference = 'metric' | 'imperial';

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
  created_at: string;
  updated_at: string;
}

export interface CreateUserRequest {
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

export interface CreateUserResponse {
  user: { id: string; email: string; onboarding_complete: boolean; email_verified_at: string | null };
  token: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface UpdateUserRequest {
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
}

export interface DailyEntryResponse {
  id: string;
  user_id: string;
  date: string;
  weight_kg: number;
  calories: number | null;
  waist_cm: number | null;
  hip_cm: number | null;
  created_at: string;
}

export interface CreateEntryRequest {
  date: string;
  weight_kg: number;
  calories?: number | null;
  waist_cm?: number | null;
  hip_cm?: number | null;
}

export interface UpdateEntryRequest {
  weight_kg?: number;
  calories?: number | null;
  waist_cm?: number | null;
  hip_cm?: number | null;
}

export interface WeeklySummaryResponse {
  weight_change_kg: number | null;
  on_track: boolean | null;
  message: string;
}

export interface ProgressResponse {
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
  weekly_summary: WeeklySummaryResponse;
  estimated_goal_date?: string | null;
  estimated_goal_message?: string;
  lean_mass_kg?: number;
  lean_mass_is_estimated?: boolean;
}

export interface OptionalMetricResponse {
  id: string;
  user_id: string;
  date: string;
  body_fat_percent: number | null;
  created_at: string;
}

export interface ApiError {
  error: string;
}
