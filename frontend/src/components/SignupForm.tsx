import { useState, useCallback, FormEvent } from 'react';
import type { CreateUserRequest, UnitsPreference } from '../types/api';
import { cmToIn, inToCm, lbToKg } from '../utils/units';

interface SignupFormProps {
  onSubmit: (body: CreateUserRequest) => void;
}

export default function SignupForm({ onSubmit }: SignupFormProps) {
  const [step, setStep] = useState(1);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [age, setAge] = useState('');
  const [sex, setSex] = useState<'male' | 'female'>('male');
  const [units, setUnits] = useState<UnitsPreference>('metric');
  const [heightCm, setHeightCm] = useState('');
  const [weightKg, setWeightKg] = useState('');
  const [targetBf, setTargetBf] = useState('');
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleStep1 = useCallback(
    (e: FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      setSubmitError(null);
      if (!email.trim()) {
        setSubmitError('Email is required');
        return;
      }
      if (password.length < 8) {
        setSubmitError('Password must be at least 8 characters');
        return;
      }
      setStep(2);
    },
    [email, password]
  );

  const handleSubmit = useCallback(
    async (e: FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      setSubmitError(null);
      const ageNum = Number(age);
      const heightNum = Number(heightCm);
      let weightNum = Number(weightKg);
      if (units === 'imperial') {
        weightNum = lbToKg(weightNum);
      }
      const targetNum = Number(targetBf);
      const errors: string[] = [];
      if (!email.trim()) errors.push('Email is required');
      if (password.length < 8) errors.push('Password must be at least 8 characters');
      if (Number.isNaN(ageNum) || ageNum < 10 || ageNum > 120) errors.push('Age must be between 10 and 120');
      if (Number.isNaN(heightNum) || heightNum <= 0 || heightNum > 300) errors.push('Height is required and must be valid');
      if (Number.isNaN(weightNum) || weightNum <= 0 || weightNum > 500) errors.push('Weight is required and must be valid');
      if (Number.isNaN(targetNum) || targetNum <= 0 || targetNum >= 100) errors.push('Target body fat % must be between 1 and 99');
      if (errors.length > 0) {
        setSubmitError(errors.join('. '));
        return;
      }
      setSubmitting(true);
      try {
        await onSubmit({
          email: email.trim(),
          password,
          age: ageNum,
          sex,
          height_cm: heightNum,
          current_weight_kg: weightNum,
          target_body_fat_percent: targetNum,
          units,
        });
      } finally {
        setSubmitting(false);
      }
    },
    [email, password, age, sex, units, heightCm, weightKg, targetBf, onSubmit]
  );

  if (step === 1) {
    return (
      <>
        <h2 id="signup-heading" className="app__card-title" style={{ marginTop: 0 }}>
          Create account
        </h2>
        <form onSubmit={handleStep1} noValidate>
          {submitError && (
            <div className="app__error" role="alert" style={{ marginBottom: '1rem' }}>
              {submitError}
            </div>
          )}
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
          <button type="submit" className="btn btn--primary" style={{ marginTop: '1rem' }}>
            Continue
          </button>
        </form>
      </>
    );
  }

  return (
    <>
      <h2 id="signup-heading" className="app__card-title" style={{ marginTop: 0 }}>
        Add a few details for your goal
      </h2>
      <p className="progress-text" style={{ marginBottom: '1rem' }}>
        We&apos;ll use these to show your progress toward your target body fat %.
      </p>
      <form onSubmit={handleSubmit} noValidate>
        {submitError && (
          <div className="app__error" role="alert" style={{ marginBottom: '1rem' }}>
            {submitError}
          </div>
        )}
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
          <label className="form-label" htmlFor="signup-units">
            Units
          </label>
          <select
            id="signup-units"
            className="form-input"
            value={units}
            onChange={(e) => setUnits(e.target.value as UnitsPreference)}
          >
            <option value="metric">Metric (kg, cm)</option>
            <option value="imperial">Imperial (lb, in)</option>
          </select>
        </div>
        {units === 'metric' ? (
          <div className="form-group">
            <label className="form-label" htmlFor="signup-height-cm">
              Height (cm)
            </label>
            <input
              id="signup-height-cm"
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
        ) : (
          <>
            <div className="form-group">
              <label className="form-label" htmlFor="signup-height-ft">Height (feet)</label>
              <input
                id="signup-height-ft"
                type="number"
                className="form-input"
                min={2}
                max={8}
                step={1}
                placeholder="5"
                value={heightCm === '' ? '' : Math.floor(cmToIn(Number(heightCm)) / 12)}
                onChange={(e) => {
                  const ft = Number(e.target.value);
                  const inch = heightCm === '' ? 0 : Math.round(cmToIn(Number(heightCm)) % 12);
                  if (Number.isNaN(ft)) setHeightCm('');
                  else setHeightCm(String(inToCm(ft * 12 + inch)));
                }}
                required
              />
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="signup-height-in">Height (inches)</label>
              <input
                id="signup-height-in"
                type="number"
                className="form-input"
                min={0}
                max={11}
                step={1}
                placeholder="10"
                value={heightCm === '' ? '' : Math.round(cmToIn(Number(heightCm)) % 12)}
                onChange={(e) => {
                  const inch = Number(e.target.value);
                  const ft = heightCm === '' ? 0 : Math.floor(cmToIn(Number(heightCm)) / 12);
                  if (Number.isNaN(inch) || inch < 0 || inch > 11) return;
                  setHeightCm(String(inToCm(ft * 12 + inch)));
                }}
                required
              />
            </div>
          </>
        )}
        <div className="form-group">
          <label className="form-label" htmlFor="signup-weight">
            Current weight ({units === 'imperial' ? 'lb' : 'kg'})
          </label>
          <input
            id="signup-weight"
            type="number"
            className="form-input"
            min={units === 'imperial' ? 44 : 1}
            max={units === 'imperial' ? 1100 : 500}
            step={0.1}
            placeholder={units === 'imperial' ? '176.4' : '75'}
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
        <button type="button" className="btn btn--secondary" style={{ marginRight: '0.5rem', marginTop: '1rem' }} onClick={() => setStep(1)}>
          Back
        </button>
        <button type="submit" className="btn btn--primary" style={{ marginTop: '1rem' }} disabled={submitting}>
          {submitting ? 'Creating account…' : 'Create account'}
        </button>
      </form>
    </>
  );
}
