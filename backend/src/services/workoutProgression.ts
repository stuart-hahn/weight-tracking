/**
 * Progressive-overload suggestion helpers (pure; no DB).
 */

export type ExerciseKind = 'weight_reps' | 'bodyweight_reps' | 'time';

export interface SetSnapshot {
  weight_kg: number | null;
  reps: number | null;
  duration_sec: number | null;
}

/**
 * Suggest next working weight (kg) for weight_reps: +2.5 kg if all sets same weight and reps >= targetReps; else hold.
 * targetReps defaults to first set's reps or 8.
 */
export function suggestNextWeightKg(
  kind: ExerciseKind,
  lastSets: SetSnapshot[],
  targetReps?: number
): { suggested_weight_kg: number | null; suggested_reps: number | null; hint: string } {
  if (kind !== 'weight_reps' || lastSets.length === 0) {
    return {
      suggested_weight_kg: null,
      suggested_reps: null,
      hint: kind === 'time' ? 'Match or beat last duration.' : 'Match or beat last reps.',
    };
  }
  const weights = lastSets.map((s) => s.weight_kg).filter((w): w is number => w != null && w > 0);
  const reps = lastSets.map((s) => s.reps).filter((r): r is number => r != null && r >= 0);
  if (weights.length === 0 || reps.length === 0) {
    return { suggested_weight_kg: null, suggested_reps: null, hint: 'Log weight and reps to get suggestions.' };
  }
  const sameWeight = weights.every((w) => Math.abs(w - weights[0]) < 0.01);
  const minReps = Math.min(...reps);
  const goal = targetReps ?? reps[0] ?? 8;
  const w = weights[0];
  if (sameWeight && minReps >= goal) {
    const next = Math.round((w + 2.5) * 100) / 100;
    return {
      suggested_weight_kg: Math.min(next, 500),
      suggested_reps: goal,
      hint: 'You hit your reps at this weight — try +2.5 kg.',
    };
  }
  return {
    suggested_weight_kg: w,
    suggested_reps: goal,
    hint: 'Build reps at this weight before increasing load.',
  };
}
