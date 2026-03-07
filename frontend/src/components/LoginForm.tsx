import { useState, useCallback, FormEvent } from 'react';
import { Link } from 'react-router-dom';
import type { LoginRequest } from '../types/api';

interface LoginFormProps {
  onSubmit: (body: LoginRequest) => void;
}

export default function LoginForm({ onSubmit }: LoginFormProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleSubmit = useCallback(
    (e: FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      if (!email.trim() || !password) return;
      onSubmit({ email: email.trim(), password });
    },
    [email, password, onSubmit]
  );

  return (
    <>
      <h2 id="login-heading" className="app__card-title" style={{ marginTop: 0 }}>
        Log in
      </h2>
      <form onSubmit={handleSubmit} noValidate>
        <div className="form-group">
          <label className="form-label" htmlFor="login-email">
            Email
          </label>
          <input
            id="login-email"
            type="email"
            className="form-input"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
          />
        </div>
        <div className="form-group">
          <label className="form-label" htmlFor="login-password">
            Password
          </label>
          <input
            id="login-password"
            type="password"
            className="form-input"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete="current-password"
          />
          <p style={{ marginTop: '0.5rem', fontSize: '0.9rem' }}>
            <Link to="/forgot-password">Forgot password?</Link>
          </p>
        </div>
        <button type="submit" className="btn btn--primary" style={{ marginTop: '1rem' }}>
          Log in
        </button>
      </form>
    </>
  );
}
