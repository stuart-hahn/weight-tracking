import { useRef, useEffect } from 'react';
import LoginForm from '../components/LoginForm';
import SignupForm from '../components/SignupForm';
import type { CreateUserRequest, LoginRequest } from '../types/api';

type AuthMode = 'login' | 'signup';

interface LandingPageProps {
  authMode: AuthMode;
  onAuthModeChange: (mode: AuthMode) => void;
  onLogin: (body: LoginRequest) => Promise<void>;
  onSignup: (body: CreateUserRequest) => Promise<void>;
}

export default function LandingPage({
  authMode,
  onAuthModeChange,
  onLogin,
  onSignup,
}: LandingPageProps) {
  const loginTabRef = useRef<HTMLButtonElement>(null);
  const signupTabRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const active = authMode === 'login' ? loginTabRef.current : signupTabRef.current;
    active?.focus({ preventScroll: true });
  }, [authMode]);

  const handleTabKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
      e.preventDefault();
      onAuthModeChange(e.key === 'ArrowRight' ? (authMode === 'login' ? 'signup' : 'login') : (authMode === 'signup' ? 'login' : 'signup'));
    }
  };

  return (
    <div className="app__card">
      <div
        className="auth-tabs"
        role="tablist"
        aria-label="Log in or create account"
        onKeyDown={handleTabKeyDown}
      >
        <button
          ref={loginTabRef}
          type="button"
          role="tab"
          aria-selected={authMode === 'login'}
          aria-controls="auth-panel"
          id="tab-login"
          className={`auth-tabs__tab ${authMode === 'login' ? 'auth-tabs__tab--active' : ''}`}
          onClick={() => onAuthModeChange('login')}
        >
          Log in
        </button>
        <button
          ref={signupTabRef}
          type="button"
          role="tab"
          aria-selected={authMode === 'signup'}
          aria-controls="auth-panel"
          id="tab-signup"
          className={`auth-tabs__tab ${authMode === 'signup' ? 'auth-tabs__tab--active' : ''}`}
          onClick={() => onAuthModeChange('signup')}
        >
          Create account
        </button>
      </div>
      <div id="auth-panel" role="tabpanel" aria-labelledby={authMode === 'login' ? 'tab-login' : 'tab-signup'}>
        {authMode === 'login' ? (
          <LoginForm onSubmit={onLogin} />
        ) : (
          <SignupForm onSubmit={onSignup} />
        )}
      </div>
    </div>
  );
}
