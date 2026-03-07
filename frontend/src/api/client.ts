import type {
  CreateUserRequest,
  CreateUserResponse,
  LoginRequest,
  UpdateUserRequest,
  UserProfile,
  CreateEntryRequest,
  DailyEntryResponse,
  ProgressResponse,
  OptionalMetricResponse,
  ApiError,
} from '../types/api';

const API_BASE = '/api';

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

export async function createUser(body: CreateUserRequest): Promise<CreateUserResponse> {
  const res = await fetch(`${API_BASE}/users`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(body),
  });
  const data = (await res.json()) as CreateUserResponse | ApiError;
  if (!res.ok) throw new Error('error' in data ? data.error : 'Failed to create user');
  return data as CreateUserResponse;
}

export async function login(body: LoginRequest): Promise<CreateUserResponse> {
  const res = await fetch(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(body),
  });
  const data = (await res.json()) as CreateUserResponse | ApiError;
  if (!res.ok) throw new Error('error' in data ? data.error : 'Failed to log in');
  return data as CreateUserResponse;
}

export async function requestPasswordReset(email: string): Promise<{ message: string }> {
  const res = await fetch(`${API_BASE}/auth/forgot-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: email.trim() }),
  });
  const data = (await res.json()) as { message?: string } | ApiError;
  if (!res.ok) throw new Error('error' in data ? data.error : 'Request failed');
  return data as { message: string };
}

export async function resetPassword(token: string, password: string): Promise<{ message: string }> {
  const res = await fetch(`${API_BASE}/auth/reset-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token, password }),
  });
  const data = (await res.json()) as { message?: string } | ApiError;
  if (!res.ok) throw new Error('error' in data ? data.error : 'Reset failed');
  return data as { message: string };
}

export async function verifyEmail(token: string): Promise<{ message: string }> {
  const res = await fetch(`${API_BASE}/auth/verify-email`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token }),
  });
  const data = (await res.json()) as { message?: string } | ApiError;
  if (!res.ok) throw new Error('error' in data ? (data as ApiError).error : 'Verification failed');
  return data as { message: string };
}

export async function getUser(id: string): Promise<UserProfile> {
  const res = await fetch(`${API_BASE}/users/${id}`, { headers: getAuthHeaders() });
  const data = (await res.json()) as UserProfile | ApiError;
  if (!res.ok) throw new Error('error' in data ? data.error : 'Failed to fetch user');
  return data as UserProfile;
}

export async function updateUser(userId: string, body: UpdateUserRequest): Promise<UserProfile> {
  const res = await fetch(`${API_BASE}/users/${userId}`, {
    method: 'PATCH',
    headers: getAuthHeaders(),
    body: JSON.stringify(body),
  });
  const data = (await res.json()) as UserProfile | ApiError;
  if (!res.ok) throw new Error('error' in data ? data.error : 'Failed to update profile');
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
  if (!res.ok) throw new Error('error' in data ? data.error : 'Failed to create entry');
  return data as DailyEntryResponse;
}

export async function getEntries(userId: string): Promise<DailyEntryResponse[]> {
  const res = await fetch(`${API_BASE}/users/${userId}/entries`, { headers: getAuthHeaders() });
  const data = (await res.json()) as DailyEntryResponse[] | ApiError;
  if (!res.ok) throw new Error((data as ApiError).error ?? 'Failed to fetch entries');
  return data as DailyEntryResponse[];
}

export async function getProgress(userId: string): Promise<ProgressResponse> {
  const res = await fetch(`${API_BASE}/users/${userId}/progress`, { headers: getAuthHeaders() });
  const data = (await res.json()) as ProgressResponse | ApiError;
  if (!res.ok) throw new Error('error' in data ? data.error : 'Failed to fetch progress');
  return data as ProgressResponse;
}

export async function getOptionalMetrics(userId: string): Promise<OptionalMetricResponse[]> {
  const res = await fetch(`${API_BASE}/users/${userId}/optional-metrics`, { headers: getAuthHeaders() });
  const data = (await res.json()) as OptionalMetricResponse[] | ApiError;
  if (!res.ok) throw new Error('error' in data ? (data as ApiError).error : 'Failed to fetch optional metrics');
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
  if (!res.ok) throw new Error('error' in data ? (data as ApiError).error : 'Failed to save body fat');
  return data as OptionalMetricResponse;
}

export async function exportUserData(userId: string): Promise<void> {
  const res = await fetch(`${API_BASE}/users/${userId}/export`, { headers: getAuthHeaders() });
  if (!res.ok) {
    const data = (await res.json()) as ApiError;
    throw new Error('error' in data ? data.error : 'Failed to export data');
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
