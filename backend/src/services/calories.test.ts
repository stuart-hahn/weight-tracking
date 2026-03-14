import { describe, it, expect } from 'vitest';
import { computeTDEE, computeEmpiricalTDEE, getRecommendedCalories } from './calories.js';

describe('computeTDEE', () => {
  it('returns positive number for valid inputs', () => {
    const tdee = computeTDEE(80, 180, 30, 'male', 'moderate');
    expect(tdee).toBeGreaterThan(1500);
    expect(tdee).toBeLessThan(4000);
  });

  it('returns higher TDEE for very_active than sedentary', () => {
    const sedentary = computeTDEE(70, 170, 25, 'female', 'sedentary');
    const active = computeTDEE(70, 170, 25, 'female', 'very_active');
    expect(active).toBeGreaterThan(sedentary);
  });
});

describe('getRecommendedCalories', () => {
  it('returns deficit range when goal below current (weight loss)', () => {
    const result = getRecommendedCalories(2500, 90, 80);
    expect(result.recommended_calories_max).toBeLessThan(2500);
    expect(result.recommended_calories_min).toBeLessThanOrEqual(result.recommended_calories_max);
  });

  it('returns surplus range when goal above current (weight gain)', () => {
    const result = getRecommendedCalories(2500, 60, 70);
    expect(result.recommended_calories_min).toBeGreaterThan(2500);
  });

  it('returns maintain range when goal near current', () => {
    const result = getRecommendedCalories(2500, 75, 75);
    expect(result.recommended_calories_min).toBeCloseTo(2400, -2);
    expect(result.recommended_calories_max).toBeCloseTo(2600, -2);
  });
});

describe('computeEmpiricalTDEE', () => {
  it('returns TDEE for weight loss: avg intake + deficit from trend', () => {
    // 0.5 kg/week → deficit = 0.5 * 7700 / 7 ≈ 550 kcal/day → TDEE = 2000 + 550 = 2550
    const tdee = computeEmpiricalTDEE(2000, -0.5, true);
    expect(tdee).toBe(2550);
  });

  it('returns TDEE for weight gain: avg intake - surplus from trend', () => {
    // 0.5 kg/week → surplus ≈ 550 kcal/day → TDEE = 2500 - 550 = 1950
    const tdee = computeEmpiricalTDEE(2500, 0.5, false);
    expect(tdee).toBe(1950);
  });

  it('returns null when trend is effectively zero', () => {
    expect(computeEmpiricalTDEE(2000, 0, true)).toBeNull();
    expect(computeEmpiricalTDEE(2000, 0.005, true)).toBeNull();
  });

  it('returns null for invalid avg calories', () => {
    expect(computeEmpiricalTDEE(0, -0.5, true)).toBeNull();
    expect(computeEmpiricalTDEE(15000, -0.5, true)).toBeNull();
  });

  it('clamps result to 1000-4000', () => {
    const low = computeEmpiricalTDEE(500, 1, false); // surplus 1100 → 500 - 1100 < 1000
    expect(low).toBe(1000);
    const high = computeEmpiricalTDEE(5000, 0.5, false); // 5000 - 550 = 4450 → 4000
    expect(high).toBe(4000);
  });
});
