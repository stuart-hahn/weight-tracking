import { useState, useCallback, FormEvent } from 'react';
import type { CreateUserRequest } from '../types/api';

interface SignupFormProps {
  onSubmit: (body: CreateUserRequest) => void;
}

export default function SignupForm({ onSubmit }: SignupFormProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [age, setAge] = useState('');
  const [sex, setSex] = useState<'male' | 'female'>('male');
  const [heightCm, setHeightCm] = useState('');
  const [weightKg, setWeightKg] = useState('');
  const [targetBf, setTargetBf] = useState('');

  const handleSubmit = useCallback(
    (e: FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      const ageNum = Number(age);
      const heightNum = Number(heightCm);
      const weightNum = Number(weightKg);
      const targetNum = Number(targetBf);
      if (
        !email.trim() ||
        password.length < 8 ||
        Number.isNaN(ageNum) ||
        ageNum < 10 ||
        ageNum > 120 ||
        Number.isNaN(heightNum) ||
        heightNum <= 0 ||
        heightNum > 300 ||
        Number.isNaN(weightNum) ||
        weightNum <= 0 ||
        weightNum > 500 ||
        Number.isNaN(targetNum) ||
        targetNum <= 0 ||
        targetNum >= 100
      ) {
        return;
      }
      onSubmit({
        email: email.trim(),
        password,
        age: ageNum,
        sex,
        height_cm: heightNum,
        current_weight_kg: weightNum,
        target_body_fat_percent: targetNum,
      });
    },
    [email, password, age, sex, heightCm, weightKg, targetBf, onSubmit]
  );

  return (
    <>
      <h2 id="signup-heading" className="app__card-title" style={{ marginTop: 0 }}>
        Create account
      </h2>
      <form onSubmit={handleSubmit} noValidate>
        <div className="form-group">
          <label className="form-label" htmlFor="signup-email">
            Email
          </label>
          <input
            id="signup-email"
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
          <label className="form-label" htmlFor="signup-password">
            Password (min 8 characters)
          </label>
          <input
            id="signup-password"
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
          <label className="form-label" htmlFor="signup-age">
            Age
          </label>
          <input
            id="signup-age"
            type="number"
            className="form-input"
            min={10}
            max={120}
            placeholder="25"
            value={age}
            onChange={(e) => setAge(e.target.value)}
            required
          />
        </div>
        <div className="form-group">
          <label className="form-label" htmlFor="signup-sex">
            Sex
          </label>
          <select
            id="signup-sex"
            className="form-input"
            value={sex}
            onChange={(e) => setSex(e.target.value as 'male' | 'female')}
          >
            <option value="male">Male</option>
            <option value="female">Female</option>
          </select>
        </div>
        <div className="form-group">
          <label className="form-label" htmlFor="signup-height">
            Height (cm)
          </label>
          <input
            id="signup-height"
            type="number"
            className="form-input"
            min={1}
            max={300}
            step={0.1}
            placeholder="175"
            value={heightCm}
            onChange={(e) => setHeightCm(e.target.value)}
            required
          />
        </div>
        <div className="form-group">
          <label className="form-label" htmlFor="signup-weight">
            Current weight (kg)
          </label>
          <input
            id="signup-weight"
            type="number"
            className="form-input"
            min={1}
            max={500}
            step={0.1}
            placeholder="75"
            value={weightKg}
            onChange={(e) => setWeightKg(e.target.value)}
            required
          />
        </div>
        <div className="form-group">
          <label className="form-label" htmlFor="signup-target-bf">
            Target body fat (%)
          </label>
          <input
            id="signup-target-bf"
            type="number"
            className="form-input"
            min={1}
            max={99}
            step={0.5}
            placeholder="15"
            value={targetBf}
            onChange={(e) => setTargetBf(e.target.value)}
            required
          />
          <p className="form-hint">e.g. 15 for 15%</p>
        </div>
        <button type="submit" className="btn btn--primary" style={{ marginTop: '1rem' }}>
          Create account
        </button>
      </form>
    </>
  );
}
