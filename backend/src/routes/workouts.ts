import { Router, type Response, type NextFunction } from 'express';
import { prisma } from '../config/db.js';
import { requireAuth, type AuthRequest } from '../middleware/auth.js';
import {
  validateCreateWorkout,
  validateUpdateWorkout,
  validateCreateWorkoutExercise,
  validateUpdateWorkoutExercise,
  validateCreateWorkoutSet,
  validateUpdateWorkoutSet,
} from '../middleware/validate.js';
import type {
  WorkoutCreateInput,
  WorkoutUpdateInput,
  WorkoutExerciseCreateInput,
  WorkoutExerciseUpdateInput,
  WorkoutSetCreateInput,
  WorkoutSetUpdateInput,
} from '../types/index.js';
import { cloneWorkoutForUser } from '../services/workoutDb.js';

const router = Router({ mergeParams: true });

type WorkoutWithNested = NonNullable<Awaited<ReturnType<typeof loadWorkoutFull>>>;

function assertUser(req: AuthRequest, res: Response): string | null {
  const userId = req.params.id;
  if (req.userId !== userId) {
    res.status(403).json({ error: 'Forbidden' });
    return null;
  }
  return userId;
}

async function loadWorkoutFull(userId: string, workoutId: string) {
  return prisma.workout.findFirst({
    where: { id: workoutId, userId },
    include: {
      exercises: {
        orderBy: { orderIndex: 'asc' },
        include: {
          exercise: true,
          sets: { orderBy: { setIndex: 'asc' } },
        },
      },
    },
  });
}

function serializeSet(s: { id: string; setIndex: number; weightKg: number | null; reps: number | null; durationSec: number | null; notes: string | null; restSecondsAfter: number | null }) {
  return {
    id: s.id,
    set_index: s.setIndex,
    weight_kg: s.weightKg,
    reps: s.reps,
    duration_sec: s.durationSec,
    notes: s.notes,
    rest_seconds_after: s.restSecondsAfter,
  };
}

function serializeExerciseRef(e: { id: string; userId: string | null; name: string; kind: string; createdAt: Date }) {
  return {
    id: e.id,
    user_id: e.userId,
    name: e.name,
    kind: e.kind,
    is_custom: e.userId != null,
    created_at: e.createdAt.toISOString(),
  };
}

function serializeLine(line: WorkoutWithNested['exercises'][number]) {
  return {
    id: line.id,
    exercise_id: line.exerciseId,
    order_index: line.orderIndex,
    notes: line.notes,
    default_rest_seconds: line.defaultRestSeconds,
    exercise: serializeExerciseRef(line.exercise),
    sets: line.sets.map(serializeSet),
  };
}

function serializeWorkoutFull(w: WorkoutWithNested) {
  return {
    id: w.id,
    user_id: w.userId,
    name: w.name,
    notes: w.notes,
    started_at: w.startedAt.toISOString(),
    completed_at: w.completedAt?.toISOString() ?? null,
    created_at: w.createdAt.toISOString(),
    exercises: w.exercises.map(serializeLine),
  };
}

router.get('/', requireAuth, async (req: AuthRequest, res: Response): Promise<void> => {
  const userId = assertUser(req, res);
  if (!userId) return;
  const status = typeof req.query.status === 'string' ? req.query.status : '';
  const limit = Math.min(Number(req.query.limit) || 40, 100);
  const where: { userId: string; completedAt?: null | { not: null } } = { userId };
  if (status === 'in_progress') where.completedAt = null;
  if (status === 'completed') where.completedAt = { not: null };

  const rows = await prisma.workout.findMany({
    where,
    orderBy: { startedAt: 'desc' },
    take: limit,
    include: {
      _count: { select: { exercises: true } },
    },
  });
  res.json(
    rows.map((w) => ({
      id: w.id,
      user_id: w.userId,
      name: w.name,
      notes: w.notes,
      started_at: w.startedAt.toISOString(),
      completed_at: w.completedAt?.toISOString() ?? null,
      created_at: w.createdAt.toISOString(),
      exercise_count: w._count.exercises,
    }))
  );
});

router.post('/', requireAuth, validateCreateWorkout, async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  const userId = assertUser(req, res);
  if (!userId) return;
  const body = req.body as WorkoutCreateInput;
  try {
    if (body.clone_from_workout_id) {
      const newId = await cloneWorkoutForUser(userId, body.clone_from_workout_id);
      if (!newId) {
        res.status(404).json({ error: 'Workout template not found' });
        return;
      }
      const w = await loadWorkoutFull(userId, newId);
      if (!w) {
        res.status(500).json({ error: 'Failed to load cloned workout' });
        return;
      }
      res.status(201).json(serializeWorkoutFull(w));
      return;
    }
    const w = await prisma.workout.create({
      data: {
        userId,
        name: body.name != null && body.name !== undefined ? String(body.name).trim() || null : null,
        notes: body.notes != null && body.notes !== undefined ? body.notes : null,
        startedAt: new Date(),
        completedAt: null,
      },
      include: {
        exercises: {
          orderBy: { orderIndex: 'asc' },
          include: { exercise: true, sets: { orderBy: { setIndex: 'asc' } } },
        },
      },
    });
    res.status(201).json(serializeWorkoutFull(w as WorkoutWithNested));
  } catch (err) {
    next(err as Error);
  }
});

router.get('/:workoutId', requireAuth, async (req: AuthRequest, res: Response): Promise<void> => {
  const userId = assertUser(req, res);
  if (!userId) return;
  const w = await loadWorkoutFull(userId, req.params.workoutId);
  if (!w) {
    res.status(404).json({ error: 'Workout not found' });
    return;
  }
  res.json(serializeWorkoutFull(w));
});

router.patch('/:workoutId', requireAuth, validateUpdateWorkout, async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  const userId = assertUser(req, res);
  if (!userId) return;
  const { workoutId } = req.params;
  const body = req.body as WorkoutUpdateInput;
  const existing = await prisma.workout.findFirst({ where: { id: workoutId, userId } });
  if (!existing) {
    res.status(404).json({ error: 'Workout not found' });
    return;
  }
  try {
    const data: {
      name?: string | null;
      notes?: string | null;
      completedAt?: Date | null;
    } = {};
    if (body.name !== undefined) data.name = body.name === null ? null : String(body.name).trim() || null;
    if (body.notes !== undefined) data.notes = body.notes === null ? null : body.notes;
    if (body.completed_at !== undefined) {
      data.completedAt = body.completed_at === null ? null : new Date(body.completed_at);
    }
    await prisma.workout.update({
      where: { id: workoutId },
      data,
    });
    const w = await loadWorkoutFull(userId, workoutId);
    if (!w) {
      res.status(404).json({ error: 'Workout not found' });
      return;
    }
    res.json(serializeWorkoutFull(w));
  } catch (err) {
    next(err as Error);
  }
});

router.delete('/:workoutId', requireAuth, async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  const userId = assertUser(req, res);
  if (!userId) return;
  const { workoutId } = req.params;
  try {
    const existing = await prisma.workout.findFirst({ where: { id: workoutId, userId } });
    if (!existing) {
      res.status(404).json({ error: 'Workout not found' });
      return;
    }
    await prisma.workout.delete({ where: { id: workoutId } });
    res.status(204).send();
  } catch (err) {
    next(err as Error);
  }
});

router.post('/:workoutId/exercises', requireAuth, validateCreateWorkoutExercise, async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  const userId = assertUser(req, res);
  if (!userId) return;
  const { workoutId } = req.params;
  const body = req.body as WorkoutExerciseCreateInput;
  try {
    const workout = await prisma.workout.findFirst({ where: { id: workoutId, userId } });
    if (!workout) {
      res.status(404).json({ error: 'Workout not found' });
      return;
    }
    if (workout.completedAt != null) {
      res.status(409).json({ error: 'Cannot add exercises to a completed workout' });
      return;
    }
    const exercise = await prisma.exercise.findFirst({
      where: { id: body.exercise_id, OR: [{ userId: null }, { userId }] },
    });
    if (!exercise) {
      res.status(404).json({ error: 'Exercise not found' });
      return;
    }
    const maxOrder = await prisma.workoutExercise.aggregate({
      where: { workoutId },
      _max: { orderIndex: true },
    });
    const nextOrder = (maxOrder._max.orderIndex ?? -1) + 1;

    const line = await prisma.$transaction(async (tx) => {
      const wl = await tx.workoutExercise.create({
        data: {
          workoutId,
          exerciseId: body.exercise_id,
          orderIndex: nextOrder,
          notes: body.notes ?? null,
          defaultRestSeconds: body.default_rest_seconds ?? null,
        },
      });
      const setsInput = body.sets && body.sets.length > 0 ? body.sets : [{}];
      let idx = 0;
      for (const s of setsInput) {
        const si = s as WorkoutSetCreateInput;
        await tx.workoutSet.create({
          data: {
            workoutExerciseId: wl.id,
            setIndex: idx,
            weightKg: si.weight_kg ?? null,
            reps: si.reps ?? null,
            durationSec: si.duration_sec ?? null,
            notes: si.notes ?? null,
            restSecondsAfter: si.rest_seconds_after ?? null,
          },
        });
        idx += 1;
      }
      return wl.id;
    });

    const w = await loadWorkoutFull(userId, workoutId);
    if (!w) {
      res.status(404).json({ error: 'Workout not found' });
      return;
    }
    const added = w.exercises.find((e) => e.id === line);
    res.status(201).json(added ? serializeLine(added) : serializeWorkoutFull(w));
  } catch (err) {
    next(err as Error);
  }
});

router.patch('/:workoutId/exercises/:lineId', requireAuth, validateUpdateWorkoutExercise, async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  const userId = assertUser(req, res);
  if (!userId) return;
  const { workoutId, lineId } = req.params;
  const body = req.body as WorkoutExerciseUpdateInput;
  try {
    const line = await prisma.workoutExercise.findFirst({
      where: { id: lineId, workoutId, workout: { userId } },
      include: { workout: true },
    });
    if (!line) {
      res.status(404).json({ error: 'Workout line not found' });
      return;
    }
    if (body.order_index !== undefined) {
      await prisma.$transaction(async (tx) => {
        const lines = await tx.workoutExercise.findMany({
          where: { workoutId },
          orderBy: { orderIndex: 'asc' },
        });
        const pos = lines.findIndex((l) => l.id === lineId);
        if (pos === -1) return;
        const [moved] = lines.splice(pos, 1);
        const target = Math.max(0, Math.min(body.order_index!, lines.length));
        lines.splice(target, 0, moved);
        for (let i = 0; i < lines.length; i++) {
          await tx.workoutExercise.update({
            where: { id: lines[i].id },
            data: { orderIndex: i },
          });
        }
      });
    }
    const data: { notes?: string | null; defaultRestSeconds?: number | null } = {};
    if (body.notes !== undefined) data.notes = body.notes === null ? null : body.notes;
    if (body.default_rest_seconds !== undefined) {
      data.defaultRestSeconds = body.default_rest_seconds === null ? null : body.default_rest_seconds;
    }
    if (Object.keys(data).length > 0) {
      await prisma.workoutExercise.update({
        where: { id: lineId },
        data,
      });
    }
    const w = await loadWorkoutFull(userId, workoutId);
    if (!w) {
      res.status(404).json({ error: 'Workout not found' });
      return;
    }
    const updatedLine = w.exercises.find((e) => e.id === lineId);
    if (!updatedLine) {
      res.status(404).json({ error: 'Workout line not found' });
      return;
    }
    res.json(serializeLine(updatedLine));
  } catch (err) {
    next(err as Error);
  }
});

router.delete('/:workoutId/exercises/:lineId', requireAuth, async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  const userId = assertUser(req, res);
  if (!userId) return;
  const { workoutId, lineId } = req.params;
  try {
    const line = await prisma.workoutExercise.findFirst({
      where: { id: lineId, workoutId, workout: { userId } },
    });
    if (!line) {
      res.status(404).json({ error: 'Workout line not found' });
      return;
    }
    await prisma.workoutExercise.delete({ where: { id: lineId } });
    const rest = await prisma.workoutExercise.findMany({
      where: { workoutId },
      orderBy: { orderIndex: 'asc' },
    });
    await prisma.$transaction(
      rest.map((l, i) =>
        prisma.workoutExercise.update({
          where: { id: l.id },
          data: { orderIndex: i },
        })
      )
    );
    res.status(204).send();
  } catch (err) {
    next(err as Error);
  }
});

router.post('/:workoutId/exercises/:lineId/sets', requireAuth, validateCreateWorkoutSet, async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  const userId = assertUser(req, res);
  if (!userId) return;
  const { workoutId, lineId } = req.params;
  const body = req.body as WorkoutSetCreateInput;
  try {
    const line = await prisma.workoutExercise.findFirst({
      where: { id: lineId, workoutId, workout: { userId } },
    });
    if (!line) {
      res.status(404).json({ error: 'Workout line not found' });
      return;
    }
    const maxIdx = await prisma.workoutSet.aggregate({
      where: { workoutExerciseId: lineId },
      _max: { setIndex: true },
    });
    const nextIdx = (maxIdx._max.setIndex ?? -1) + 1;
    const set = await prisma.workoutSet.create({
      data: {
        workoutExerciseId: lineId,
        setIndex: nextIdx,
        weightKg: body.weight_kg ?? null,
        reps: body.reps ?? null,
        durationSec: body.duration_sec ?? null,
        notes: body.notes ?? null,
        restSecondsAfter: body.rest_seconds_after ?? null,
      },
    });
    res.status(201).json(serializeSet(set));
  } catch (err) {
    next(err as Error);
  }
});

router.patch('/:workoutId/exercises/:lineId/sets/:setId', requireAuth, validateUpdateWorkoutSet, async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  const userId = assertUser(req, res);
  if (!userId) return;
  const { workoutId, lineId, setId } = req.params;
  const body = req.body as WorkoutSetUpdateInput;
  try {
    const set = await prisma.workoutSet.findFirst({
      where: {
        id: setId,
        workoutExerciseId: lineId,
        workoutExercise: { workoutId, workout: { userId } },
      },
    });
    if (!set) {
      res.status(404).json({ error: 'Set not found' });
      return;
    }
    const data: {
      weightKg?: number | null;
      reps?: number | null;
      durationSec?: number | null;
      notes?: string | null;
      restSecondsAfter?: number | null;
    } = {};
    if (body.weight_kg !== undefined) data.weightKg = body.weight_kg;
    if (body.reps !== undefined) data.reps = body.reps;
    if (body.duration_sec !== undefined) data.durationSec = body.duration_sec;
    if (body.notes !== undefined) data.notes = body.notes === null ? null : body.notes;
    if (body.rest_seconds_after !== undefined) data.restSecondsAfter = body.rest_seconds_after === null ? null : body.rest_seconds_after;

    await prisma.workoutSet.update({
      where: { id: setId },
      data,
    });

    const updated = await prisma.workoutSet.findUnique({ where: { id: setId } });
    if (!updated) {
      res.status(404).json({ error: 'Set not found' });
      return;
    }
    res.json(serializeSet(updated));
  } catch (err) {
    next(err as Error);
  }
});

router.delete('/:workoutId/exercises/:lineId/sets/:setId', requireAuth, async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  const userId = assertUser(req, res);
  if (!userId) return;
  const { workoutId, lineId, setId } = req.params;
  try {
    const set = await prisma.workoutSet.findFirst({
      where: {
        id: setId,
        workoutExerciseId: lineId,
        workoutExercise: { workoutId, workout: { userId } },
      },
    });
    if (!set) {
      res.status(404).json({ error: 'Set not found' });
      return;
    }
    await prisma.workoutSet.delete({ where: { id: setId } });
    const rest = await prisma.workoutSet.findMany({
      where: { workoutExerciseId: lineId },
      orderBy: { setIndex: 'asc' },
    });
    await prisma.$transaction(
      rest.map((s, i) =>
        prisma.workoutSet.update({
          where: { id: s.id },
          data: { setIndex: i },
        })
      )
    );
    res.status(204).send();
  } catch (err) {
    next(err as Error);
  }
});

export default router;
