import { useState, useCallback, FormEvent } from 'react';
import type { CreateUserRequest, UnitsPreference } from '../types/api';
import { inToCm, lbToKg } from '../utils/units';
import InlineFieldError from './ui/InlineFieldError';

interface SignupFormProps {
  onSubmit: (body: CreateUserRequest) => void;
}

export default function SignupForm({ onSubmit }: SignupFormProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [age, setAge] = useState('');
  const [sex, setSex] = useState<'male' | 'female'>('male');
  const [units, setUnits] = useState<UnitsPreference>('metric');
  const [heightCm, setHeightCm] = useState('');
  const [weightKg, setWeightKg] = useState('');
  const [targetBf, setTargetBf] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const handleSubmit = useCallback(
    (e: FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      setFieldErrors({});
      const ageNum = Number(age);
      let heightNum = Number(heightCm);
      let weightNum = Number(weightKg);
      if (units === 'imperial') {
        heightNum = inToCm(heightNum);
        weightNum = lbToKg(weightNum);
      }
      const targetNum = Number(targetBf);
      const errors: Record<string, string> = {};
      if (!email.trim()) errors.email = 'Email is required.';
      if (password.length < 8) errors.password = 'Password must be at least 8 characters.';
      if (Number.isNaN(ageNum) || ageNum < 10 || ageNum > 120) errors.age = 'Enter an age between 10 and 120.';
      if (Number.isNaN(heightNum) || heightNum <= 0 || heightNum > 300) errors.height = 'Enter a valid height.';
      if (Number.isNaN(weightNum) || weightNum <= 0 || weightNum > 500) errors.weight = 'Enter a valid weight.';
      if (Number.isNaN(targetNum) || targetNum <= 0 || targetNum >= 100) errors.targetBf = 'Enter a target between 1 and 99.';
      if (Object.keys(errors).length > 0) {
        setFieldErrors(errors);
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
        units,
      });
    },
    [email, password, age, sex, units, heightCm, weightKg, targetBf, onSubmit]
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
            aria-invalid={fieldErrors.email ? true : undefined}
            aria-describedby={fieldErrors.email ? 'signup-email-error' : undefined}
          />
          <InlineFieldError id="signup-email-error" message={fieldErrors.email} />
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
            aria-invalid={fieldErrors.password ? true : undefined}
            aria-describedby={fieldErrors.password ? 'signup-password-error' : undefined}
          />
          <InlineFieldError id="signup-password-error" message={fieldErrors.password} />
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
            aria-invalid={fieldErrors.age ? true : undefined}
            aria-describedby={fieldErrors.age ? 'signup-age-error' : undefined}
          />
          <InlineFieldError id="signup-age-error" message={fieldErrors.age} />
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
        <div className="form-group">
          <label className="form-label" htmlFor="signup-height">
            Height ({units === 'imperial' ? 'in' : 'cm'})
          </label>
          <input
            id="signup-height"
            type="number"
            className="form-input"
            min={units === 'imperial' ? 20 : 1}
            max={units === 'imperial' ? 120 : 300}
            step={units === 'imperial' ? 1 : 0.1}
            placeholder={units === 'imperial' ? '70' : '175'}
            value={heightCm}
            onChange={(e) => setHeightCm(e.target.value)}
            required
            aria-invalid={fieldErrors.height ? true : undefined}
            aria-describedby={fieldErrors.height ? 'signup-height-error' : undefined}
          />
          <InlineFieldError id="signup-height-error" message={fieldErrors.height} />
        </div>
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
            step={units === 'imperial' ? 1 : 0.1}
            placeholder={units === 'imperial' ? '165' : '75'}
            value={weightKg}
            onChange={(e) => setWeightKg(e.target.value)}
            required
            aria-invalid={fieldErrors.weight ? true : undefined}
            aria-describedby={fieldErrors.weight ? 'signup-weight-error' : undefined}
          />
          <InlineFieldError id="signup-weight-error" message={fieldErrors.weight} />
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
            aria-invalid={fieldErrors.targetBf ? true : undefined}
            aria-describedby={fieldErrors.targetBf ? 'signup-target-bf-error' : undefined}
          />
          <InlineFieldError id="signup-target-bf-error" message={fieldErrors.targetBf} />
          <p className="form-hint">e.g. 15 for 15%</p>
        </div>
        <button type="submit" className="btn btn--primary" style={{ marginTop: '1rem' }}>
          Create account
        </button>
      </form>
    </>
  );
}
