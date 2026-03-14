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
  if (!res.ok) throw new Error(getErrorMessage(res, data, "We couldn't create your account. Try again."));
  return data as CreateUserResponse;
}

export async function login(body: LoginRequest): Promise<CreateUserResponse> {
  const res = await fetch(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(body),
  });
  const data = (await res.json()) as CreateUserResponse | ApiError;
  if (!res.ok) throw new Error(getErrorMessage(res, data, "We couldn't log you in. Check your email and password."));
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
  if (!res.ok) throw new Error(getErrorMessage(res, data, "We couldn't load your profile. Try again."));
  return data as UserProfile;
}

export async function resendVerificationEmail(userId: string): Promise<{ message: string }> {
  const res = await fetch(`${API_BASE}/users/${userId}/resend-verification`, {
    method: 'POST',
    headers: getAuthHeaders(),
  });
  const data = (await res.json()) as { message?: string } | ApiError;
  if (!res.ok) throw new Error(getErrorMessage(res, data, "We couldn't send the verification email. Try again."));
  return data as { message: string };
}

export async function updateUser(userId: string, body: UpdateUserRequest): Promise<UserProfile> {
  const res = await fetch(`${API_BASE}/users/${userId}`, {
    method: 'PATCH',
    headers: getAuthHeaders(),
    body: JSON.stringify(body),
  });
  const data = (await res.json()) as UserProfile | ApiError;
  if (!res.ok) throw new Error(getErrorMessage(res, data, "We couldn't update your profile. Try again."));
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
  if (!res.ok) throw new Error(getErrorMessage(res, data, "We couldn't save that. Try again."));
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
  if (!res.ok) throw new Error(getErrorMessage(res, data, "We couldn't update that entry. Try again."));
  return data as DailyEntryResponse;
}

export async function deleteEntry(userId: string, entryId: string): Promise<void> {
  const res = await fetch(`${API_BASE}/users/${userId}/entries/${entryId}`, {
    method: 'DELETE',
    headers: getAuthHeaders(),
  });
  if (!res.ok) {
    const data = (await res.json()) as ApiError;
    throw new Error(getErrorMessage(res, data, "We couldn't delete that entry. Try again."));
  }
}

export async function getEntries(userId: string): Promise<DailyEntryResponse[]> {
  const res = await fetch(`${API_BASE}/users/${userId}/entries`, { headers: getAuthHeaders() });
  const data = (await res.json()) as DailyEntryResponse[] | ApiError;
  if (!res.ok) throw new Error(getErrorMessage(res, data, "We couldn't load your entries. Try again."));
  return data as DailyEntryResponse[];
}

export async function getProgress(userId: string): Promise<ProgressResponse> {
  const res = await fetch(`${API_BASE}/users/${userId}/progress`, { headers: getAuthHeaders() });
  const data = (await res.json()) as ProgressResponse | ApiError;
  if (!res.ok) throw new Error(getErrorMessage(res, data, "We couldn't load your progress. Try again."));
  return data as ProgressResponse;
}

export async function getOptionalMetrics(userId: string): Promise<OptionalMetricResponse[]> {
  const res = await fetch(`${API_BASE}/users/${userId}/optional-metrics`, { headers: getAuthHeaders() });
  const data = (await res.json()) as OptionalMetricResponse[] | ApiError;
  if (!res.ok) throw new Error(getErrorMessage(res, data, "We couldn't load optional metrics. Try again."));
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
  if (!res.ok) throw new Error(getErrorMessage(res, data, "We couldn't save body fat. Try again."));
  return data as OptionalMetricResponse;
}

export async function exportUserData(userId: string): Promise<void> {
  const res = await fetch(`${API_BASE}/users/${userId}/export`, { headers: getAuthHeaders() });
  if (!res.ok) {
    const data = (await res.json()) as ApiError;
    throw new Error(getErrorMessage(res, data, "We couldn't export your data. Try again."));
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
