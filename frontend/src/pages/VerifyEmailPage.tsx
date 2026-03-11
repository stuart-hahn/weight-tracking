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
      setMessage('This verification link is missing a token. Try opening the link directly from your email again, or request a new one from Settings.');
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
            ? 'Invalid or expired verification link. Request a new one from Settings.'
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
            You can close this tab or continue into the app.
          </p>
          <p style={{ marginTop: '1rem' }}>
            <Link to="/log" className="btn btn--primary" style={{ display: 'inline-block', width: 'auto', padding: '0.75rem 1.5rem' }}>
              Go to Log
            </Link>
          </p>
        </>
      )}
      {status === 'error' && (
        <>
          <p className="progress-text" style={{ color: 'var(--warn)' }}>{message}</p>
          <p style={{ marginTop: '1rem' }}>
            <Link to="/">Back to log in</Link>
          </p>
        </>
      )}
    </section>
  );
}
