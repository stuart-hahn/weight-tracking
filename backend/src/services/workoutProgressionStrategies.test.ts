import { describe, it, expect } from 'vitest';
import { computeProgressionHint, pickTopSet, defaultVariantForExerciseName } from './workoutProgressionStrategies.js';

describe('pickTopSet', () => {
  it('prefers set_role top', () => {
    const s = pickTopSet([
      { weight_kg: 50, reps: 8, duration_sec: null, rir: 2, set_role: 'backoff' },
      { weight_kg: 60, reps: 6, duration_sec: null, rir: 1, set_role: 'top' },
    ]);
    expect(s?.weight_kg).toBe(60);
  });
});

describe('primaryCompoundHint via computeProgressionHint', () => {
  it('suggests load when top hits 8 reps and RIR in band', () => {
    const r = computeProgressionHint(
      { variant: 'primary_rdl', exerciseKind: 'weight_reps' },
      [{ weight_kg: 100, reps: 8, duration_sec: null, rir: 1, set_role: 'top' }]
    );
    expect(r.suggested_weight_kg).toBe(102.5);
  });

  it('holds when RIR too high', () => {
    const r = computeProgressionHint(
      { variant: 'primary_rdl', exerciseKind: 'weight_reps' },
      [{ weight_kg: 100, reps: 8, duration_sec: null, rir: 3, set_role: 'top' }]
    );
    expect(r.suggested_weight_kg).toBe(100);
  });
});

describe('defaultVariantForExerciseName', () => {
  it('maps romanian deadlift', () => {
    expect(defaultVariantForExerciseName('Romanian deadlift')).toBe('primary_rdl');
  });
  it('defaults general', () => {
    expect(defaultVariantForExerciseName('Face pull')).toBe('general_double');
  });
});
