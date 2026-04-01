/**
 * Estimated 1RM from a single top set (Epley formula: weight × (1 + reps/30)).
 * Returns null if inputs are invalid for the formula (reps should be 1–20 for reasonable estimates).
 */
export function estimated1RmEpley(weightKg: number | null | undefined, reps: number | null | undefined): number | null {
  if (weightKg == null || weightKg <= 0) return null;
  if (reps == null || reps < 1 || reps > 30) return null;
  const est = weightKg * (1 + reps / 30);
  return Math.round(est * 10) / 10;
}
