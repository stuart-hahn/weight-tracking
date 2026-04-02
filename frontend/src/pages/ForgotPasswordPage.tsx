import { useState, useCallback, FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { requestPasswordReset } from '../api/client';
import InlineFieldError from '../components/ui/InlineFieldError';
import CenteredCardPage from '../components/layout/CenteredCardPage';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [emailRequired, setEmailRequired] = useState(false);

  const handleSubmit = useCallback(
    async (e: FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      const t = email.trim();
      setEmailRequired(false);
      if (!t) {
        setEmailRequired(true);
        return;
      }
      setError(null);
      try {
        await requestPasswordReset(t);
        setSubmitted(true);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Request failed');
      }
    },
    [email]
  );

  return (
    <CenteredCardPage
      title="Forgot password"
      description={<>Enter your email and we&apos;ll send you a link to reset your password.</>}
      footer={
        <p className="progress-text">
          <Link to="/">Back to log in</Link>
        </p>
      }
    >
      {submitted ? (
        <>
          <p className="app__success" role="status">
            If an account exists with that email, you will receive a reset link. Check your inbox and spam folder.
          </p>
          <p className="progress-text progress-text--mt-md">
            Didn&apos;t get it? Check spam or try again with your email.
          </p>
          <button type="button" className="btn btn--secondary btn--block form-submit-mt" onClick={() => setSubmitted(false)}>
            Try again
          </button>
        </>
      ) : (
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
              aria-invalid={emailRequired ? true : undefined}
              aria-describedby={emailRequired ? 'forgot-email-error' : undefined}
            />
            <InlineFieldError id="forgot-email-error" message={emailRequired ? 'Email is required.' : null} />
          </div>
          <button type="submit" className="btn btn--primary btn--block form-submit-mt" disabled={!email.trim()}>
            Send reset link
          </button>
        </form>
      )}
    </CenteredCardPage>
  );
}
