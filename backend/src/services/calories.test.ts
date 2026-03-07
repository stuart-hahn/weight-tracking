import { describe, it, expect } from 'vitest';
import { computeTDEE, getRecommendedCalories } from './calories.js';

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
