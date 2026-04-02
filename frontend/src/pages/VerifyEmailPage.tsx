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
      setMessage('Missing verification link.');
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
        setMessage(err instanceof Error ? err.message : 'Verification failed.');
      });
  }, [token, onVerified]);

  return (
    <section className="app__card" aria-label="Verify email">
      <h2 className="app__card-title app__card-title--flush">Verify email</h2>
      {status === 'loading' && <p className="progress-text">Verifying…</p>}
      {status === 'success' && (
        <>
          <p className="progress-text progress-text--success">{message}</p>
          <p className="progress-text progress-text--mt-lg">
            <Link to="/log" className="btn btn--primary btn--block">
              Go to Log
            </Link>
          </p>
        </>
      )}
      {status === 'error' && (
        <>
          <p className="progress-text progress-text--warn">{message}</p>
          <p className="progress-text progress-text--mt-lg">
            <Link to="/">Back to log in</Link>
          </p>
        </>
      )}
    </section>
  );
}
