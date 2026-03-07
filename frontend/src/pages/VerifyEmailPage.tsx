import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { verifyEmail } from '../api/client';

export default function VerifyEmailPage({ onVerified }: { onVerified?: () => void }) {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
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
        setTimeout(() => navigate('/log', { replace: true }), 2000);
      })
      .catch((err) => {
        setStatus('error');
        setMessage(err instanceof Error ? err.message : 'Verification failed.');
      });
  }, [token, onVerified, navigate]);

  return (
    <section className="app__card" aria-label="Verify email">
      <h2 className="app__card-title">Verify email</h2>
      {status === 'loading' && <p className="progress-text">Verifying…</p>}
      {status === 'success' && <p className="progress-text" style={{ color: 'var(--success)' }}>{message}</p>}
      {status === 'error' && <p className="progress-text" style={{ color: 'var(--warn)' }}>{message}</p>}
    </section>
  );
}
