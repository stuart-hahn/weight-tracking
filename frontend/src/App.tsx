import React, { useState, useCallback, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation, Link } from 'react-router-dom';
import { createUser, login, createEntry, upsertOptionalMetric, getUser, setToken, hasToken, clearToken, resendVerificationEmail } from './api/client';
import type { CreateUserRequest, CreateEntryRequest, LoginRequest } from './types/api';
import type { OptionalBodyFatSubmit } from './components/DailyLogForm';
import LandingPage from './pages/LandingPage';
import HomePage from './pages/HomePage';
import HistoryPage from './pages/HistoryPage';
import SettingsPage from './pages/SettingsPage';
import ForgotPasswordPage from './pages/ForgotPasswordPage';
import ResetPasswordPage from './pages/ResetPasswordPage';
import OnboardingPage from './pages/OnboardingPage';
import VerifyEmailPage from './pages/VerifyEmailPage';
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
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [tokenReady, setTokenReady] = useState(false);
  const [onboardingComplete, setOnboardingComplete] = useState<boolean | null>(null);
  const [emailVerifiedAt, setEmailVerifiedAt] = useState<string | null>(null);
  const [authMode, setAuthMode] = useState<AuthMode>('login');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [progressRefreshTrigger, setProgressRefreshTrigger] = useState(0);
  const [resendVerificationStatus, setResendVerificationStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');

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
      setSuccess("You're all set. Head to Log to add your first weigh-in.");
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
      setProgressRefreshTrigger((n) => n + 1);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save entry');
    }
  }, [userId]);

  const handleResendVerification = useCallback(async () => {
    if (!userId) return;
    setResendVerificationStatus('sending');
    try {
      await resendVerificationEmail(userId);
      setResendVerificationStatus('sent');
    } catch {
      setResendVerificationStatus('error');
    }
  }, [userId]);

  if (!tokenReady) {
    return (
      <div className="app" aria-busy="true">
        <header className="app__header">
          <h1 className="app__title">Body Fat Tracker</h1>
          <p className="app__subtitle">Track your weight and body fat—and see your progress toward your goal.</p>
        </header>
        <main className="app__main">
          <div className="app__card" style={{ padding: '1.5rem' }}>
            <div className="skeleton skeleton-line" style={{ width: '100%', height: '0.875rem', marginBottom: '0.75rem' }} aria-hidden />
            <div className="skeleton skeleton-line skeleton-line--short" aria-hidden />
          </div>
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
        resendVerificationStatus={resendVerificationStatus}
        setResendVerificationStatus={setResendVerificationStatus}
        onResendVerification={handleResendVerification}
      />
    </BrowserRouter>
  );
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
  resendVerificationStatus: 'idle' | 'sending' | 'sent' | 'error';
  setResendVerificationStatus: React.Dispatch<React.SetStateAction<'idle' | 'sending' | 'sent' | 'error'>>;
  onResendVerification: () => Promise<void>;
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
  resendVerificationStatus,
  setResendVerificationStatus,
  onResendVerification,
}: AppContentProps) {
  const location = useLocation();
  const prevPathRef = React.useRef(location.pathname);

  useEffect(() => {
    if (prevPathRef.current !== location.pathname) {
      prevPathRef.current = location.pathname;
      setError(null);
      setSuccess(null);
      setResendVerificationStatus('idle');
    }
  }, [location.pathname, setError, setSuccess, setResendVerificationStatus]);

  return (
    <div className="app">
      <header className="app__header">
        <h1 className="app__title">
          {userId ? (
            <Link to="/home" className="app__title-link">Body Fat Tracker</Link>
          ) : (
            'Body Fat Tracker'
          )}
        </h1>
        <p className="app__subtitle">Track your weight and body fat—and see your progress toward your goal.</p>
      </header>

      <main className="app__main">
        {error && <div className="app__error" role="alert">{error}</div>}
        {success && <div className="app__success" role="status">{success}</div>}
        {userId && !emailVerifiedAt && (
          <section className="app__card retention-banner" role="status">
            <p className="retention-banner__text">
              One quick step: verify your email so we can keep your account secure.
            </p>
            <p className="retention-banner__text" style={{ marginTop: '0.25rem' }}>
              Link not working or expired? You can resend a new one below.
            </p>
            {resendVerificationStatus === 'sent' && (
              <p className="retention-banner__text" style={{ marginTop: '0.5rem' }}>
                Sent. Check your inbox (and spam folder).
              </p>
            )}
            {resendVerificationStatus === 'error' && (
              <p className="form-error" style={{ marginTop: '0.5rem' }}>That didn&apos;t go through. Try again in a moment.</p>
            )}
            <button
              type="button"
              className="btn btn--secondary"
              style={{ marginTop: '0.75rem' }}
              onClick={onResendVerification}
              disabled={resendVerificationStatus === 'sending'}
            >
              {resendVerificationStatus === 'sending' ? 'Sending…' : 'Resend email'}
            </button>
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
                    <Navigate to="/home" replace />
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
                  <Navigate to={onboardingComplete === false ? '/onboarding' : '/home'} replace />
                ) : (
                  <ForgotPasswordPage />
                )
              }
            />
            <Route
              path="/reset-password"
              element={userId ? <Navigate to="/home" replace /> : <ResetPasswordPage />}
            />
            <Route
              path="/verify-email"
              element={
                <VerifyEmailPage onVerified={onEmailVerified} />
              }
            />
            <Route
              path="/onboarding"
              element={
                userId && onboardingComplete === false ? (
                  <>
                    <Nav onLogout={handleLogout} email={userEmail} />
                    <OnboardingPage
                      userId={userId}
                      onComplete={onOnboardingComplete}
                      onError={setError}
                    />
                  </>
                ) : userId ? (
                  <Navigate to="/home" replace />
                ) : (
                  <Navigate to="/" replace />
                )
              }
            />
            <Route
              path="/home"
              element={
                userId && onboardingComplete !== false ? (
                  <>
                    <Nav onLogout={handleLogout} email={userEmail} />
                    <HomePage
                      userId={userId}
                      refreshTrigger={progressRefreshTrigger}
                      onSubmit={handleEntrySubmit}
                      onError={setError}
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
              path="/history"
              element={
                userId && onboardingComplete !== false ? (
                  <>
                    <Nav onLogout={handleLogout} email={userEmail} />
                    <HistoryPage
                      userId={userId}
                      refreshTrigger={progressRefreshTrigger}
                      onRefresh={() => setProgressRefreshTrigger((n) => n + 1)}
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
              path="/log"
              element={<Navigate to="/home" replace />}
            />
            <Route
              path="/progress"
              element={<Navigate to="/history" replace />}
            />
            <Route
              path="/settings"
              element={
                userId && onboardingComplete !== false ? (
                  <>
                    <Nav onLogout={handleLogout} email={userEmail} />
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
            <Route
              path="*"
              element={
                <section className="app__card" aria-label="Page not found">
                  <h2 className="app__card-title" style={{ marginTop: 0 }}>Page not found</h2>
                  <p className="progress-text">The page you’re looking for doesn’t exist or has been moved.</p>
                  <p style={{ marginTop: '1rem' }}>
                    <Link to={userId ? '/home' : '/'} className="btn btn--primary" style={{ display: 'inline-block', width: 'auto', padding: '0.75rem 1.5rem' }}>
                      Go home
                    </Link>
                  </p>
                </section>
              }
            />
          </Routes>
        </main>
      </div>
  );
}
