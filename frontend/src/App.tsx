import { useState, useCallback, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { createUser, login, createEntry, getUser, setToken, hasToken, clearToken } from './api/client';
import type { CreateUserRequest, CreateEntryRequest, LoginRequest } from './types/api';
import LandingPage from './pages/LandingPage';
import LogPage from './pages/LogPage';
import ProgressPage from './pages/ProgressPage';
import SettingsPage from './pages/SettingsPage';
import ForgotPasswordPage from './pages/ForgotPasswordPage';
import ResetPasswordPage from './pages/ResetPasswordPage';
import OnboardingPage from './pages/OnboardingPage';
import Nav from './components/Nav';
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
  const [onboardingComplete, setOnboardingComplete] = useState<boolean | null>(null);
  const [authMode, setAuthMode] = useState<AuthMode>('login');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [progressRefreshTrigger, setProgressRefreshTrigger] = useState(0);

  useEffect(() => {
    if (!hasToken() || !userId) {
      setTokenReady(true);
      setOnboardingComplete(true);
      return;
    }
    getUser(userId)
      .then((profile) => {
        setTokenReady(true);
        setOnboardingComplete(profile.onboarding_complete);
      })
      .catch(() => {
        clearToken();
        clearStoredUserId();
        setUserId(null);
        setOnboardingComplete(null);
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
      setOnboardingComplete(res.user.onboarding_complete);
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
      setOnboardingComplete(res.user.onboarding_complete);
      setSuccess('Account created.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Signup failed');
    }
  }, []);

  const handleLogout = useCallback(() => {
    clearToken();
    clearStoredUserId();
    setUserId(null);
    setOnboardingComplete(null);
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
      setProgressRefreshTrigger((n) => n + 1);
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
    <BrowserRouter>
      <div className="app">
        <header className="app__header">
          <h1 className="app__title">Body Fat Tracker</h1>
          <p className="app__subtitle">Track weight & progress toward your goal</p>
        </header>

        <main className="app__main">
          {error && <div className="app__error" role="alert">{error}</div>}
          {success && <div className="app__success" role="status">{success}</div>}

          <Routes>
            <Route
              path="/"
              element={
                userId ? (
                  onboardingComplete === false ? (
                    <Navigate to="/onboarding" replace />
                  ) : (
                    <Navigate to="/log" replace />
                  )
                ) : (
                  <LandingPage
                    authMode={authMode}
                    onAuthModeChange={(mode) => { setAuthMode(mode); setError(null); setSuccess(null); }}
                    onLogin={handleLogin}
                    onSignup={handleSignup}
                  />
                )
              }
            />
            <Route
              path="/forgot-password"
              element={
                userId ? (
                  <Navigate to={onboardingComplete === false ? '/onboarding' : '/log'} replace />
                ) : (
                  <ForgotPasswordPage />
                )
              }
            />
            <Route
              path="/reset-password"
              element={userId ? <Navigate to="/log" replace /> : <ResetPasswordPage />}
            />
            <Route
              path="/onboarding"
              element={
                userId && onboardingComplete === false ? (
                  <>
                    <Nav onLogout={handleLogout} />
                    <OnboardingPage
                      userId={userId}
                      onComplete={() => setOnboardingComplete(true)}
                      onError={setError}
                    />
                  </>
                ) : userId ? (
                  <Navigate to="/log" replace />
                ) : (
                  <Navigate to="/" replace />
                )
              }
            />
            <Route
              path="/log"
              element={
                userId && onboardingComplete !== false ? (
                  <>
                    <Nav onLogout={handleLogout} />
                    <LogPage
                      userId={userId}
                      refreshTrigger={progressRefreshTrigger}
                      onSubmit={handleEntrySubmit}
                    />
                  </>
                ) : userId ? (
                  <Navigate to="/onboarding" replace />
                ) : (
                  <Navigate to="/" replace />
                )
              }
            />
            <Route
              path="/progress"
              element={
                userId && onboardingComplete !== false ? (
                  <>
                    <Nav onLogout={handleLogout} />
                    <ProgressPage userId={userId} refreshTrigger={progressRefreshTrigger} />
                  </>
                ) : userId ? (
                  <Navigate to="/onboarding" replace />
                ) : (
                  <Navigate to="/" replace />
                )
              }
            />
            <Route
              path="/settings"
              element={
                userId && onboardingComplete !== false ? (
                  <>
                    <Nav onLogout={handleLogout} />
                    <SettingsPage
                      userId={userId}
                      onError={setError}
                      onSuccess={setSuccess}
                    />
                  </>
                ) : userId ? (
                  <Navigate to="/onboarding" replace />
                ) : (
                  <Navigate to="/" replace />
                )
              }
            />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}
