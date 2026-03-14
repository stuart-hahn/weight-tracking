import { useState, useCallback, FormEvent } from 'react';
import { Link } from 'react-router-dom';
import type { LoginRequest } from '../types/api';
import { FieldInput } from './Field';

interface LoginFormProps {
  onSubmit: (body: LoginRequest) => void;
}

export default function LoginForm({ onSubmit }: LoginFormProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = useCallback(
    async (e: FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      if (!email.trim() || !password) return;
      setSubmitting(true);
      try {
        await onSubmit({ email: email.trim(), password });
      } finally {
        setSubmitting(false);
      }
    },
    [email, password, onSubmit]
  );

  return (
    <>
      <h2 id="login-heading" className="app__card-title" style={{ marginTop: 0 }}>
        Log in
      </h2>
      <form onSubmit={handleSubmit} noValidate>
        <FieldInput
          id="login-email"
          label="Email"
          type="email"
          placeholder="you@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          autoComplete="email"
        />
        <FieldInput
          id="login-password"
          label="Password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          autoComplete="current-password"
        />
        <p style={{ marginTop: '0.5rem', fontSize: '0.9rem' }}>
          <Link to="/forgot-password">Forgot password?</Link>
        </p>
        <button type="submit" className="btn btn--primary" style={{ marginTop: '1rem' }} disabled={submitting}>
          {submitting ? 'Logging in…' : 'Log in'}
        </button>
      </form>
    </>
  );
}
