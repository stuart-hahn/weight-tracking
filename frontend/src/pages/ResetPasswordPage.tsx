import { useState, useCallback, FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { resetPassword } from '../api/client';
import InlineFieldError from '../components/ui/InlineFieldError';

export default function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const tokenFromUrl = searchParams.get('token') ?? '';
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<{ password?: string; confirm?: string }>({});

  const handleSubmit = useCallback(
    async (e: FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      setFieldErrors({});
      if (password.length < 8) {
        setFieldErrors({ password: 'Password must be at least 8 characters.' });
        setError('Fix the highlighted fields.');
        return;
      }
      if (password !== confirmPassword) {
        setFieldErrors({ confirm: 'Passwords do not match.' });
        setError('Fix the highlighted fields.');
        return;
      }
      if (!tokenFromUrl) {
        setError('Invalid reset link. Request a new one.');
        return;
      }
      setError(null);
      try {
        await resetPassword(tokenFromUrl, password);
        setSuccess(true);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Reset failed');
      }
    },
    [password, confirmPassword, tokenFromUrl]
  );

  if (!tokenFromUrl && !success) {
    return (
      <div className="app__card">
        <h2 className="app__card-title" style={{ marginTop: 0 }}>
          Reset password
        </h2>
        <p className="app__error" role="alert">
          Invalid or missing reset link. Use the link from your email or <Link to="/forgot-password">request a new one</Link>.
        </p>
        <p style={{ marginTop: '1rem' }}>
          <Link to="/">Back to log in</Link>
        </p>
      </div>
    );
  }

  if (success) {
    return (
      <div className="app__card">
        <h2 className="app__card-title" style={{ marginTop: 0 }}>
          Password reset
        </h2>
        <p className="app__success" role="status">
          Your password has been reset. You can log in with your new password.
        </p>
        <p style={{ marginTop: '1.5rem' }}>
          <Link to="/">Log in</Link>
        </p>
      </div>
    );
  }

  return (
    <div className="app__card">
      <h2 className="app__card-title" style={{ marginTop: 0 }}>
        Set new password
      </h2>
      <form onSubmit={handleSubmit} noValidate>
        {error && <div className="app__error" role="alert">{error}</div>}
        <div className="form-group">
          <label className="form-label" htmlFor="reset-password">
            New password
          </label>
          <input
            id="reset-password"
            type="password"
            className="form-input"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={8}
            autoComplete="new-password"
            aria-invalid={fieldErrors.password ? true : undefined}
            aria-describedby={fieldErrors.password ? 'reset-password-error' : undefined}
          />
          <InlineFieldError id="reset-password-error" message={fieldErrors.password ?? null} />
        </div>
        <div className="form-group">
          <label className="form-label" htmlFor="reset-confirm">
            Confirm password
          </label>
          <input
            id="reset-confirm"
            type="password"
            className="form-input"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
            minLength={8}
            autoComplete="new-password"
            aria-invalid={fieldErrors.confirm ? true : undefined}
            aria-describedby={fieldErrors.confirm ? 'reset-confirm-error' : undefined}
          />
          <InlineFieldError id="reset-confirm-error" message={fieldErrors.confirm ?? null} />
        </div>
        <button type="submit" className="btn btn--primary" style={{ marginTop: '1rem' }}>
          Reset password
        </button>
      </form>
      <p style={{ marginTop: '1.5rem' }}>
        <Link to="/">Back to log in</Link>
      </p>
    </div>
  );
}
