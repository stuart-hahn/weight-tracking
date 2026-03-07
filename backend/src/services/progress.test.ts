import { describe, it, expect } from 'vitest';
import {
  computeGoalWeightKg,
  computeWeightTrendKgPerWeek,
  computeProgressPercent,
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
