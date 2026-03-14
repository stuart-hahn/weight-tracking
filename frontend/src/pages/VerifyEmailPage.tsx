import { useState, useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { verifyEmail } from '../api/client';

export default function VerifyEmailPage({ onVerified }: { onVerified?: () => void }) {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState<string>('');

  useEffect(() => {
    if (!token) {
      setStatus('error');
      setMessage("This link isn't complete. Open it again from your email, or request a new one from Settings.");
      return;
    }
    verifyEmail(token)
      .then((res) => {
        setStatus('success');
        setMessage(res.message);
        onVerified?.();
      })
      .catch((err) => {
        setStatus('error');
        const raw = err instanceof Error ? err.message : 'Verification failed.';
        // Align with backend: 400 for invalid/expired links
        const friendly =
          raw.includes('Invalid or expired verification link') ||
          raw.includes('Verification token is required')
            ? "This link has expired or already been used. Log in and use the banner above to request a new one."
            : raw;
        setMessage(friendly);
      });
  }, [token, onVerified]);

  return (
    <section className="app__card" aria-label="Verify email">
      <h2 className="app__card-title">Verify email</h2>
      {status === 'loading' && <p className="progress-text">Verifying your email…</p>}
      {status === 'success' && (
        <>
          <p className="progress-text" style={{ color: 'var(--success)' }}>{message}</p>
          <p className="form-hint" style={{ marginTop: '0.5rem' }}>
            You&apos;re verified. You can close this tab or head into the app.
          </p>
          <p style={{ marginTop: '1rem' }}>
            <Link to="/home" className="btn btn--primary" style={{ display: 'inline-block', width: 'auto', padding: '0.75rem 1.5rem' }}>
              Go to Log
            </Link>
          </p>
        </>
      )}
      {status === 'error' && (
        <>
          <p className="progress-text" style={{ color: 'var(--warn)' }}>{message}</p>
          <p className="form-hint" style={{ marginTop: '0.5rem' }}>
            Log in and use the banner at the top to resend a verification email.
          </p>
          <p style={{ marginTop: '1rem' }}>
            <Link to="/" className="btn btn--primary" style={{ display: 'inline-block', width: 'auto', padding: '0.75rem 1.5rem' }}>
              Back to log in
            </Link>
          </p>
        </>
      )}
    </section>
  );
}
