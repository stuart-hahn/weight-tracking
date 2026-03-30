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

export type WorkoutExerciseKind = 'weight_reps' | 'bodyweight_reps' | 'time';

export interface ExerciseListItem {
  id: string;
  user_id: string | null;
  name: string;
  kind: WorkoutExerciseKind;
  is_custom: boolean;
  is_favorite: boolean;
  created_at: string;
}

export interface ExerciseInsightsResponse {
  exercise_id: string;
  last_performance: {
    workout_id: string;
    completed_at: string;
    sets: { weight_kg: number | null; reps: number | null; duration_sec: number | null }[];
  } | null;
  suggestion: {
    suggested_weight_kg: number | null;
    suggested_reps: number | null;
    hint: string;
  };
}

export interface WorkoutSetResponse {
  id: string;
  set_index: number;
  weight_kg: number | null;
  reps: number | null;
  duration_sec: number | null;
  notes: string | null;
  rest_seconds_after: number | null;
}

export interface WorkoutExerciseNested {
  id: string;
  exercise_id: string;
  order_index: number;
  notes: string | null;
  default_rest_seconds: number | null;
  exercise: {
    id: string;
    user_id: string | null;
    name: string;
    kind: WorkoutExerciseKind;
    is_custom: boolean;
    created_at: string;
  };
  sets: WorkoutSetResponse[];
}

export interface WorkoutListItem {
  id: string;
  user_id: string;
  name: string | null;
  notes: string | null;
  started_at: string;
  completed_at: string | null;
  created_at: string;
  exercise_count: number;
}

export interface WorkoutDetailResponse {
  id: string;
  user_id: string;
  name: string | null;
  notes: string | null;
  started_at: string;
  completed_at: string | null;
  created_at: string;
  exercises: WorkoutExerciseNested[];
}

export interface CreateWorkoutRequest {
  name?: string | null;
  notes?: string | null;
  clone_from_workout_id?: string | null;
}

export interface PatchWorkoutRequest {
  name?: string | null;
  notes?: string | null;
  completed_at?: string | null;
}

export interface CreateExerciseRequest {
  name: string;
  kind: WorkoutExerciseKind;
}

export interface AddWorkoutExerciseRequest {
  exercise_id: string;
  notes?: string | null;
  default_rest_seconds?: number | null;
  sets?: {
    weight_kg?: number | null;
    reps?: number | null;
    duration_sec?: number | null;
    notes?: string | null;
    rest_seconds_after?: number | null;
  }[];
}

export interface PatchWorkoutExerciseRequest {
  notes?: string | null;
  default_rest_seconds?: number | null;
  order_index?: number;
}

export interface PatchWorkoutSetRequest {
  weight_kg?: number | null;
  reps?: number | null;
  duration_sec?: number | null;
  notes?: string | null;
  rest_seconds_after?: number | null;
}
