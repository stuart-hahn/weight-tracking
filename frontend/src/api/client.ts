import type {
  CreateUserRequest,
  CreateUserResponse,
  LoginRequest,
  UserProfile,
  CreateEntryRequest,
  DailyEntryResponse,
  ProgressResponse,
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

export async function getUser(id: string): Promise<UserProfile> {
  const res = await fetch(`${API_BASE}/users/${id}`, { headers: getAuthHeaders() });
  const data = (await res.json()) as UserProfile | ApiError;
  if (!res.ok) throw new Error('error' in data ? data.error : 'Failed to fetch user');
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

export function setToken(token: string): void {
  localStorage.setItem('token', token);
}

export function clearToken(): void {
  localStorage.removeItem('token');
}

export function hasToken(): boolean {
  return !!getToken();
}
