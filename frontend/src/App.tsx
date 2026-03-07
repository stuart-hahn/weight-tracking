import { useState, useCallback, useEffect } from 'react';
import { createUser, createEntry, getUser, setToken, hasToken, clearToken } from './api/client';
import type { CreateUserRequest, CreateEntryRequest } from './types/api';
import SignupForm from './components/SignupForm';
import DailyLogForm from './components/DailyLogForm';
import './App.css';

const USER_ID_KEY = 'body_fat_tracker_user_id';

function getStoredUserId(): string | null {
  return localStorage.getItem(USER_ID_KEY);
}

function clearStoredUserId(): void {
  localStorage.removeItem(USER_ID_KEY);
}

function storeUserId(id: string): void {
  localStorage.setItem(USER_ID_KEY, id);
}

export default function App() {
  const [userId, setUserId] = useState<string | null>(() => getStoredUserId());
  const [tokenReady, setTokenReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    if (!hasToken() || !userId) {
      setTokenReady(true);
      return;
    }
    getUser(userId)
      .then(() => setTokenReady(true))
      .catch(() => {
        clearToken();
        clearStoredUserId();
        setUserId(null);
        setTokenReady(true);
      });
  }, [userId]);

  const handleSignup = useCallback(async (body: CreateUserRequest) => {
    setError(null);
    setSuccess(null);
    try {
      const res = await createUser(body);
      setToken(res.token);
      storeUserId(res.user.id);
      setUserId(res.user.id);
      setSuccess('Account created. You can log your first entry below.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Signup failed');
    }
  }, []);

  const handleLogout = useCallback(() => {
    clearToken();
    clearStoredUserId();
    setUserId(null);
    setSuccess(null);
    setError(null);
  }, []);

  const handleEntrySubmit = useCallback(async (body: CreateEntryRequest) => {
    if (!userId) return;
    setError(null);
    setSuccess(null);
    try {
      await createEntry(userId, body);
      setSuccess('Entry saved.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save entry');
    }
  }, [userId]);

  if (!tokenReady) {
    return (
      <div className="app">
        <div className="app__main">
          <p>Loading…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="app">
      <header className="app__header">
        <h1 className="app__title">Body Fat Tracker</h1>
        <p className="app__subtitle">Track weight & progress toward your goal</p>
      </header>

      <main className="app__main">
        {error && <div className="app__error" role="alert">{error}</div>}
        {success && <div className="app__success" role="status">{success}</div>}

        {!userId ? (
          <SignupForm onSubmit={handleSignup} />
        ) : (
          <>
            <DailyLogForm onSubmit={handleEntrySubmit} userId={userId} />
            <div className="app__logout">
              <button type="button" className="btn btn--secondary" onClick={handleLogout}>
                Sign out
              </button>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
