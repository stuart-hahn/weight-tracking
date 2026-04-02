import React, { useState, useCallback, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation, Outlet } from 'react-router-dom';
import { createUser, login, createEntry, upsertOptionalMetric, getUser, setToken, hasToken, clearToken } from './api/client';
import type { CreateUserRequest, CreateEntryRequest, LoginRequest } from './types/api';
import type { OptionalBodyFatSubmit } from './components/DailyLogForm';
import LandingPage from './pages/LandingPage';
import LogPage from './pages/LogPage';
import ProgressPage from './pages/ProgressPage';
import SettingsPage from './pages/SettingsPage';
import WorkoutsPage from './pages/WorkoutsPage';
import WorkoutSessionPage from './pages/WorkoutSessionPage';
import ProgramsPage from './pages/ProgramsPage';
import ProgramEditPage from './pages/ProgramEditPage';
import ExercisesCatalogPage from './pages/ExercisesCatalogPage';
import ExerciseHistoryPage from './pages/ExerciseHistoryPage';
import ForgotPasswordPage from './pages/ForgotPasswordPage';
import ResetPasswordPage from './pages/ResetPasswordPage';
import OnboardingPage from './pages/OnboardingPage';
import VerifyEmailPage from './pages/VerifyEmailPage';
import AuthenticatedLayout from './layouts/AuthenticatedLayout';
import PublicLayout from './layouts/PublicLayout';
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
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [tokenReady, setTokenReady] = useState(false);
  const [onboardingComplete, setOnboardingComplete] = useState<boolean | null>(null);
  const [emailVerifiedAt, setEmailVerifiedAt] = useState<string | null>(null);
  const [authMode, setAuthMode] = useState<AuthMode>('login');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [progressRefreshTrigger, setProgressRefreshTrigger] = useState(0);

  useEffect(() => {
    if (!hasToken() || !userId) {
      setTokenReady(true);
      setOnboardingComplete(true);
      setEmailVerifiedAt(null);
      setUserEmail(null);
      return;
    }
    getUser(userId)
      .then((profile) => {
        setTokenReady(true);
        setOnboardingComplete(profile.onboarding_complete);
        setEmailVerifiedAt(profile.email_verified_at);
        setUserEmail(profile.email);
      })
      .catch(() => {
        clearToken();
        clearStoredUserId();
        setUserId(null);
        setOnboardingComplete(null);
        setEmailVerifiedAt(null);
        setUserEmail(null);
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
      setUserEmail(res.user.email);
      setOnboardingComplete(res.user.onboarding_complete);
      setEmailVerifiedAt(res.user.email_verified_at ?? null);
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
      setUserEmail(res.user.email);
      setOnboardingComplete(res.user.onboarding_complete);
      setEmailVerifiedAt(res.user.email_verified_at ?? null);
      setSuccess('Account created.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Signup failed');
    }
  }, []);

  const handleLogout = useCallback(() => {
    clearToken();
    clearStoredUserId();
    setUserId(null);
    setUserEmail(null);
    setOnboardingComplete(null);
    setEmailVerifiedAt(null);
    setSuccess(null);
    setError(null);
  }, []);

  const handleEntrySubmit = useCallback(async (body: CreateEntryRequest, optionalBodyFat?: OptionalBodyFatSubmit) => {
    if (!userId) return;
    setError(null);
    setSuccess(null);
    try {
      await createEntry(userId, body);
      if (optionalBodyFat) {
        await upsertOptionalMetric(userId, optionalBodyFat.date, optionalBodyFat.body_fat_percent);
      }
      setSuccess('Entry saved.');
      setProgressRefreshTrigger((n) => n + 1);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save entry');
    }
  }, [userId]);

  if (!tokenReady) {
    return (
      <div className="app">
        <header className="app__header">
          <h1 className="app__title">Body Fat Tracker</h1>
          <p className="app__subtitle">Track weight and body fat toward your goal</p>
        </header>
        <main className="app__main">
          <p className="progress-text">Loading…</p>
        </main>
      </div>
    );
  }

  return (
    <BrowserRouter>
      <AppContent
        userId={userId}
        userEmail={userEmail}
        onboardingComplete={onboardingComplete}
        onOnboardingComplete={() => setOnboardingComplete(true)}
        emailVerifiedAt={emailVerifiedAt}
        onEmailVerified={() => setEmailVerifiedAt(new Date().toISOString())}
        authMode={authMode}
        setAuthMode={setAuthMode}
        error={error}
        setError={setError}
        success={success}
        setSuccess={setSuccess}
        progressRefreshTrigger={progressRefreshTrigger}
        setProgressRefreshTrigger={setProgressRefreshTrigger}
        handleLogin={handleLogin}
        handleSignup={handleSignup}
        handleLogout={handleLogout}
        handleEntrySubmit={handleEntrySubmit}
      />
    </BrowserRouter>
  );
}

function RequireAuth({
  userId,
  onboardingComplete,
  requireOnboarded,
}: {
  userId: string | null;
  onboardingComplete: boolean | null;
  requireOnboarded: boolean;
}) {
  if (!userId) return <Navigate to="/" replace />;
  if (requireOnboarded && onboardingComplete === false) return <Navigate to="/onboarding" replace />;
  if (!requireOnboarded && onboardingComplete !== false) return <Navigate to="/log" replace />;
  return <Outlet />;
}

type AppContentProps = {
  userId: string | null;
  userEmail: string | null;
  onboardingComplete: boolean | null;
  onOnboardingComplete: () => void;
  emailVerifiedAt: string | null;
  onEmailVerified: () => void;
  authMode: AuthMode;
  setAuthMode: (m: AuthMode) => void;
  error: string | null;
  setError: (e: string | null) => void;
  success: string | null;
  setSuccess: (s: string | null) => void;
  progressRefreshTrigger: number;
  setProgressRefreshTrigger: React.Dispatch<React.SetStateAction<number>>;
  handleLogin: (body: import('./types/api').LoginRequest) => Promise<void>;
  handleSignup: (body: CreateUserRequest) => Promise<void>;
  handleLogout: () => void;
  handleEntrySubmit: (body: CreateEntryRequest, optionalBodyFat?: import('./components/DailyLogForm').OptionalBodyFatSubmit) => Promise<void>;
};

function AppContent({
  userId,
  userEmail,
  onboardingComplete,
  onOnboardingComplete,
  emailVerifiedAt,
  onEmailVerified,
  authMode,
  setAuthMode,
  error,
  setError,
  success,
  setSuccess,
  progressRefreshTrigger,
  setProgressRefreshTrigger,
  handleLogin,
  handleSignup,
  handleLogout,
  handleEntrySubmit,
}: AppContentProps) {
  const location = useLocation();
  const prevPathRef = React.useRef(location.pathname);

  useEffect(() => {
    if (prevPathRef.current !== location.pathname) {
      prevPathRef.current = location.pathname;
      setError(null);
      setSuccess(null);
    }
  }, [location.pathname, setError, setSuccess]);

  return (
    <div className="app">
      {!userId && (
        <header className="app__header">
          <h1 className="app__title">Body Fat Tracker</h1>
          <p className="app__subtitle">Track weight and body fat toward your goal</p>
        </header>
      )}

      <main className="app__main">
        {error && <div className="app__error" role="alert">{error}</div>}
        {success && <div className="app__success" role="status">{success}</div>}
        {userId && !emailVerifiedAt && (
          <section className="app__card retention-banner" role="status">
            <p className="retention-banner__text">
              Verify your email. Check your inbox for the link we sent, or open the app in a new device and use the link there.
            </p>
          </section>
        )}

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
                  onAuthModeChange={(mode) => {
                    setAuthMode(mode);
                    setError(null);
                    setSuccess(null);
                  }}
                  onLogin={handleLogin}
                  onSignup={handleSignup}
                />
              )
            }
          />

          <Route element={<PublicLayout />}>
            <Route
              path="/forgot-password"
              element={
                userId ? <Navigate to={onboardingComplete === false ? '/onboarding' : '/log'} replace /> : <ForgotPasswordPage />
              }
            />
            <Route path="/reset-password" element={userId ? <Navigate to="/log" replace /> : <ResetPasswordPage />} />
          </Route>

          <Route path="/verify-email" element={<VerifyEmailPage onVerified={onEmailVerified} />} />

          <Route element={<RequireAuth userId={userId} onboardingComplete={onboardingComplete} requireOnboarded={false} />}>
            <Route element={<AuthenticatedLayout userId={userId!} onLogout={handleLogout} email={userEmail} />}>
              <Route path="/onboarding" element={<OnboardingPage userId={userId!} onComplete={onOnboardingComplete} onError={setError} />} />
            </Route>
          </Route>

          <Route element={<RequireAuth userId={userId} onboardingComplete={onboardingComplete} requireOnboarded />}>
            <Route element={<AuthenticatedLayout userId={userId!} onLogout={handleLogout} email={userEmail} />}>
              <Route
                path="/log"
                element={
                  <LogPage userId={userId!} refreshTrigger={progressRefreshTrigger} onSubmit={handleEntrySubmit} onError={setError} />
                }
              />
              <Route
                path="/progress"
                element={
                  <ProgressPage
                    userId={userId!}
                    refreshTrigger={progressRefreshTrigger}
                    onRefresh={() => setProgressRefreshTrigger((n) => n + 1)}
                  />
                }
              />
              <Route path="/workouts" element={<WorkoutsPage userId={userId!} onError={setError} />} />
              <Route path="/exercises" element={<ExercisesCatalogPage userId={userId!} onError={setError} onSuccess={setSuccess} />} />
              <Route path="/exercises/:exerciseId/history" element={<ExerciseHistoryPage userId={userId!} />} />
              <Route path="/workouts/programs" element={<ProgramsPage userId={userId!} onError={setError} />} />
              <Route path="/workouts/programs/:programId/edit" element={<ProgramEditPage userId={userId!} onError={setError} onSuccess={setSuccess} />} />
              <Route path="/workouts/:workoutId" element={<WorkoutSessionPage userId={userId!} onError={setError} onSuccess={setSuccess} />} />
              <Route path="/settings" element={<SettingsPage userId={userId!} onError={setError} onSuccess={setSuccess} />} />
            </Route>
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
        </main>
      </div>
  );
}
