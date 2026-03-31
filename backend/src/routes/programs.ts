import { Router, type Response, type NextFunction } from 'express';
import { prisma } from '../config/db.js';
import { requireAuth, type AuthRequest } from '../middleware/auth.js';
import { ensureDefaultFixedProgram } from '../services/defaultFixedProgram.js';
import type { ProgressionVariant } from '../services/workoutProgressionStrategies.js';

const router = Router({ mergeParams: true });

const VARIANTS = new Set<string>([
  'general_double',
  'primary_smith_incline',
  'primary_rdl',
  'primary_lat_pulldown_upper_b',
  'primary_squat_or_hack',
  'isolation_calibration_candidate',
  'custom',
]);

function assertUser(req: AuthRequest, res: Response): string | null {
  const userId = req.params.id;
  if (req.userId !== userId) {
    res.status(403).json({ error: 'Forbidden' });
    return null;
  }
  return userId;
}

function serializeTemplate(t: {
  id: string;
  setIndex: number;
  setRole: string;
  targetRepsMin: number | null;
  targetRepsMax: number | null;
  targetRirMin: number | null;
  targetRirMax: number | null;
  percentOfTop: number | null;
}) {
  return {
    id: t.id,
    set_index: t.setIndex,
    set_role: t.setRole,
    target_reps_min: t.targetRepsMin,
    target_reps_max: t.targetRepsMax,
    target_rir_min: t.targetRirMin,
    target_rir_max: t.targetRirMax,
    percent_of_top: t.percentOfTop,
  };
}

function serializeProgramDayExercise(e: {
  id: string;
  exerciseId: string;
  orderIndex: number;
  progressionVariant: string;
  notes: string | null;
  exercise: { id: string; name: string; kind: string };
  setTemplates: Array<{
    id: string;
    setIndex: number;
    setRole: string;
    targetRepsMin: number | null;
    targetRepsMax: number | null;
    targetRirMin: number | null;
    targetRirMax: number | null;
    percentOfTop: number | null;
  }>;
}) {
  return {
    id: e.id,
    exercise_id: e.exerciseId,
    order_index: e.orderIndex,
    progression_variant: e.progressionVariant,
    notes: e.notes,
    exercise: { id: e.exercise.id, name: e.exercise.name, kind: e.exercise.kind },
    set_templates: e.setTemplates.map(serializeTemplate),
  };
}

async function loadProgramFull(programId: string, userId: string) {
  return prisma.workoutProgram.findFirst({
    where: { id: programId, userId },
    include: {
      days: {
        orderBy: { orderIndex: 'asc' },
        include: {
          exercises: {
            orderBy: { orderIndex: 'asc' },
            include: {
              exercise: true,
              setTemplates: { orderBy: { setIndex: 'asc' } },
            },
          },
        },
      },
    },
  });
}

router.get('/', requireAuth, async (req: AuthRequest, res: Response): Promise<void> => {
  const userId = assertUser(req, res);
  if (!userId) return;
  let rows = await prisma.workoutProgram.findMany({
    where: { userId },
    orderBy: { updatedAt: 'desc' },
    include: { _count: { select: { days: true } } },
  });
  if (rows.length === 0) {
    await ensureDefaultFixedProgram(userId);
    rows = await prisma.workoutProgram.findMany({
      where: { userId },
      orderBy: { updatedAt: 'desc' },
      include: { _count: { select: { days: true } } },
    });
  }
  res.json(
    rows.map((p) => ({
      id: p.id,
      name: p.name,
      description: p.description,
      day_count: p._count.days,
      created_at: p.createdAt.toISOString(),
      updated_at: p.updatedAt.toISOString(),
    }))
  );
});

router.post('/', requireAuth, async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  const userId = assertUser(req, res);
  if (!userId) return;
  const body = req.body as { name?: string; description?: string | null };
  if (!body?.name || typeof body.name !== 'string' || body.name.trim().length < 1 || body.name.length > 120) {
    res.status(400).json({ error: 'name must be 1–120 characters' });
    return;
  }
  try {
    const p = await prisma.workoutProgram.create({
      data: {
        userId,
        name: body.name.trim(),
        description: body.description != null ? String(body.description).slice(0, 2000) : null,
      },
    });
    res.status(201).json({
      id: p.id,
      name: p.name,
      description: p.description,
      days: [],
      created_at: p.createdAt.toISOString(),
      updated_at: p.updatedAt.toISOString(),
    });
  } catch (err) {
    next(err as Error);
  }
});

router.get('/:programId', requireAuth, async (req: AuthRequest, res: Response): Promise<void> => {
  const userId = assertUser(req, res);
  if (!userId) return;
  const p = await loadProgramFull(req.params.programId, userId);
  if (!p) {
    res.status(404).json({ error: 'Program not found' });
    return;
  }
  res.json({
    id: p.id,
    name: p.name,
    description: p.description,
    created_at: p.createdAt.toISOString(),
    updated_at: p.updatedAt.toISOString(),
    days: p.days.map((d) => ({
      id: d.id,
      name: d.name,
      order_index: d.orderIndex,
      exercises: d.exercises.map(serializeProgramDayExercise),
    })),
  });
});

router.patch('/:programId', requireAuth, async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  const userId = assertUser(req, res);
  if (!userId) return;
  const body = req.body as { name?: string; description?: string | null };
  const existing = await prisma.workoutProgram.findFirst({ where: { id: req.params.programId, userId } });
  if (!existing) {
    res.status(404).json({ error: 'Program not found' });
    return;
  }
  try {
    await prisma.workoutProgram.update({
      where: { id: existing.id },
      data: {
        ...(body.name !== undefined && { name: String(body.name).trim().slice(0, 120) }),
        ...(body.description !== undefined && { description: body.description === null ? null : String(body.description).slice(0, 2000) }),
      },
    });
    const p = await loadProgramFull(existing.id, userId);
    if (!p) {
      res.status(404).json({ error: 'Program not found' });
      return;
    }
    res.json({
      id: p.id,
      name: p.name,
      description: p.description,
      created_at: p.createdAt.toISOString(),
      updated_at: p.updatedAt.toISOString(),
      days: p.days.map((d) => ({
        id: d.id,
        name: d.name,
        order_index: d.orderIndex,
        exercises: d.exercises.map(serializeProgramDayExercise),
      })),
    });
  } catch (err) {
    next(err as Error);
  }
});

router.delete('/:programId', requireAuth, async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  const userId = assertUser(req, res);
  if (!userId) return;
  try {
    const existing = await prisma.workoutProgram.findFirst({ where: { id: req.params.programId, userId } });
    if (!existing) {
      res.status(404).json({ error: 'Program not found' });
      return;
    }
    await prisma.workoutProgram.delete({ where: { id: existing.id } });
    res.status(204).send();
  } catch (err) {
    next(err as Error);
  }
});

router.post('/:programId/days', requireAuth, async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  const userId = assertUser(req, res);
  if (!userId) return;
  const body = req.body as { name?: string; order_index?: number };
  if (!body?.name || typeof body.name !== 'string' || body.name.trim().length < 1 || body.name.length > 80) {
    res.status(400).json({ error: 'name must be 1–80 characters' });
    return;
  }
  const program = await prisma.workoutProgram.findFirst({ where: { id: req.params.programId, userId } });
  if (!program) {
    res.status(404).json({ error: 'Program not found' });
    return;
  }
  try {
    const maxO = await prisma.programDay.aggregate({
      where: { programId: program.id },
      _max: { orderIndex: true },
    });
    const orderIndex = body.order_index ?? (maxO._max.orderIndex ?? -1) + 1;
    const d = await prisma.programDay.create({
      data: {
        programId: program.id,
        name: body.name.trim(),
        orderIndex,
      },
    });
    res.status(201).json({
      id: d.id,
      name: d.name,
      order_index: d.orderIndex,
      exercises: [],
    });
  } catch (err) {
    next(err as Error);
  }
});

router.patch('/:programId/days/:dayId', requireAuth, async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  const userId = assertUser(req, res);
  if (!userId) return;
  const body = req.body as { name?: string; order_index?: number };
  const day = await prisma.programDay.findFirst({
    where: { id: req.params.dayId, programId: req.params.programId, program: { userId } },
  });
  if (!day) {
    res.status(404).json({ error: 'Day not found' });
    return;
  }
  try {
    await prisma.programDay.update({
      where: { id: day.id },
      data: {
        ...(body.name !== undefined && { name: String(body.name).trim().slice(0, 80) }),
        ...(body.order_index !== undefined && { orderIndex: body.order_index }),
      },
    });
    const p = await loadProgramFull(req.params.programId, userId);
    if (!p) {
      res.status(404).json({ error: 'Program not found' });
      return;
    }
    res.json({
      id: p.id,
      name: p.name,
      description: p.description,
      created_at: p.createdAt.toISOString(),
      updated_at: p.updatedAt.toISOString(),
      days: p.days.map((d) => ({
        id: d.id,
        name: d.name,
        order_index: d.orderIndex,
        exercises: d.exercises.map(serializeProgramDayExercise),
      })),
    });
  } catch (err) {
    next(err as Error);
  }
});

router.delete('/:programId/days/:dayId', requireAuth, async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  const userId = assertUser(req, res);
  if (!userId) return;
  const day = await prisma.programDay.findFirst({
    where: { id: req.params.dayId, programId: req.params.programId, program: { userId } },
  });
  if (!day) {
    res.status(404).json({ error: 'Day not found' });
    return;
  }
  try {
    await prisma.programDay.delete({ where: { id: day.id } });
    res.status(204).send();
  } catch (err) {
    next(err as Error);
  }
});

router.post('/:programId/days/:dayId/exercises', requireAuth, async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  const userId = assertUser(req, res);
  if (!userId) return;
  const body = req.body as { exercise_id?: string; progression_variant?: string; order_index?: number; notes?: string | null };
  if (!body?.exercise_id || typeof body.exercise_id !== 'string') {
    res.status(400).json({ error: 'exercise_id required' });
    return;
  }
  const variant = body.progression_variant ?? 'general_double';
  if (!VARIANTS.has(variant)) {
    res.status(400).json({ error: 'Invalid progression_variant' });
    return;
  }
  const day = await prisma.programDay.findFirst({
    where: { id: req.params.dayId, programId: req.params.programId, program: { userId } },
  });
  if (!day) {
    res.status(404).json({ error: 'Day not found' });
    return;
  }
  const ex = await prisma.exercise.findFirst({
    where: { id: body.exercise_id, OR: [{ userId: null }, { userId }] },
  });
  if (!ex) {
    res.status(404).json({ error: 'Exercise not found' });
    return;
  }
  try {
    const maxO = await prisma.programDayExercise.aggregate({
      where: { programDayId: day.id },
      _max: { orderIndex: true },
    });
    const orderIndex = body.order_index ?? (maxO._max.orderIndex ?? -1) + 1;
    const notesVal =
      body.notes === undefined
        ? undefined
        : body.notes === null
          ? null
          : String(body.notes).slice(0, 2000);
    const pde = await prisma.programDayExercise.create({
      data: {
        programDayId: day.id,
        exerciseId: ex.id,
        orderIndex,
        progressionVariant: variant as ProgressionVariant,
        ...(notesVal !== undefined ? { notes: notesVal } : {}),
      },
      include: { exercise: true, setTemplates: true },
    });
    res.status(201).json(serializeProgramDayExercise(pde));
  } catch (err) {
    next(err as Error);
  }
});

router.patch(
  '/:programId/days/:dayId/exercises/:pdeId',
  requireAuth,
  async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    const userId = assertUser(req, res);
    if (!userId) return;
    const body = req.body as { order_index?: number; progression_variant?: string; notes?: string | null };
    const pde = await prisma.programDayExercise.findFirst({
      where: {
        id: req.params.pdeId,
        programDayId: req.params.dayId,
        programDay: { programId: req.params.programId, program: { userId } },
      },
    });
    if (!pde) {
      res.status(404).json({ error: 'Exercise line not found' });
      return;
    }
    if (body.progression_variant !== undefined) {
      if (!VARIANTS.has(body.progression_variant)) {
        res.status(400).json({ error: 'Invalid progression_variant' });
        return;
      }
    }
    if (body.order_index === undefined && body.progression_variant === undefined && body.notes === undefined) {
      res.status(400).json({ error: 'order_index, progression_variant, or notes required' });
      return;
    }
    try {
      if (body.order_index !== undefined) {
        await prisma.$transaction(async (tx) => {
          const lines = await tx.programDayExercise.findMany({
            where: { programDayId: req.params.dayId },
            orderBy: { orderIndex: 'asc' },
          });
          const pos = lines.findIndex((l) => l.id === pde.id);
          if (pos === -1) return;
          const [moved] = lines.splice(pos, 1);
          const target = Math.max(0, Math.min(body.order_index!, lines.length));
          lines.splice(target, 0, moved);
          for (let i = 0; i < lines.length; i++) {
            await tx.programDayExercise.update({
              where: { id: lines[i].id },
              data: { orderIndex: i },
            });
          }
        });
      }
      if (body.progression_variant !== undefined) {
        await prisma.programDayExercise.update({
          where: { id: pde.id },
          data: { progressionVariant: body.progression_variant },
        });
      }
      if (body.notes !== undefined) {
        await prisma.programDayExercise.update({
          where: { id: pde.id },
          data: { notes: body.notes === null ? null : String(body.notes).slice(0, 2000) },
        });
      }
      const p = await loadProgramFull(req.params.programId, userId);
      if (!p) {
        res.status(404).json({ error: 'Program not found' });
        return;
      }
      res.json({
        id: p.id,
        name: p.name,
        description: p.description,
        created_at: p.createdAt.toISOString(),
        updated_at: p.updatedAt.toISOString(),
        days: p.days.map((d) => ({
          id: d.id,
          name: d.name,
          order_index: d.orderIndex,
          exercises: d.exercises.map(serializeProgramDayExercise),
        })),
      });
    } catch (err) {
      next(err as Error);
    }
  }
);

router.delete('/:programId/days/:dayId/exercises/:pdeId', requireAuth, async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  const userId = assertUser(req, res);
  if (!userId) return;
  const pde = await prisma.programDayExercise.findFirst({
    where: {
      id: req.params.pdeId,
      programDayId: req.params.dayId,
      programDay: { programId: req.params.programId, program: { userId } },
    },
  });
  if (!pde) {
    res.status(404).json({ error: 'Exercise line not found' });
    return;
  }
  try {
    await prisma.programDayExercise.delete({ where: { id: pde.id } });
    res.status(204).send();
  } catch (err) {
    next(err as Error);
  }
});

router.post(
  '/:programId/days/:dayId/exercises/:pdeId/templates',
  requireAuth,
  async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    const userId = assertUser(req, res);
    if (!userId) return;
    const body = req.body as {
      set_role?: string;
      set_index?: number;
      target_reps_min?: number | null;
      target_reps_max?: number | null;
      target_rir_min?: number | null;
      target_rir_max?: number | null;
      percent_of_top?: number | null;
    };
    if (!body?.set_role || !['top', 'backoff', 'working'].includes(body.set_role)) {
      res.status(400).json({ error: 'set_role must be top, backoff, or working' });
      return;
    }
    const pde = await prisma.programDayExercise.findFirst({
      where: {
        id: req.params.pdeId,
        programDayId: req.params.dayId,
        programDay: { programId: req.params.programId, program: { userId } },
      },
    });
    if (!pde) {
      res.status(404).json({ error: 'Exercise line not found' });
      return;
    }
    try {
      let setIndex = body.set_index;
      if (setIndex === undefined) {
        const m = await prisma.programDaySetTemplate.aggregate({
          where: { programDayExerciseId: pde.id },
          _max: { setIndex: true },
        });
        setIndex = (m._max.setIndex ?? -1) + 1;
      }
      const t = await prisma.programDaySetTemplate.create({
        data: {
          programDayExerciseId: pde.id,
          setIndex: setIndex!,
          setRole: body.set_role,
          targetRepsMin: body.target_reps_min ?? null,
          targetRepsMax: body.target_reps_max ?? null,
          targetRirMin: body.target_rir_min ?? null,
          targetRirMax: body.target_rir_max ?? null,
          percentOfTop: body.percent_of_top ?? null,
        },
      });
      res.status(201).json(serializeTemplate(t));
    } catch (err) {
      next(err as Error);
    }
  }
);

router.delete(
  '/:programId/days/:dayId/exercises/:pdeId/templates/:templateId',
  requireAuth,
  async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    const userId = assertUser(req, res);
    if (!userId) return;
    const t = await prisma.programDaySetTemplate.findFirst({
      where: {
        id: req.params.templateId,
        programDayExerciseId: req.params.pdeId,
        programDayExercise: {
          id: req.params.pdeId,
          programDayId: req.params.dayId,
          programDay: { programId: req.params.programId, program: { userId } },
        },
      },
    });
    if (!t) {
      res.status(404).json({ error: 'Template not found' });
      return;
    }
    try {
      await prisma.programDaySetTemplate.delete({ where: { id: t.id } });
      res.status(204).send();
    } catch (err) {
      next(err as Error);
    }
  }
);

export default router;
