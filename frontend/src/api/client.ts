import type {
  CreateUserRequest,
  CreateUserResponse,
  LoginRequest,
  UpdateUserRequest,
  UserProfile,
  CreateEntryRequest,
  UpdateEntryRequest,
  DailyEntryResponse,
  ProgressResponse,
  OptionalMetricResponse,
  ApiError,
  ExerciseListItem,
  ExerciseInsightsResponse,
  WorkoutListItem,
  WorkoutDetailResponse,
  CreateWorkoutRequest,
  PatchWorkoutRequest,
  CreateExerciseRequest,
  PatchExerciseRequest,
  DuplicateExerciseRequest,
  AddWorkoutExerciseRequest,
  PatchWorkoutExerciseRequest,
  PatchWorkoutSetRequest,
  WorkoutExerciseNested,
  WorkoutSetResponse,
  BatchExerciseInsightsRequest,
  BatchExerciseInsightsResponse,
  WorkoutProgramListItem,
  WorkoutProgramDetailResponse,
} from '../types/api';

const API_BASE = import.meta.env.VITE_API_URL ?? '/api';

function getToken(): string | null {
  return localStorage.getItem('token');
}

function getAuthHeaders(): HeadersInit {
  const token = getToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  return headers;
}

const RATE_LIMIT_MESSAGE = 'Too many attempts. Please wait a few minutes and try again.';

function getErrorMessage(res: Response, data: ApiError | unknown, fallback: string): string {
  if (res.status === 429) return RATE_LIMIT_MESSAGE;
  return data != null && typeof data === 'object' && 'error' in data && typeof (data as ApiError).error === 'string'
    ? (data as ApiError).error
    : fallback;
}

export async function createUser(body: CreateUserRequest): Promise<CreateUserResponse> {
  const res = await fetch(`${API_BASE}/users`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(body),
  });
  const data = (await res.json()) as CreateUserResponse | ApiError;
  if (!res.ok) throw new Error(getErrorMessage(res, data, 'Failed to create user'));
  return data as CreateUserResponse;
}

export async function login(body: LoginRequest): Promise<CreateUserResponse> {
  const res = await fetch(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(body),
  });
  const data = (await res.json()) as CreateUserResponse | ApiError;
  if (!res.ok) throw new Error(getErrorMessage(res, data, 'Failed to log in'));
  return data as CreateUserResponse;
}

export async function requestPasswordReset(email: string): Promise<{ message: string }> {
  const res = await fetch(`${API_BASE}/auth/forgot-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: email.trim() }),
  });
  const data = (await res.json()) as { message?: string } | ApiError;
  if (!res.ok) throw new Error(getErrorMessage(res, data, 'Request failed'));
  return data as { message: string };
}

export async function resetPassword(token: string, password: string): Promise<{ message: string }> {
  const res = await fetch(`${API_BASE}/auth/reset-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token, password }),
  });
  const data = (await res.json()) as { message?: string } | ApiError;
  if (!res.ok) throw new Error(getErrorMessage(res, data, 'Reset failed'));
  return data as { message: string };
}

export async function verifyEmail(token: string): Promise<{ message: string }> {
  const res = await fetch(`${API_BASE}/auth/verify-email`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token }),
  });
  const data = (await res.json()) as { message?: string } | ApiError;
  if (!res.ok) throw new Error(getErrorMessage(res, data, 'Verification failed'));
  return data as { message: string };
}

export async function getUser(id: string): Promise<UserProfile> {
  const res = await fetch(`${API_BASE}/users/${id}`, { headers: getAuthHeaders() });
  const data = (await res.json()) as UserProfile | ApiError;
  if (!res.ok) throw new Error(getErrorMessage(res, data, 'Failed to fetch user'));
  return data as UserProfile;
}

export async function updateUser(userId: string, body: UpdateUserRequest): Promise<UserProfile> {
  const res = await fetch(`${API_BASE}/users/${userId}`, {
    method: 'PATCH',
    headers: getAuthHeaders(),
    body: JSON.stringify(body),
  });
  const data = (await res.json()) as UserProfile | ApiError;
  if (!res.ok) throw new Error(getErrorMessage(res, data, 'Failed to update profile'));
  return data as UserProfile;
}

export async function createEntry(
  userId: string,
  body: CreateEntryRequest
): Promise<DailyEntryResponse> {
  const res = await fetch(`${API_BASE}/users/${userId}/entries`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(body),
  });
  const data = (await res.json()) as DailyEntryResponse | ApiError;
  if (!res.ok) throw new Error(getErrorMessage(res, data, 'Failed to create entry'));
  return data as DailyEntryResponse;
}

export async function updateEntry(
  userId: string,
  entryId: string,
  body: UpdateEntryRequest
): Promise<DailyEntryResponse> {
  const res = await fetch(`${API_BASE}/users/${userId}/entries/${entryId}`, {
    method: 'PATCH',
    headers: getAuthHeaders(),
    body: JSON.stringify(body),
  });
  const data = (await res.json()) as DailyEntryResponse | ApiError;
  if (!res.ok) throw new Error(getErrorMessage(res, data, 'Failed to update entry'));
  return data as DailyEntryResponse;
}

export async function deleteEntry(userId: string, entryId: string): Promise<void> {
  const res = await fetch(`${API_BASE}/users/${userId}/entries/${entryId}`, {
    method: 'DELETE',
    headers: getAuthHeaders(),
  });
  if (!res.ok) {
    const data = (await res.json()) as ApiError;
    throw new Error(getErrorMessage(res, data, 'Failed to delete entry'));
  }
}

export async function getEntries(userId: string): Promise<DailyEntryResponse[]> {
  const res = await fetch(`${API_BASE}/users/${userId}/entries`, { headers: getAuthHeaders() });
  const data = (await res.json()) as DailyEntryResponse[] | ApiError;
  if (!res.ok) throw new Error(getErrorMessage(res, data, 'Failed to fetch entries'));
  return data as DailyEntryResponse[];
}

export async function getProgress(userId: string): Promise<ProgressResponse> {
  const res = await fetch(`${API_BASE}/users/${userId}/progress`, { headers: getAuthHeaders() });
  const data = (await res.json()) as ProgressResponse | ApiError;
  if (!res.ok) throw new Error(getErrorMessage(res, data, 'Failed to fetch progress'));
  return data as ProgressResponse;
}

export async function getOptionalMetrics(userId: string): Promise<OptionalMetricResponse[]> {
  const res = await fetch(`${API_BASE}/users/${userId}/optional-metrics`, { headers: getAuthHeaders() });
  const data = (await res.json()) as OptionalMetricResponse[] | ApiError;
  if (!res.ok) throw new Error(getErrorMessage(res, data, 'Failed to fetch optional metrics'));
  return data as OptionalMetricResponse[];
}

export async function upsertOptionalMetric(
  userId: string,
  date: string,
  body_fat_percent: number
): Promise<OptionalMetricResponse> {
  const res = await fetch(`${API_BASE}/users/${userId}/optional-metrics`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({ date, body_fat_percent }),
  });
  const data = (await res.json()) as OptionalMetricResponse | ApiError;
  if (!res.ok) throw new Error(getErrorMessage(res, data, 'Failed to save body fat'));
  return data as OptionalMetricResponse;
}

export async function deleteOptionalMetric(userId: string, date: string): Promise<void> {
  const sp = new URLSearchParams({ date });
  const res = await fetch(`${API_BASE}/users/${userId}/optional-metrics?${sp.toString()}`, {
    method: 'DELETE',
    headers: getAuthHeaders(),
  });
  if (!res.ok) {
    const data = (await res.json()) as ApiError;
    throw new Error(getErrorMessage(res, data, 'Failed to delete body fat'));
  }
}

export async function listExercises(
  userId: string,
  params?: { q?: string; favorites_only?: boolean; custom_only?: boolean }
): Promise<ExerciseListItem[]> {
  const sp = new URLSearchParams();
  if (params?.q) sp.set('q', params.q);
  if (params?.favorites_only) sp.set('favorites_only', 'true');
  if (params?.custom_only) sp.set('custom_only', 'true');
  const q = sp.toString();
  const res = await fetch(`${API_BASE}/users/${userId}/exercises${q ? `?${q}` : ''}`, { headers: getAuthHeaders() });
  const data = (await res.json()) as ExerciseListItem[] | ApiError;
  if (!res.ok) throw new Error(getErrorMessage(res, data, 'Failed to fetch exercises'));
  return data as ExerciseListItem[];
}

export async function getExercise(userId: string, exerciseId: string): Promise<ExerciseListItem> {
  const res = await fetch(`${API_BASE}/users/${userId}/exercises/${exerciseId}`, { headers: getAuthHeaders() });
  const data = (await res.json()) as ExerciseListItem | ApiError;
  if (!res.ok) throw new Error(getErrorMessage(res, data, 'Failed to fetch exercise'));
  return data as ExerciseListItem;
}

export async function createExercise(userId: string, body: CreateExerciseRequest): Promise<ExerciseListItem> {
  const res = await fetch(`${API_BASE}/users/${userId}/exercises`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(body),
  });
  const data = (await res.json()) as ExerciseListItem | ApiError;
  if (!res.ok) throw new Error(getErrorMessage(res, data, 'Failed to create exercise'));
  return data as ExerciseListItem;
}

export async function updateExercise(
  userId: string,
  exerciseId: string,
  body: PatchExerciseRequest
): Promise<ExerciseListItem> {
  const res = await fetch(`${API_BASE}/users/${userId}/exercises/${exerciseId}`, {
    method: 'PATCH',
    headers: getAuthHeaders(),
    body: JSON.stringify(body),
  });
  const data = (await res.json()) as ExerciseListItem | ApiError;
  if (!res.ok) throw new Error(getErrorMessage(res, data, 'Failed to update exercise'));
  return data as ExerciseListItem;
}

export async function deleteExercise(userId: string, exerciseId: string): Promise<void> {
  const res = await fetch(`${API_BASE}/users/${userId}/exercises/${exerciseId}`, {
    method: 'DELETE',
    headers: getAuthHeaders(),
  });
  if (!res.ok) {
    const data = (await res.json()) as ApiError;
    throw new Error(getErrorMessage(res, data, 'Failed to delete exercise'));
  }
}

export async function duplicateExercise(
  userId: string,
  exerciseId: string,
  body: DuplicateExerciseRequest = {}
): Promise<ExerciseListItem> {
  const res = await fetch(`${API_BASE}/users/${userId}/exercises/${exerciseId}/duplicate`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(body),
  });
  const data = (await res.json()) as ExerciseListItem | ApiError;
  if (!res.ok) throw new Error(getErrorMessage(res, data, 'Failed to duplicate exercise'));
  return data as ExerciseListItem;
}

export async function getExerciseInsights(userId: string, exerciseId: string): Promise<ExerciseInsightsResponse> {
  const res = await fetch(`${API_BASE}/users/${userId}/exercises/${exerciseId}/insights`, { headers: getAuthHeaders() });
  const data = (await res.json()) as ExerciseInsightsResponse | ApiError;
  if (!res.ok) throw new Error(getErrorMessage(res, data, 'Failed to fetch exercise insights'));
  return data as ExerciseInsightsResponse;
}

export async function postBatchExerciseInsights(
  userId: string,
  body: BatchExerciseInsightsRequest
): Promise<BatchExerciseInsightsResponse> {
  const res = await fetch(`${API_BASE}/users/${userId}/exercises/batch-insights`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(body),
  });
  const data = (await res.json()) as BatchExerciseInsightsResponse | ApiError;
  if (!res.ok) throw new Error(getErrorMessage(res, data, 'Failed to fetch exercise insights'));
  return data as BatchExerciseInsightsResponse;
}

export async function addExerciseFavorite(userId: string, exerciseId: string): Promise<void> {
  const res = await fetch(`${API_BASE}/users/${userId}/exercises/${exerciseId}/favorite`, {
    method: 'POST',
    headers: getAuthHeaders(),
  });
  if (!res.ok) {
    const data = (await res.json()) as ApiError;
    throw new Error(getErrorMessage(res, data, 'Failed to add favorite'));
  }
}

export async function removeExerciseFavorite(userId: string, exerciseId: string): Promise<void> {
  const res = await fetch(`${API_BASE}/users/${userId}/exercises/${exerciseId}/favorite`, {
    method: 'DELETE',
    headers: getAuthHeaders(),
  });
  if (!res.ok) {
    const data = (await res.json()) as ApiError;
    throw new Error(getErrorMessage(res, data, 'Failed to remove favorite'));
  }
}

export async function listWorkouts(
  userId: string,
  params?: { status?: 'in_progress' | 'completed'; limit?: number }
): Promise<WorkoutListItem[]> {
  const sp = new URLSearchParams();
  if (params?.status) sp.set('status', params.status);
  if (params?.limit != null) sp.set('limit', String(params.limit));
  const q = sp.toString();
  const res = await fetch(`${API_BASE}/users/${userId}/workouts${q ? `?${q}` : ''}`, { headers: getAuthHeaders() });
  const data = (await res.json()) as WorkoutListItem[] | ApiError;
  if (!res.ok) throw new Error(getErrorMessage(res, data, 'Failed to fetch workouts'));
  return data as WorkoutListItem[];
}

export async function createWorkout(userId: string, body: CreateWorkoutRequest = {}): Promise<WorkoutDetailResponse> {
  const res = await fetch(`${API_BASE}/users/${userId}/workouts`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(body),
  });
  const data = (await res.json()) as WorkoutDetailResponse | ApiError;
  if (!res.ok) throw new Error(getErrorMessage(res, data, 'Failed to create workout'));
  return data as WorkoutDetailResponse;
}

export async function getWorkout(userId: string, workoutId: string): Promise<WorkoutDetailResponse> {
  const res = await fetch(`${API_BASE}/users/${userId}/workouts/${workoutId}`, { headers: getAuthHeaders() });
  const data = (await res.json()) as WorkoutDetailResponse | ApiError;
  if (!res.ok) throw new Error(getErrorMessage(res, data, 'Failed to fetch workout'));
  return data as WorkoutDetailResponse;
}

export async function patchWorkout(
  userId: string,
  workoutId: string,
  body: PatchWorkoutRequest
): Promise<WorkoutDetailResponse> {
  const res = await fetch(`${API_BASE}/users/${userId}/workouts/${workoutId}`, {
    method: 'PATCH',
    headers: getAuthHeaders(),
    body: JSON.stringify(body),
  });
  const data = (await res.json()) as WorkoutDetailResponse | ApiError;
  if (!res.ok) throw new Error(getErrorMessage(res, data, 'Failed to update workout'));
  return data as WorkoutDetailResponse;
}

export async function deleteWorkout(userId: string, workoutId: string): Promise<void> {
  const res = await fetch(`${API_BASE}/users/${userId}/workouts/${workoutId}`, {
    method: 'DELETE',
    headers: getAuthHeaders(),
  });
  if (!res.ok) {
    const data = (await res.json()) as ApiError;
    throw new Error(getErrorMessage(res, data, 'Failed to delete workout'));
  }
}

export async function addWorkoutExercise(
  userId: string,
  workoutId: string,
  body: AddWorkoutExerciseRequest
): Promise<WorkoutExerciseNested> {
  const res = await fetch(`${API_BASE}/users/${userId}/workouts/${workoutId}/exercises`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(body),
  });
  const data = (await res.json()) as WorkoutExerciseNested | ApiError;
  if (!res.ok) throw new Error(getErrorMessage(res, data, 'Failed to add exercise'));
  return data as WorkoutExerciseNested;
}

export async function patchWorkoutExercise(
  userId: string,
  workoutId: string,
  lineId: string,
  body: PatchWorkoutExerciseRequest
): Promise<WorkoutExerciseNested> {
  const res = await fetch(`${API_BASE}/users/${userId}/workouts/${workoutId}/exercises/${lineId}`, {
    method: 'PATCH',
    headers: getAuthHeaders(),
    body: JSON.stringify(body),
  });
  const data = (await res.json()) as WorkoutExerciseNested | ApiError;
  if (!res.ok) throw new Error(getErrorMessage(res, data, 'Failed to update exercise line'));
  return data as WorkoutExerciseNested;
}

export async function deleteWorkoutExercise(userId: string, workoutId: string, lineId: string): Promise<void> {
  const res = await fetch(`${API_BASE}/users/${userId}/workouts/${workoutId}/exercises/${lineId}`, {
    method: 'DELETE',
    headers: getAuthHeaders(),
  });
  if (!res.ok) {
    const data = (await res.json()) as ApiError;
    throw new Error(getErrorMessage(res, data, 'Failed to remove exercise'));
  }
}

export async function addWorkoutSet(
  userId: string,
  workoutId: string,
  lineId: string,
  body: PatchWorkoutSetRequest = {}
): Promise<WorkoutSetResponse> {
  const res = await fetch(`${API_BASE}/users/${userId}/workouts/${workoutId}/exercises/${lineId}/sets`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(body),
  });
  const data = (await res.json()) as WorkoutSetResponse | ApiError;
  if (!res.ok) throw new Error(getErrorMessage(res, data, 'Failed to add set'));
  return data as WorkoutSetResponse;
}

export async function patchWorkoutSet(
  userId: string,
  workoutId: string,
  lineId: string,
  setId: string,
  body: PatchWorkoutSetRequest
): Promise<WorkoutSetResponse> {
  const res = await fetch(`${API_BASE}/users/${userId}/workouts/${workoutId}/exercises/${lineId}/sets/${setId}`, {
    method: 'PATCH',
    headers: getAuthHeaders(),
    body: JSON.stringify(body),
  });
  const data = (await res.json()) as WorkoutSetResponse | ApiError;
  if (!res.ok) throw new Error(getErrorMessage(res, data, 'Failed to update set'));
  return data as WorkoutSetResponse;
}

export async function deleteWorkoutSet(
  userId: string,
  workoutId: string,
  lineId: string,
  setId: string
): Promise<void> {
  const res = await fetch(`${API_BASE}/users/${userId}/workouts/${workoutId}/exercises/${lineId}/sets/${setId}`, {
    method: 'DELETE',
    headers: getAuthHeaders(),
  });
  if (!res.ok) {
    const data = (await res.json()) as ApiError;
    throw new Error(getErrorMessage(res, data, 'Failed to delete set'));
  }
}

const programsBase = (userId: string) => `${API_BASE}/users/${userId}/programs`;

export async function listWorkoutPrograms(userId: string): Promise<WorkoutProgramListItem[]> {
  const res = await fetch(programsBase(userId), { headers: getAuthHeaders() });
  const data = (await res.json()) as WorkoutProgramListItem[] | ApiError;
  if (!res.ok) throw new Error(getErrorMessage(res, data, 'Failed to load programs'));
  return data as WorkoutProgramListItem[];
}

export async function createWorkoutProgram(
  userId: string,
  body: { name: string; description?: string | null }
): Promise<WorkoutProgramDetailResponse> {
  const res = await fetch(programsBase(userId), {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(body),
  });
  const data = (await res.json()) as WorkoutProgramDetailResponse | ApiError;
  if (!res.ok) throw new Error(getErrorMessage(res, data, 'Failed to create program'));
  return data as WorkoutProgramDetailResponse;
}

export async function getWorkoutProgram(userId: string, programId: string): Promise<WorkoutProgramDetailResponse> {
  const res = await fetch(`${programsBase(userId)}/${programId}`, { headers: getAuthHeaders() });
  const data = (await res.json()) as WorkoutProgramDetailResponse | ApiError;
  if (!res.ok) throw new Error(getErrorMessage(res, data, 'Failed to load program'));
  return data as WorkoutProgramDetailResponse;
}

export async function patchWorkoutProgram(
  userId: string,
  programId: string,
  body: { name?: string; description?: string | null }
): Promise<WorkoutProgramDetailResponse> {
  const res = await fetch(`${programsBase(userId)}/${programId}`, {
    method: 'PATCH',
    headers: getAuthHeaders(),
    body: JSON.stringify(body),
  });
  const data = (await res.json()) as WorkoutProgramDetailResponse | ApiError;
  if (!res.ok) throw new Error(getErrorMessage(res, data, 'Failed to update program'));
  return data as WorkoutProgramDetailResponse;
}

export async function deleteWorkoutProgram(userId: string, programId: string): Promise<void> {
  const res = await fetch(`${programsBase(userId)}/${programId}`, {
    method: 'DELETE',
    headers: getAuthHeaders(),
  });
  if (!res.ok) {
    const data = (await res.json()) as ApiError;
    throw new Error(getErrorMessage(res, data, 'Failed to delete program'));
  }
}

export async function createProgramDay(
  userId: string,
  programId: string,
  body: { name: string; order_index?: number }
): Promise<{ id: string; name: string; order_index: number; exercises: [] }> {
  const res = await fetch(`${programsBase(userId)}/${programId}/days`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(body),
  });
  const data = (await res.json()) as { id: string; name: string; order_index: number; exercises: [] } | ApiError;
  if (!res.ok) throw new Error(getErrorMessage(res, data, 'Failed to add day'));
  return data as { id: string; name: string; order_index: number; exercises: [] };
}

export async function patchProgramDay(
  userId: string,
  programId: string,
  dayId: string,
  body: { name?: string; order_index?: number }
): Promise<WorkoutProgramDetailResponse> {
  const res = await fetch(`${programsBase(userId)}/${programId}/days/${dayId}`, {
    method: 'PATCH',
    headers: getAuthHeaders(),
    body: JSON.stringify(body),
  });
  const data = (await res.json()) as WorkoutProgramDetailResponse | ApiError;
  if (!res.ok) throw new Error(getErrorMessage(res, data, 'Failed to update day'));
  return data as WorkoutProgramDetailResponse;
}

export async function deleteProgramDay(userId: string, programId: string, dayId: string): Promise<void> {
  const res = await fetch(`${programsBase(userId)}/${programId}/days/${dayId}`, {
    method: 'DELETE',
    headers: getAuthHeaders(),
  });
  if (!res.ok) {
    const data = (await res.json()) as ApiError;
    throw new Error(getErrorMessage(res, data, 'Failed to delete day'));
  }
}

export async function addProgramDayExercise(
  userId: string,
  programId: string,
  dayId: string,
  body: { exercise_id: string; progression_variant?: string; order_index?: number }
): Promise<import('../types/api').ProgramDayExerciseNested> {
  const res = await fetch(`${programsBase(userId)}/${programId}/days/${dayId}/exercises`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(body),
  });
  const data = (await res.json()) as import('../types/api').ProgramDayExerciseNested | ApiError;
  if (!res.ok) throw new Error(getErrorMessage(res, data, 'Failed to add exercise'));
  return data as import('../types/api').ProgramDayExerciseNested;
}

export async function patchProgramDayExercise(
  userId: string,
  programId: string,
  dayId: string,
  pdeId: string,
  body: { order_index?: number; progression_variant?: string }
): Promise<WorkoutProgramDetailResponse> {
  const res = await fetch(`${programsBase(userId)}/${programId}/days/${dayId}/exercises/${pdeId}`, {
    method: 'PATCH',
    headers: getAuthHeaders(),
    body: JSON.stringify(body),
  });
  const data = (await res.json()) as WorkoutProgramDetailResponse | ApiError;
  if (!res.ok) throw new Error(getErrorMessage(res, data, 'Failed to update exercise line'));
  return data as WorkoutProgramDetailResponse;
}

export async function deleteProgramDayExercise(
  userId: string,
  programId: string,
  dayId: string,
  pdeId: string
): Promise<void> {
  const res = await fetch(`${programsBase(userId)}/${programId}/days/${dayId}/exercises/${pdeId}`, {
    method: 'DELETE',
    headers: getAuthHeaders(),
  });
  if (!res.ok) {
    const data = (await res.json()) as ApiError;
    throw new Error(getErrorMessage(res, data, 'Failed to remove exercise'));
  }
}

export async function addProgramSetTemplate(
  userId: string,
  programId: string,
  dayId: string,
  pdeId: string,
  body: {
    set_role: string;
    set_index?: number;
    target_reps_min?: number | null;
    target_reps_max?: number | null;
    target_rir_min?: number | null;
    target_rir_max?: number | null;
    percent_of_top?: number | null;
  }
): Promise<import('../types/api').ProgramSetTemplateResponse> {
  const res = await fetch(`${programsBase(userId)}/${programId}/days/${dayId}/exercises/${pdeId}/templates`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(body),
  });
  const data = (await res.json()) as import('../types/api').ProgramSetTemplateResponse | ApiError;
  if (!res.ok) throw new Error(getErrorMessage(res, data, 'Failed to add template'));
  return data as import('../types/api').ProgramSetTemplateResponse;
}

export async function deleteProgramSetTemplate(
  userId: string,
  programId: string,
  dayId: string,
  pdeId: string,
  templateId: string
): Promise<void> {
  const res = await fetch(
    `${programsBase(userId)}/${programId}/days/${dayId}/exercises/${pdeId}/templates/${templateId}`,
    { method: 'DELETE', headers: getAuthHeaders() }
  );
  if (!res.ok) {
    const data = (await res.json()) as ApiError;
    throw new Error(getErrorMessage(res, data, 'Failed to delete template'));
  }
}

export async function exportUserData(userId: string): Promise<void> {
  const res = await fetch(`${API_BASE}/users/${userId}/export`, { headers: getAuthHeaders() });
  if (!res.ok) {
    const data = (await res.json()) as ApiError;
    throw new Error(getErrorMessage(res, data, 'Failed to export data'));
  }
  const data = await res.json();
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `body-fat-tracker-export-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

export function setToken(token: string): void {
  localStorage.setItem('token', token);
}

export function clearToken(): void {
  localStorage.removeItem('token');
}

export function hasToken(): boolean {
  return !!getToken();
}
