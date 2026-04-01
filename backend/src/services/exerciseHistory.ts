/**
 * Per-exercise completed-session aggregates for history UI (top set, volume, RIR).
 */

import { prisma } from '../config/db.js';
import { pickTopSet, type LoggedSetSnapshot } from './workoutProgressionStrategies.js';

export { detectPlateau } from './exerciseHistoryPlateau.js';

export interface ExerciseSessionHistoryRow {
  workout_id: string;
  completed_at: string;
  top_set_weight_kg: number | null;
  top_set_reps: number | null;
  reps_per_set: string;
  avg_rir: number | null;
  volume_kg: number;
  substituted: boolean;
}

function setsToSnapshots(
  sets: {
    weightKg: number | null;
    reps: number | null;
    durationSec: number | null;
    rir: number | null;
    setRole: string | null;
  }[]
): LoggedSetSnapshot[] {
  return sets.map((s) => ({
    weight_kg: s.weightKg,
    reps: s.reps,
    duration_sec: s.durationSec,
    rir: s.rir,
    set_role: s.setRole,
  }));
}

function rowFromLine(
  workoutId: string,
  completedAt: Date,
  sets: {
    weightKg: number | null;
    reps: number | null;
    durationSec: number | null;
    rir: number | null;
    setRole: string | null;
  }[],
  substituted: boolean
): ExerciseSessionHistoryRow {
  const snaps = setsToSnapshots(sets);
  const top = pickTopSet(snaps);
  let volume = 0;
  const rirs: number[] = [];
  const repParts: string[] = [];
  for (const s of sets) {
    if (s.weightKg != null && s.weightKg > 0 && s.reps != null && s.reps > 0) {
      volume += s.weightKg * s.reps;
    }
    if (s.reps != null) repParts.push(String(s.reps));
    else repParts.push('—');
    if (s.rir != null) rirs.push(s.rir);
  }
  const avgRir = rirs.length > 0 ? rirs.reduce((a, b) => a + b, 0) / rirs.length : null;
  return {
    workout_id: workoutId,
    completed_at: completedAt.toISOString(),
    top_set_weight_kg: top?.weight_kg ?? null,
    top_set_reps: top?.reps ?? null,
    reps_per_set: repParts.join(', '),
    avg_rir: avgRir != null ? Math.round(avgRir * 100) / 100 : null,
    volume_kg: Math.round(volume * 10) / 10,
    substituted,
  };
}

/**
 * Last N completed sessions that include this exercise (this exercise_id on the line).
 */
export async function getExerciseSessionHistory(
  userId: string,
  exerciseId: string,
  limit: number,
  excludeSubstituted: boolean
): Promise<ExerciseSessionHistoryRow[]> {
  const takeWorkouts = Math.min(80, limit * 8);
  const workouts = await prisma.workout.findMany({
    where: { userId, completedAt: { not: null } },
    orderBy: { completedAt: 'desc' },
    take: takeWorkouts,
    include: {
      exercises: {
        where: {
          exerciseId,
          ...(excludeSubstituted ? { substitutedFromExerciseId: null } : {}),
        },
        include: { sets: { orderBy: { setIndex: 'asc' } } },
      },
    },
  });

  const rows: ExerciseSessionHistoryRow[] = [];
  for (const w of workouts) {
    const line = w.exercises[0];
    if (!line || !w.completedAt) continue;
    rows.push(
      rowFromLine(w.id, w.completedAt, line.sets, line.substitutedFromExerciseId != null)
    );
    if (rows.length >= limit) break;
  }
  return rows;
}
