/**
 * Build exercise insights using last performance + progression strategies.
 */

import { prisma } from '../config/db.js';
import { getLastPerformanceForExercise } from './workoutDb.js';
import type { ExerciseKind } from './workoutProgression.js';
import {
  computeProgressionHint,
  defaultVariantForExerciseName,
  type ProgressionVariant,
  type LoggedSetSnapshot,
} from './workoutProgressionStrategies.js';
import { computeTrainingWeekIndex, isCalibrationWeek, isDeloadWeek } from './trainingWeek.js';

export interface InsightPayload {
  exercise_id: string;
  last_performance: {
    workout_id: string;
    completed_at: string;
    sets: LoggedSetSnapshot[];
  } | null;
  suggestion: {
    suggested_weight_kg: number | null;
    suggested_reps: number | null;
    hint: string;
  };
  progression_variant: ProgressionVariant;
}

export async function buildExerciseInsight(
  userId: string,
  exerciseId: string,
  exerciseKind: ExerciseKind,
  exerciseName: string,
  variantOverride?: ProgressionVariant | null
): Promise<InsightPayload> {
  const [user, lastRow] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: { trainingBlockStartedAt: true },
    }),
    getLastPerformanceForExercise(userId, exerciseId),
  ]);

  const weekIndex = computeTrainingWeekIndex(user?.trainingBlockStartedAt ?? null);
  const variantResolved: ProgressionVariant = variantOverride ?? defaultVariantForExerciseName(exerciseName);

  const last = lastRow
    ? {
        workout_id: lastRow.workout_id,
        completed_at: lastRow.completed_at,
        sets: lastRow.sets,
      }
    : null;

  const suggestion = computeProgressionHint(
    {
      variant: variantResolved,
      exerciseKind,
      isDeloadWeek: isDeloadWeek(weekIndex),
      isCalibrationWeek: isCalibrationWeek(weekIndex),
    },
    last?.sets ?? []
  );

  return {
    exercise_id: exerciseId,
    last_performance: last,
    suggestion,
    progression_variant: variantResolved,
  };
}
