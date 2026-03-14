import { describe, it, expect } from 'vitest';
import {
  computeGoalWeightKg,
  computeWeightTrendKgPerWeek,
  computeWeightTrendWithUncertainty,
  computeProgressPercent,
  estimateGoalReachDateWithRange,
  getPaceStatus,
  getRecoverySuggestion,
} from './progress.js';

describe('computeGoalWeightKg', () => {
  it('uses lean mass when provided', () => {
    const user = {
      currentWeightKg: 80,
      heightCm: 180,
      sex: 'male' as const,
      targetBodyFatPercent: 15,
      leanMassKg: 65,
    };
    expect(computeGoalWeightKg(user)).toBeCloseTo(65 / (1 - 0.15), 1);
  });

  it('estimates lean mass and computes goal when lean mass not set', () => {
    const user = {
      currentWeightKg: 80,
      heightCm: 180,
      sex: 'male' as const,
      targetBodyFatPercent: 15,
      leanMassKg: null,
    };
    const goal = computeGoalWeightKg(user);
    expect(goal).toBeGreaterThan(50);
    expect(goal).toBeLessThan(100);
  });

  it('returns current weight when target body fat is invalid', () => {
    const user = {
      currentWeightKg: 80,
      heightCm: 180,
      sex: 'male' as const,
      targetBodyFatPercent: 100,
      leanMassKg: null,
    };
    expect(computeGoalWeightKg(user)).toBe(80);
  });
});

describe('computeWeightTrendKgPerWeek', () => {
  it('returns null for fewer than 2 entries', () => {
    expect(computeWeightTrendKgPerWeek([])).toBeNull();
    expect(
      computeWeightTrendKgPerWeek([{ date: new Date('2024-01-01'), weightKg: 80 }])
    ).toBeNull();
  });

  it('computes trend from first to last entry', () => {
    const entries = [
      { date: new Date('2024-01-01'), weightKg: 80 },
      { date: new Date('2024-01-08'), weightKg: 79 },
    ];
    expect(computeWeightTrendKgPerWeek(entries)).toBeCloseTo(-1, 2);
  });

  it('sorts by date when entries out of order', () => {
    const entries = [
      { date: new Date('2024-01-08'), weightKg: 79 },
      { date: new Date('2024-01-01'), weightKg: 80 },
    ];
    expect(computeWeightTrendKgPerWeek(entries)).toBeCloseTo(-1, 2);
  });
});

describe('computeProgressPercent', () => {
  it('returns 0 when at start (weight loss)', () => {
    expect(computeProgressPercent(80, 80, 70)).toBeCloseTo(0, 5);
  });

  it('returns 100 when at goal (weight loss)', () => {
    expect(computeProgressPercent(80, 70, 70)).toBe(100);
  });

  it('returns 50 when halfway (weight loss)', () => {
    expect(computeProgressPercent(80, 75, 70)).toBe(50);
  });

  it('returns null when goal equals start', () => {
    expect(computeProgressPercent(80, 80, 80)).toBeNull();
  });
});

describe('computeWeightTrendWithUncertainty', () => {
  it('returns null for fewer than 2 entries', () => {
    expect(computeWeightTrendWithUncertainty([])).toBeNull();
    expect(
      computeWeightTrendWithUncertainty([{ date: new Date('2024-01-01'), weightKg: 80 }])
    ).toBeNull();
  });

  it('returns trend and std error for 2+ entries', () => {
    const entries = [
      { date: new Date('2024-01-01'), weightKg: 80 },
      { date: new Date('2024-01-08'), weightKg: 79 },
    ];
    const result = computeWeightTrendWithUncertainty(entries);
    expect(result).not.toBeNull();
    expect(result!.trendKgPerWeek).toBeCloseTo(-1, 1);
    expect(result!.trendEntriesCount).toBe(2);
    expect(typeof result!.trendStdError).toBe('number');
  });
});

describe('estimateGoalReachDateWithRange', () => {
  it('returns point date and early/late range', () => {
    const result = estimateGoalReachDateWithRange(80, 70, -0.5, 0.1);
    expect(result.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(result.dateEarly).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(result.dateLate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(result.basis).toBe('Based on your recent weigh-ins.');
  });
});

describe('getPaceStatus', () => {
  it('returns on_track when trend near target', () => {
    expect(getPaceStatus(-0.5, 80, 70)).toBe('on_track');
    expect(getPaceStatus(-0.45, 80, 70)).toBe('on_track');
  });
  it('returns ahead when losing faster than target', () => {
    expect(getPaceStatus(-0.7, 80, 70)).toBe('ahead');
  });
  it('returns behind when trend away from goal', () => {
    expect(getPaceStatus(0.2, 80, 70)).toBe('behind');
  });
  it('returns null when trend is null', () => {
    expect(getPaceStatus(null, 80, 70)).toBeNull();
  });
});

describe('getRecoverySuggestion', () => {
  it('returns null when on track', () => {
    expect(getRecoverySuggestion(80, 70, -0.5, 'on_track')).toBeNull();
  });
  it('returns suggestion when behind', () => {
    const r = getRecoverySuggestion(80, 70, -0.2, 'behind');
    expect(r).not.toBeNull();
    expect(r!.recovery_weekly_rate_kg).toBe(-0.5);
    expect(r!.message.length).toBeGreaterThan(0);
  });
});
