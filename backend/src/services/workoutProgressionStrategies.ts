/**
 * Progression hints per program variant. Pure functions; tests cover rules.
 */

import type { ExerciseKind } from './workoutProgression.js';

export type ProgressionVariant =
  | 'general_double'
  | 'primary_smith_incline'
  | 'primary_rdl'
  | 'primary_lat_pulldown_upper_b'
  | 'primary_squat_or_hack'
  | 'isolation_calibration_candidate'
  | 'custom';

export interface LoggedSetSnapshot {
  weight_kg: number | null;
  reps: number | null;
  duration_sec: number | null;
  rir: number | null;
  set_role: string | null;
}

export interface ProgressionContext {
  variant: ProgressionVariant;
  exerciseKind: ExerciseKind;
  isDeloadWeek?: boolean;
  isCalibrationWeek?: boolean;
  /** Target rep range from template (general / working sets) */
  targetRepsMin?: number | null;
  targetRepsMax?: number | null;
}

function isPrimaryVariant(v: ProgressionVariant): boolean {
  return (
    v === 'primary_smith_incline' ||
    v === 'primary_rdl' ||
    v === 'primary_lat_pulldown_upper_b' ||
    v === 'primary_squat_or_hack'
  );
}

/**
 * Top set = first set with set_role top, else first set with weight.
 */
export function pickTopSet(sets: LoggedSetSnapshot[]): LoggedSetSnapshot | null {
  const top = sets.find((s) => s.set_role === 'top');
  if (top) return top;
  const withWeight = sets.find((s) => s.weight_kg != null && s.weight_kg > 0);
  return withWeight ?? sets[0] ?? null;
}

export function pickBackoffSets(sets: LoggedSetSnapshot[]): LoggedSetSnapshot[] {
  return sets.filter((s) => s.set_role === 'backoff');
}

export interface ProgressionHint {
  suggested_weight_kg: number | null;
  suggested_reps: number | null;
  hint: string;
}

export function computeProgressionHint(
  ctx: ProgressionContext,
  lastSets: LoggedSetSnapshot[]
): ProgressionHint {
  if (ctx.exerciseKind === 'time') {
    return {
      suggested_weight_kg: null,
      suggested_reps: null,
      hint: 'Match or beat last duration.',
    };
  }

  if (ctx.exerciseKind === 'bodyweight_reps') {
    return generalDoubleProgression(ctx, lastSets);
  }

  if (ctx.isCalibrationWeek && ctx.variant === 'isolation_calibration_candidate') {
    return {
      suggested_weight_kg: null,
      suggested_reps: ctx.targetRepsMax ?? null,
      hint: 'Calibration: take this set to true failure; log RIR 0.',
    };
  }

  if (ctx.isDeloadWeek) {
    return {
      suggested_weight_kg: pickTopSet(lastSets)?.weight_kg ?? null,
      suggested_reps: ctx.targetRepsMax ?? null,
      hint: 'Deload week: keep loads, reduce volume ~40%, aim ~3 RIR.',
    };
  }

  if (isPrimaryVariant(ctx.variant)) {
    return primaryCompoundHint(lastSets);
  }

  if (ctx.variant === 'isolation_calibration_candidate') {
    return generalDoubleProgression(ctx, lastSets);
  }

  return generalDoubleProgression(ctx, lastSets);
}

function primaryCompoundHint(lastSets: LoggedSetSnapshot[]): ProgressionHint {
  const top = pickTopSet(lastSets);
  if (!top || top.weight_kg == null || top.weight_kg <= 0) {
    return {
      suggested_weight_kg: null,
      suggested_reps: 8,
      hint: 'Top set 6–8 @ 0–1 RIR; backoffs ~9% less, 2×8–10 @ 2 RIR. Log RIR for best progression.',
    };
  }
  const topReps = top.reps ?? 0;
  const rir = top.rir;
  const hitRepTop = topReps >= 8;
  const hitRirBand = rir == null || (rir >= 0 && rir <= 1);
  if (hitRepTop && hitRirBand) {
    const next = Math.round((top.weight_kg + 2.5) * 100) / 100;
    return {
      suggested_weight_kg: Math.min(next, 500),
      suggested_reps: 8,
      hint: 'Top set hit rep and RIR targets — try +2.5 kg on the top set; backoffs follow ~9% under top.',
    };
  }
  if (hitRepTop && rir != null && rir > 1) {
    return {
      suggested_weight_kg: top.weight_kg,
      suggested_reps: 8,
      hint: 'Reps hit but RIR high — hold weight and push RIR down before loading.',
    };
  }
  return {
    suggested_weight_kg: top.weight_kg,
    suggested_reps: 8,
    hint: 'Build the top set to 8 reps @ 0–1 RIR before increasing load. Backoffs track top weight.',
  };
}

function generalDoubleProgression(ctx: ProgressionContext, lastSets: LoggedSetSnapshot[]): ProgressionHint {
  const tMax = ctx.targetRepsMax ?? 8;
  const tMin = ctx.targetRepsMin ?? 6;
  const working = lastSets.filter((s) => s.set_role == null || s.set_role === 'working' || s.set_role === 'backoff');
  const sets = working.length > 0 ? working : lastSets;
  const weights = sets.map((s) => s.weight_kg).filter((w): w is number => w != null && w > 0);
  const reps = sets.map((s) => s.reps).filter((r): r is number => r != null && r >= 0);
  if (weights.length === 0 || reps.length === 0) {
    return {
      suggested_weight_kg: null,
      suggested_reps: tMax,
      hint: `Log weight and reps. Target ${tMin}–${tMax} when all sets hit ${tMax} reps, add load.`,
    };
  }
  const sameWeight = weights.every((w) => Math.abs(w - weights[0]) < 0.01);
  const minReps = Math.min(...reps);
  const w = weights[0];
  if (sameWeight && minReps >= tMax) {
    const next = Math.round((w + 2.5) * 100) / 100;
    return {
      suggested_weight_kg: Math.min(next, 500),
      suggested_reps: tMax,
      hint: `All sets hit ${tMax}+ reps — try +2.5 kg.`,
    };
  }
  return {
    suggested_weight_kg: w,
    suggested_reps: tMax,
    hint: `Bring all sets to ${tMax} reps before adding weight.`,
  };
}

export function defaultVariantForExerciseName(name: string): ProgressionVariant {
  const n = name.toLowerCase();
  if (n.includes('smith') && n.includes('incline')) return 'primary_smith_incline';
  if (n.includes('romanian') || n.includes('rdl')) return 'primary_rdl';
  if (n.includes('pulldown') || n.includes('lat pull')) return 'primary_lat_pulldown_upper_b';
  if (n.includes('squat') || n.includes('hack squat')) return 'primary_squat_or_hack';
  if (
    n.includes('lateral') ||
    n.includes('leg extension') ||
    n.includes('machine curl') ||
    n.includes('curl')
  ) {
    return 'isolation_calibration_candidate';
  }
  return 'general_double';
}
