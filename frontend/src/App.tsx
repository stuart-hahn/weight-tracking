import { useState, useCallback, useEffect } from 'react';
import { createUser, login, createEntry, getUser, setToken, hasToken, clearToken } from './api/client';
import type { CreateUserRequest, CreateEntryRequest, LoginRequest } from './types/api';
import LoginForm from './components/LoginForm';
import SignupForm from './components/SignupForm';
import DailyLogForm from './components/DailyLogForm';
import './App.css';

type AuthMode = 'login' | 'signup';

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
  const [authMode, setAuthMode] = useState<AuthMode>('login');
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

  const handleLogin = useCallback(async (body: LoginRequest) => {
    setError(null);
    setSuccess(null);
    try {
      const res = await login(body);
      setToken(res.token);
      storeUserId(res.user.id);
      setUserId(res.user.id);
      setSuccess('Welcome back.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Log in failed');
    }
  }, []);

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
          <div className="app__card">
            <div className="auth-tabs" role="tablist" aria-label="Log in or create account">
              <button
                type="button"
                role="tab"
                aria-selected={authMode === 'login'}
                aria-controls="auth-panel"
                id="tab-login"
                className={`auth-tabs__tab ${authMode === 'login' ? 'auth-tabs__tab--active' : ''}`}
                onClick={() => { setAuthMode('login'); setError(null); setSuccess(null); }}
              >
                Log in
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={authMode === 'signup'}
                aria-controls="auth-panel"
                id="tab-signup"
                className={`auth-tabs__tab ${authMode === 'signup' ? 'auth-tabs__tab--active' : ''}`}
                onClick={() => { setAuthMode('signup'); setError(null); setSuccess(null); }}
              >
                Create account
              </button>
            </div>
            <div id="auth-panel" role="tabpanel" aria-labelledby={authMode === 'login' ? 'tab-login' : 'tab-signup'}>
              {authMode === 'login' ? (
                <LoginForm onSubmit={handleLogin} />
              ) : (
                <SignupForm onSubmit={handleSignup} />
              )}
            </div>
          </div>
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
