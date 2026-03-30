import { describe, it, expect } from 'vitest';
import { suggestNextWeightKg } from './workoutProgression.js';

describe('suggestNextWeightKg', () => {
  it('suggests +2.5 kg when all sets same weight and reps meet target', () => {
    const r = suggestNextWeightKg(
      'weight_reps',
      [
        { weight_kg: 100, reps: 8, duration_sec: null },
        { weight_kg: 100, reps: 8, duration_sec: null },
      ],
      8
    );
    expect(r.suggested_weight_kg).toBe(102.5);
    expect(r.suggested_reps).toBe(8);
  });

  it('holds weight when reps below target', () => {
    const r = suggestNextWeightKg(
      'weight_reps',
      [
        { weight_kg: 100, reps: 6, duration_sec: null },
        { weight_kg: 100, reps: 7, duration_sec: null },
      ],
      8
    );
    expect(r.suggested_weight_kg).toBe(100);
  });

  it('returns non-weight hint for time exercises', () => {
    const r = suggestNextWeightKg('time', [{ weight_kg: null, reps: null, duration_sec: 60 }]);
    expect(r.suggested_weight_kg).toBeNull();
  });
});
