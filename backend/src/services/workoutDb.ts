/**
 * Workout persistence: clone template and last-performance lookup.
 */

import { prisma } from '../config/db.js';
import type { SetSnapshot } from './workoutProgression.js';

export interface LastPerformanceResult {
  workout_id: string;
  completed_at: string;
  sets: SetSnapshot[];
}

export async function cloneWorkoutForUser(userId: string, templateId: string): Promise<string | null> {
  const template = await prisma.workout.findFirst({
    where: { id: templateId, userId },
    include: {
      exercises: {
        orderBy: { orderIndex: 'asc' },
        include: { sets: true },
      },
    },
  });
  if (!template) return null;

  const newId = await prisma.$transaction(async (tx) => {
    const w = await tx.workout.create({
      data: {
        userId,
        name: template.name ? `${template.name} (copy)` : null,
        notes: template.notes,
        startedAt: new Date(),
        completedAt: null,
      },
    });
    for (const line of template.exercises) {
      const setsSorted = [...line.sets].sort((a, b) => a.setIndex - b.setIndex);
      const nl = await tx.workoutExercise.create({
        data: {
          workoutId: w.id,
          exerciseId: line.exerciseId,
          orderIndex: line.orderIndex,
          notes: line.notes,
          defaultRestSeconds: line.defaultRestSeconds,
        },
      });
      for (const s of setsSorted) {
        await tx.workoutSet.create({
          data: {
            workoutExerciseId: nl.id,
            setIndex: s.setIndex,
            weightKg: s.weightKg,
            reps: s.reps,
            durationSec: s.durationSec,
            notes: s.notes,
            restSecondsAfter: s.restSecondsAfter,
          },
        });
      }
    }
    return w.id;
  });
  return newId;
}

export async function getLastPerformanceForExercise(
  userId: string,
  exerciseId: string
): Promise<LastPerformanceResult | null> {
  const workouts = await prisma.workout.findMany({
    where: { userId, completedAt: { not: null } },
    orderBy: { completedAt: 'desc' },
    take: 80,
    include: {
      exercises: {
        where: { exerciseId },
        include: { sets: { orderBy: { setIndex: 'asc' } } },
      },
    },
  });
  for (const w of workouts) {
    const line = w.exercises[0];
    if (!line || !w.completedAt) continue;
    return {
      workout_id: w.id,
      completed_at: w.completedAt.toISOString(),
      sets: line.sets.map((s) => ({
        weight_kg: s.weightKg,
        reps: s.reps,
        duration_sec: s.durationSec,
      })),
    };
  }
  return null;
}
