import { useState, useCallback, FormEvent, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getProgress, createEntry, updateUser } from '../api/client';
import type { ProgressResponse } from '../types/api';
import { formatWeight, kgToLb, lbToKg } from '../utils/units';
import PageLoading from '../components/PageLoading';
import InlineFieldError from '../components/ui/InlineFieldError';
import CenteredCardPage from '../components/layout/CenteredCardPage';
import { useTimeZone } from '../context/TimeZonePreference';

interface OnboardingPageProps {
  userId: string;
  onComplete: () => void;
  onError: (message: string) => void;
}

export default function OnboardingPage({ userId, onComplete, onError }: OnboardingPageProps) {
  const { todayISO } = useTimeZone();
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [progress, setProgress] = useState<ProgressResponse | null>(null);
  const [weight, setWeight] = useState('');
  const [calories, setCalories] = useState('');
  const [fieldError, setFieldError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    getProgress(userId)
      .then((p) => {
        if (!cancelled) {
          setProgress(p);
          const w = p.units === 'imperial'
            ? String(Math.round(kgToLb(p.current_weight_kg)))
            : String(p.current_weight_kg);
          setWeight(w);
        }
      })
      .catch(() => onError('Failed to load progress'));
    return () => { cancelled = true; };
  }, [userId, onError]);

  const handleLogFirstEntry = useCallback(
    async (e: FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      if (!progress) return;
      setFieldError(null);
      const units = progress.units;
      let weightKgNum = Number(weight);
      if (units === 'imperial') weightKgNum = lbToKg(weightKgNum);
      if (Number.isNaN(weightKgNum) || weightKgNum <= 0 || weightKgNum > 500) {
        setFieldError('Please enter a valid weight.');
        return;
      }
      const date = todayISO;
      try {
        await createEntry(userId, {
          date,
          weight_kg: weightKgNum,
          ...(calories.trim() !== '' && !Number.isNaN(Number(calories)) && Number(calories) >= 0 && Number(calories) <= 10000
            ? { calories: Number(calories) }
            : {}),
        });
        await updateUser(userId, { onboarding_complete: true });
        onComplete();
        navigate('/log');
      } catch (err) {
        onError(err instanceof Error ? err.message : 'Failed to save entry');
      }
    },
    [userId, weight, calories, progress, onComplete, onError, navigate, todayISO]
  );

  if (progress === null) {
    return <PageLoading />;
  }

  const units = progress.units;

  if (step === 0) {
    return (
      <CenteredCardPage
        title="Onboarding"
        description={<>Quick setup so your Log and Progress are meaningful from day one.</>}
      >
        <h2 className="app__card-title" style={{ marginTop: 0 }}>
          Set your first goal
        </h2>
        <p className="progress-text progress-text--mb-md">
          Current weight: {formatWeight(progress.current_weight_kg, units)}
          <br />
          Goal weight: {formatWeight(progress.goal_weight_kg, units)} (target {progress.target_body_fat_percent}% body fat)
        </p>
        <p className="progress-text progress-text--mb-lg">
          You can adjust these in Settings anytime. When you’re ready, log your first entry.
        </p>
        <button type="button" className="btn btn--primary btn--block" onClick={() => setStep(1)}>
          Continue
        </button>
        <button
          type="button"
          className="btn btn--secondary btn--block"
          style={{ marginTop: '0.75rem' }}
          onClick={async () => {
            try {
              await updateUser(userId, { onboarding_complete: true });
              onComplete();
              navigate('/log');
            } catch (err) {
              onError(err instanceof Error ? err.message : 'Failed to skip');
            }
          }}
        >
          Skip for now
        </button>
      </CenteredCardPage>
    );
  }

  return (
    <CenteredCardPage title="Onboarding" description={<>Log your first entry to establish your baseline.</>}>
      <h2 className="app__card-title" style={{ marginTop: 0 }}>
        Log your first entry
      </h2>
      <p className="progress-text progress-text--mb-md">
        Enter today’s weight to start tracking. Calories are optional.
      </p>
      <form onSubmit={handleLogFirstEntry} noValidate>
        <div className="form-group">
          <label className="form-label" htmlFor="onboarding-weight">
            Weight ({units === 'imperial' ? 'lb' : 'kg'})
          </label>
          <input
            id="onboarding-weight"
            type="number"
            step={units === 'imperial' ? 1 : 0.1}
            min={units === 'imperial' ? 50 : 20}
            max={units === 'imperial' ? 700 : 500}
            className="form-input"
            value={weight}
            onChange={(e) => setWeight(e.target.value)}
            required
            aria-invalid={fieldError ? true : undefined}
            aria-describedby={fieldError ? 'onboarding-weight-error' : undefined}
          />
          <InlineFieldError id="onboarding-weight-error" message={fieldError} />
        </div>
        <div className="form-group">
          <label className="form-label" htmlFor="onboarding-calories">
            Calories (optional)
          </label>
          <input
            id="onboarding-calories"
            type="number"
            min={0}
            max={10000}
            className="form-input"
            placeholder="Optional"
            value={calories}
            onChange={(e) => setCalories(e.target.value)}
          />
        </div>
        <button type="submit" className="btn btn--primary btn--block form-submit-mt">
          Save and continue
        </button>
      </form>
    </CenteredCardPage>
  );
}
