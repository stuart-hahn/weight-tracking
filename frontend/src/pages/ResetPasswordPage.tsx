import { useState, useCallback, FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { resetPassword } from '../api/client';

export default function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const tokenFromUrl = searchParams.get('token') ?? '';
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = useCallback(
    async (e: FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      if (password.length < 8) {
        setError('Password must be at least 8 characters');
        return;
      }
      if (password !== confirmPassword) {
        setError('Passwords do not match');
        return;
      }
      if (!tokenFromUrl) {
        setError("That link isn't valid or has expired. Use the link from your email or request a new one.");
        return;
      }
      setError(null);
      setSubmitting(true);
      try {
        await resetPassword(tokenFromUrl, password);
        setSuccess(true);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Reset failed');
      } finally {
        setSubmitting(false);
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
          That link isn&apos;t valid or has expired. Use the link from your email or <Link to="/forgot-password">request a new one</Link>.
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
          Your password&apos;s been updated. You can log in now with your new password.
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
          />
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
          />
        </div>
        <button type="submit" className="btn btn--primary" style={{ marginTop: '1rem' }} disabled={submitting}>
          {submitting ? 'Resetting…' : 'Reset password'}
        </button>
      </form>
      <p style={{ marginTop: '1.5rem' }}>
        <Link to="/">Back to log in</Link>
      </p>
    </div>
  );
}
