import { useState, useCallback, useRef, useEffect, FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { getProgress, createEntry, updateUser } from '../api/client';
import type { ProgressResponse } from '../types/api';
import { formatWeight, kgToLb, lbToKg } from '../utils/units';
import { getTodayInTimezone } from '../utils/date';
import PageLoading from '../components/PageLoading';
import { FieldInput } from '../components/Field';

interface OnboardingPageProps {
  userId: string;
  onComplete: () => void;
  onError: (message: string) => void;
}

export default function OnboardingPage({ userId, onComplete, onError }: OnboardingPageProps) {
  const navigate = useNavigate();
  const [progress, setProgress] = useState<ProgressResponse | null>(null);
  const [weight, setWeight] = useState('');
  const [calories, setCalories] = useState('');
  const weightInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let cancelled = false;
    getProgress(userId)
      .then((p) => {
        if (!cancelled) {
          setProgress(p);
          const w = p.units === 'imperial'
            ? String(Math.round(kgToLb(p.current_weight_kg) * 10) / 10)
            : String(p.current_weight_kg);
          setWeight(w);
        }
      })
      .catch(() => onError('Failed to load progress'));
    return () => { cancelled = true; };
  }, [userId, onError]);

  useEffect(() => {
    weightInputRef.current?.focus();
  }, [progress]);

  const handleLogFirstEntry = useCallback(
    async (e: FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      if (!progress) return;
      const units = progress.units;
      let weightKgNum = Number(weight);
      if (units === 'imperial') weightKgNum = lbToKg(weightKgNum);
      if (Number.isNaN(weightKgNum) || weightKgNum <= 0 || weightKgNum > 500) {
        onError('Please enter a valid weight');
        return;
      }
      const date = getTodayInTimezone(progress?.timezone ?? undefined);
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
        navigate('/home');
      } catch (err) {
        onError(err instanceof Error ? err.message : 'Failed to save entry');
      }
    },
    [userId, weight, calories, progress, onComplete, onError, navigate]
  );

  if (progress === null) {
    return <PageLoading />;
  }

  const units = progress.units;

  return (
    <div className="app__card">
      <h2 className="app__card-title" style={{ marginTop: 0 }}>
        Log your first weigh-in
      </h2>
      <p className="progress-text" style={{ marginBottom: '1rem' }}>
        Your goal: {formatWeight(progress.current_weight_kg, units)} → {formatWeight(progress.goal_weight_kg, units)} ({progress.target_body_fat_percent}% body fat). You can change this in Settings anytime.
      </p>
      <p style={{ marginBottom: '1rem' }}>
        Enter today&apos;s weight to start. You can add calories and other details later.
      </p>
      <p className="form-hint" style={{ marginBottom: '1rem' }}>
        You can switch to lb/in in Settings anytime.
      </p>
      <form onSubmit={handleLogFirstEntry} noValidate>
        <FieldInput
          ref={weightInputRef}
          id="onboarding-weight"
          label={`Weight (${units === 'imperial' ? 'lb' : 'kg'})`}
          type="number"
          step={units === 'imperial' ? 1 : 0.1}
          min={units === 'imperial' ? 50 : 20}
          max={units === 'imperial' ? 700 : 500}
          value={weight}
          onChange={(e) => setWeight(e.target.value)}
          required
        />
        <FieldInput
          id="onboarding-calories"
          label="Calories (optional)"
          type="number"
          min={0}
          max={10000}
          placeholder="Optional"
          value={calories}
          onChange={(e) => setCalories(e.target.value)}
        />
        <button type="submit" className="btn btn--primary form-actions__primary">
          Save and continue
        </button>
      </form>
      <button
        type="button"
        className="btn btn--secondary"
        style={{ marginTop: '1rem' }}
        onClick={async () => {
          try {
            await updateUser(userId, { onboarding_complete: true });
            onComplete();
            navigate('/home');
          } catch (err) {
            onError(err instanceof Error ? err.message : 'Failed to skip');
          }
        }}
      >
        Skip for now
      </button>
      <p className="form-hint" style={{ marginTop: '0.5rem' }}>
        You can always add your first weigh-in later from Home.
      </p>
    </div>
  );
}
