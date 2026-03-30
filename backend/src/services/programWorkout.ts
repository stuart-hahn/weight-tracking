/**
 * Create an in-progress Workout from a ProgramDay template.
 */

import { prisma } from '../config/db.js';
import { getLastPerformanceForExercise } from './workoutDb.js';
import { computeTrainingWeekIndex, isDeloadWeek } from './trainingWeek.js';

export async function instantiateWorkoutFromProgramDay(userId: string, programDayId: string): Promise<string | null> {
  const day = await prisma.programDay.findFirst({
    where: { id: programDayId, program: { userId } },
    include: {
      program: true,
      exercises: {
        orderBy: { orderIndex: 'asc' },
        include: {
          exercise: true,
          setTemplates: { orderBy: { setIndex: 'asc' } },
        },
      },
    },
  });
  if (!day) return null;

  const user = await prisma.user.findUnique({ where: { id: userId } });
  const weekIndex = computeTrainingWeekIndex(user?.trainingBlockStartedAt ?? null);
  const deload = isDeloadWeek(weekIndex);

  const workout = await prisma.workout.create({
    data: {
      userId,
      name: `${day.program.name} · ${day.name}`,
      programId: day.programId,
      programDayId: day.id,
      trainingWeekIndex: weekIndex,
      isDeloadWeek: deload,
      startedAt: new Date(),
      completedAt: null,
    },
  });

  for (const pde of day.exercises) {
    const last = await getLastPerformanceForExercise(userId, pde.exerciseId);
    let templates = [...pde.setTemplates];
    if (deload && templates.length > 1) {
      const keep = Math.max(1, Math.ceil(templates.length * 0.6));
      templates = templates.slice(0, keep);
    }

    const line = await prisma.workoutExercise.create({
      data: {
        workoutId: workout.id,
        exerciseId: pde.exerciseId,
        orderIndex: pde.orderIndex,
      },
    });

    const topSnap = last?.sets.find((s) => s.set_role === 'top') ?? last?.sets[0];
    const topWeight = topSnap?.weight_kg && topSnap.weight_kg > 0 ? topSnap.weight_kg : null;

    if (templates.length === 0) {
      await prisma.workoutSet.create({
        data: {
          workoutExerciseId: line.id,
          setIndex: 0,
          setRole: 'working',
          weightKg: topWeight,
        },
      });
      continue;
    }

    let idx = 0;
    for (const t of templates) {
      let w: number | null = null;
      if (t.setRole === 'top' && topWeight != null) w = topWeight;
      else if (t.setRole === 'backoff' && topWeight != null) {
        const pct = t.percentOfTop != null ? t.percentOfTop : 0.91;
        w = Math.round(topWeight * pct * 10) / 10;
      } else if (last?.sets[idx]?.weight_kg) {
        w = last.sets[idx].weight_kg;
      }

      await prisma.workoutSet.create({
        data: {
          workoutExerciseId: line.id,
          setIndex: idx,
          setRole: t.setRole,
          targetRepsMin: t.targetRepsMin,
          targetRepsMax: t.targetRepsMax,
          targetRirMin: deload ? 2 : t.targetRirMin,
          targetRirMax: deload ? 4 : t.targetRirMax,
          weightKg: w,
        },
      });
      idx += 1;
    }
  }

  return workout.id;
}
