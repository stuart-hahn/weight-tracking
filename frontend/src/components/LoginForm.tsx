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
      <h2 id="login-heading" className="app__card-title app__card-title--first">
        Log in
      </h2>
      <form onSubmit={handleSubmit} noValidate>
        <fieldset disabled={submitting} aria-busy={submitting} style={{ border: 'none', margin: 0, padding: 0 }}>
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
        <p className="mt-2 text-sm">
          <Link to="/forgot-password">Forgot password?</Link>
        </p>
        <button type="submit" className={`btn btn--primary mt-4 ${submitting ? 'btn--loading' : ''}`} disabled={submitting} aria-busy={submitting}>
          {submitting ? 'Logging in…' : 'Log in'}
        </button>
        </fieldset>
      </form>
    </>
  );
}
