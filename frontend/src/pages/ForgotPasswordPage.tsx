import { useState, useCallback, FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { requestPasswordReset } from '../api/client';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = useCallback(
    async (e: FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      if (!email.trim()) return;
      setError(null);
      try {
        await requestPasswordReset(email.trim());
        setSubmitted(true);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Request failed');
      }
    },
    [email]
  );

  return (
    <div className="app__card">
      <h2 className="app__card-title" style={{ marginTop: 0 }}>
        Forgot password
      </h2>
      {submitted ? (
        <>
          <p className="app__success" role="status">
            If we have an account for that email, we&apos;ve sent a reset link. Check your inbox and spam folder.
          </p>
          <p className="progress-text" style={{ marginTop: '0.75rem' }}>
            Didn&apos;t get it? Check spam, or try again with the same email.
          </p>
          <button
            type="button"
            className="btn btn--secondary"
            style={{ marginTop: '1rem' }}
            onClick={() => setSubmitted(false)}
          >
            Try again
          </button>
        </>
      ) : (
        <>
          <p style={{ marginBottom: '1rem' }}>
            Enter your email and we&apos;ll send you a link to choose a new password.
          </p>
          <form onSubmit={handleSubmit} noValidate>
            {error && <div className="app__error" role="alert">{error}</div>}
            <div className="form-group">
              <label className="form-label" htmlFor="forgot-email">
                Email
              </label>
              <input
                id="forgot-email"
                type="email"
                className="form-input"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
              />
            </div>
            <button type="submit" className="btn btn--primary" style={{ marginTop: '1rem' }}>
              Send reset link
            </button>
          </form>
        </>
      )}
      <p style={{ marginTop: '1.5rem' }}>
        <Link to="/">Back to log in</Link>
      </p>
    </div>
  );
}
