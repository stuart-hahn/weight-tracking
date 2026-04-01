import { Router, type Response, type NextFunction } from 'express';
import { Prisma } from '../../generated/prisma/client.js';
import { prisma } from '../config/db.js';
import { requireAuth, type AuthRequest } from '../middleware/auth.js';
import {
  validateCreateExercise,
  validateUpdateExercise,
  validateBatchExerciseInsights,
  validateDuplicateExercise,
  validateCreateExerciseSubstitution,
} from '../middleware/validate.js';
import type {
  ExerciseCreateInput,
  ExerciseUpdateInput,
  ExerciseBatchInsightsInput,
  ExerciseDuplicateInput,
  ExerciseSubstitutionCreateInput,
} from '../types/index.js';
import type { ExerciseKind } from '../services/workoutProgression.js';
import { buildExerciseInsight } from '../services/workoutInsights.js';
import type { ProgressionVariant } from '../services/workoutProgressionStrategies.js';
import { detectPlateau, getExerciseSessionHistory } from '../services/exerciseHistory.js';

const router = Router({ mergeParams: true });

function assertUser(req: AuthRequest, res: Response): string | null {
  const userId = req.params.id;
  if (req.userId !== userId) {
    res.status(403).json({ error: 'Forbidden' });
    return null;
  }
  return userId;
}

router.get('/', requireAuth, async (req: AuthRequest, res: Response): Promise<void> => {
  const userId = assertUser(req, res);
  if (!userId) return;

  const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';
  const favoritesOnly = req.query.favorites_only === '1' || req.query.favorites_only === 'true';
  const customOnly = req.query.custom_only === '1' || req.query.custom_only === 'true';

  const favoriteRows = await prisma.userExerciseFavorite.findMany({
    where: { userId },
    select: { exerciseId: true },
  });
  const favoriteIds = new Set(favoriteRows.map((f) => f.exerciseId));

  const where: Prisma.ExerciseWhereInput = customOnly
    ? {
        userId,
        ...(q ? { name: { contains: q, mode: 'insensitive' } } : {}),
        ...(favoritesOnly ? { id: { in: [...favoriteIds] } } : {}),
      }
    : {
        OR: [{ userId: null }, { userId }],
        ...(q ? { name: { contains: q, mode: 'insensitive' } } : {}),
        ...(favoritesOnly ? { id: { in: [...favoriteIds] } } : {}),
      };

  const exercises = await prisma.exercise.findMany({
    where,
    orderBy: { name: 'asc' },
    take: 250,
  });

  res.json(
    exercises.map((e) => ({
      id: e.id,
      user_id: e.userId,
      name: e.name,
      kind: e.kind,
      is_custom: e.userId != null,
      is_favorite: favoriteIds.has(e.id),
      created_at: e.createdAt.toISOString(),
    }))
  );
});

router.post('/', requireAuth, validateCreateExercise, async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  const userId = assertUser(req, res);
  if (!userId) return;
  const body = req.body as ExerciseCreateInput;
  try {
    const exercise = await prisma.exercise.create({
      data: {
        userId,
        name: body.name.trim(),
        kind: body.kind,
      },
    });
    res.status(201).json({
      id: exercise.id,
      user_id: exercise.userId,
      name: exercise.name,
      kind: exercise.kind,
      is_custom: true,
      is_favorite: false,
      created_at: exercise.createdAt.toISOString(),
    });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      res.status(409).json({ error: 'You already have an exercise with this name.' });
      return;
    }
    next(err as Error);
  }
});

router.post(
  '/batch-insights',
  requireAuth,
  validateBatchExerciseInsights,
  async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    const userId = assertUser(req, res);
    if (!userId) return;
    const body = req.body as ExerciseBatchInsightsInput;
    try {
      const exercises = await prisma.exercise.findMany({
        where: { id: { in: body.exercise_ids }, OR: [{ userId: null }, { userId }] },
      });
      const byId = new Map(exercises.map((e) => [e.id, e]));
      const variants = body.progression_variant_by_exercise_id ?? {};
      const insights: Record<string, Awaited<ReturnType<typeof buildExerciseInsight>>> = {};
      await Promise.all(
        body.exercise_ids.map(async (id) => {
          const ex = byId.get(id);
          if (!ex) return;
          const override = variants[id] as ProgressionVariant | undefined;
          insights[id] = await buildExerciseInsight(userId, ex.id, ex.kind as ExerciseKind, ex.name, override ?? null);
        })
      );
      res.json({ insights });
    } catch (err) {
      next(err as Error);
    }
  }
);

router.get('/:exerciseId/insights', requireAuth, async (req: AuthRequest, res: Response): Promise<void> => {
  const userId = assertUser(req, res);
  if (!userId) return;
  const { exerciseId } = req.params;
  const exercise = await prisma.exercise.findFirst({
    where: { id: exerciseId, OR: [{ userId: null }, { userId }] },
  });
  if (!exercise) {
    res.status(404).json({ error: 'Exercise not found' });
    return;
  }
  const payload = await buildExerciseInsight(userId, exerciseId, exercise.kind as ExerciseKind, exercise.name);
  res.json(payload);
});

router.get('/:exerciseId/history', requireAuth, async (req: AuthRequest, res: Response): Promise<void> => {
  const userId = assertUser(req, res);
  if (!userId) return;
  const { exerciseId } = req.params;
  const exercise = await prisma.exercise.findFirst({
    where: { id: exerciseId, OR: [{ userId: null }, { userId }] },
  });
  if (!exercise) {
    res.status(404).json({ error: 'Exercise not found' });
    return;
  }
  const limitRaw = typeof req.query.limit === 'string' ? Number(req.query.limit) : 10;
  const limit = Number.isFinite(limitRaw) ? Math.min(50, Math.max(1, Math.floor(limitRaw))) : 10;
  const excludeSubstituted =
    req.query.exclude_substituted === '0' || req.query.exclude_substituted === 'false' ? false : true;
  const rowsNewestFirst = await getExerciseSessionHistory(userId, exerciseId, limit, excludeSubstituted);
  const chronological = [...rowsNewestFirst].reverse();
  const { plateau, plateau_hint } = detectPlateau(chronological);
  res.json({ rows: rowsNewestFirst, plateau, plateau_hint });
});

router.get('/:exerciseId/substitutions', requireAuth, async (req: AuthRequest, res: Response): Promise<void> => {
  const userId = assertUser(req, res);
  if (!userId) return;
  const { exerciseId } = req.params;
  const primary = await prisma.exercise.findFirst({
    where: { id: exerciseId, OR: [{ userId: null }, { userId }] },
  });
  if (!primary) {
    res.status(404).json({ error: 'Exercise not found' });
    return;
  }
  const rows = await prisma.exerciseSubstitution.findMany({
    where: { primaryExerciseId: exerciseId },
    orderBy: { orderIndex: 'asc' },
    include: { substituteExercise: true },
  });
  res.json(
    rows.map((r) => ({
      id: r.id,
      substitute_exercise_id: r.substituteExerciseId,
      order_index: r.orderIndex,
      name: r.substituteExercise.name,
      kind: r.substituteExercise.kind,
    }))
  );
});

router.post(
  '/:exerciseId/substitutions',
  requireAuth,
  validateCreateExerciseSubstitution,
  async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    const userId = assertUser(req, res);
    if (!userId) return;
    const { exerciseId } = req.params;
    const body = req.body as ExerciseSubstitutionCreateInput;
    const primary = await prisma.exercise.findFirst({
      where: { id: exerciseId, OR: [{ userId: null }, { userId }] },
    });
    if (!primary) {
      res.status(404).json({ error: 'Exercise not found' });
      return;
    }
    if (body.substitute_exercise_id === exerciseId) {
      res.status(400).json({ error: 'Cannot substitute an exercise with itself' });
      return;
    }
    const sub = await prisma.exercise.findFirst({
      where: { id: body.substitute_exercise_id, OR: [{ userId: null }, { userId }] },
    });
    if (!sub) {
      res.status(404).json({ error: 'Substitute exercise not found' });
      return;
    }
    try {
      const maxRow = await prisma.exerciseSubstitution.aggregate({
        where: { primaryExerciseId: exerciseId },
        _max: { orderIndex: true },
      });
      const nextOrder = (maxRow._max.orderIndex ?? -1) + 1;
      const row = await prisma.exerciseSubstitution.create({
        data: {
          primaryExerciseId: exerciseId,
          substituteExerciseId: body.substitute_exercise_id,
          orderIndex: nextOrder,
        },
        include: { substituteExercise: true },
      });
      res.status(201).json({
        id: row.id,
        substitute_exercise_id: row.substituteExerciseId,
        order_index: row.orderIndex,
        name: row.substituteExercise.name,
        kind: row.substituteExercise.kind,
      });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        res.status(409).json({ error: 'That substitute is already in the list' });
        return;
      }
      next(err as Error);
    }
  }
);

router.delete(
  '/:exerciseId/substitutions/:substituteExerciseId',
  requireAuth,
  async (req: AuthRequest, res: Response): Promise<void> => {
    const userId = assertUser(req, res);
    if (!userId) return;
    const { exerciseId, substituteExerciseId } = req.params;
    const primary = await prisma.exercise.findFirst({
      where: { id: exerciseId, OR: [{ userId: null }, { userId }] },
    });
    if (!primary) {
      res.status(404).json({ error: 'Exercise not found' });
      return;
    }
    const del = await prisma.exerciseSubstitution.deleteMany({
      where: { primaryExerciseId: exerciseId, substituteExerciseId },
    });
    if (del.count === 0) {
      res.status(404).json({ error: 'Substitution not found' });
      return;
    }
    res.status(204).send();
  }
);

router.post('/:exerciseId/favorite', requireAuth, async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  const userId = assertUser(req, res);
  if (!userId) return;
  const { exerciseId } = req.params;
  const exercise = await prisma.exercise.findFirst({
    where: { id: exerciseId, OR: [{ userId: null }, { userId }] },
  });
  if (!exercise) {
    res.status(404).json({ error: 'Exercise not found' });
    return;
  }
  try {
    await prisma.userExerciseFavorite.upsert({
      where: { userId_exerciseId: { userId, exerciseId } },
      create: { userId, exerciseId },
      update: {},
    });
    res.status(204).send();
  } catch (err) {
    next(err as Error);
  }
});

router.delete('/:exerciseId/favorite', requireAuth, async (req: AuthRequest, res: Response): Promise<void> => {
  const userId = assertUser(req, res);
  if (!userId) return;
  const { exerciseId } = req.params;
  await prisma.userExerciseFavorite.deleteMany({ where: { userId, exerciseId } });
  res.status(204).send();
});

router.post(
  '/:exerciseId/duplicate',
  requireAuth,
  validateDuplicateExercise,
  async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    const userId = assertUser(req, res);
    if (!userId) return;
    const { exerciseId } = req.params;
    const body = (req.body ?? {}) as ExerciseDuplicateInput;
    const source = await prisma.exercise.findFirst({
      where: { id: exerciseId, OR: [{ userId: null }, { userId }] },
    });
    if (!source) {
      res.status(404).json({ error: 'Exercise not found' });
      return;
    }
    const base =
      body.name != null && typeof body.name === 'string' && body.name.trim().length > 0
        ? body.name.trim().slice(0, 120)
        : `${source.name.slice(0, 100)} (copy)`.slice(0, 120);
    const tryNames = [base];
    for (let n = 2; n <= 15; n++) {
      tryNames.push(`${base.slice(0, 110)} (${n})`.slice(0, 120));
    }
    try {
      for (const name of tryNames) {
        try {
          const exercise = await prisma.exercise.create({
            data: {
              userId,
              name,
              kind: source.kind,
            },
          });
          const fav = await prisma.userExerciseFavorite.findUnique({
            where: { userId_exerciseId: { userId, exerciseId: exercise.id } },
          });
          res.status(201).json({
            id: exercise.id,
            user_id: exercise.userId,
            name: exercise.name,
            kind: exercise.kind,
            is_custom: true,
            is_favorite: fav != null,
            created_at: exercise.createdAt.toISOString(),
          });
          return;
        } catch (err) {
          if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
            continue;
          }
          throw err;
        }
      }
      res.status(409).json({ error: 'Could not find a unique name for the copy; try a different name.' });
    } catch (err) {
      next(err as Error);
    }
  }
);

router.get('/:exerciseId', requireAuth, async (req: AuthRequest, res: Response): Promise<void> => {
  const userId = assertUser(req, res);
  if (!userId) return;
  const { exerciseId } = req.params;
  const exercise = await prisma.exercise.findFirst({
    where: { id: exerciseId, OR: [{ userId: null }, { userId }] },
  });
  if (!exercise) {
    res.status(404).json({ error: 'Exercise not found' });
    return;
  }
  const fav = await prisma.userExerciseFavorite.findUnique({
    where: { userId_exerciseId: { userId, exerciseId } },
  });
  res.json({
    id: exercise.id,
    user_id: exercise.userId,
    name: exercise.name,
    kind: exercise.kind,
    is_custom: exercise.userId != null,
    is_favorite: fav != null,
    created_at: exercise.createdAt.toISOString(),
  });
});

router.patch('/:exerciseId', requireAuth, validateUpdateExercise, async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  const userId = assertUser(req, res);
  if (!userId) return;
  const { exerciseId } = req.params;
  const body = req.body as ExerciseUpdateInput;
  const exercise = await prisma.exercise.findFirst({
    where: { id: exerciseId, userId },
  });
  if (!exercise) {
    res.status(404).json({ error: 'Custom exercise not found' });
    return;
  }
  try {
    const updated = await prisma.exercise.update({
      where: { id: exerciseId },
      data: {
        ...(body.name !== undefined && { name: body.name.trim() }),
        ...(body.kind !== undefined && { kind: body.kind }),
      },
    });
    const fav = await prisma.userExerciseFavorite.findUnique({
      where: { userId_exerciseId: { userId, exerciseId } },
    });
    res.json({
      id: updated.id,
      user_id: updated.userId,
      name: updated.name,
      kind: updated.kind,
      is_custom: true,
      is_favorite: fav != null,
      created_at: updated.createdAt.toISOString(),
    });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      res.status(409).json({ error: 'You already have an exercise with this name.' });
      return;
    }
    next(err as Error);
  }
});

router.delete('/:exerciseId', requireAuth, async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  const userId = assertUser(req, res);
  if (!userId) return;
  const { exerciseId } = req.params;
  const exercise = await prisma.exercise.findFirst({
    where: { id: exerciseId, userId },
  });
  if (!exercise) {
    res.status(404).json({ error: 'Custom exercise not found' });
    return;
  }
  try {
    await prisma.exercise.delete({ where: { id: exerciseId } });
    res.status(204).send();
  } catch (err) {
    const msg = String(err);
    if (msg.includes('Foreign key') || msg.includes('violates foreign key')) {
      res.status(409).json({ error: 'Exercise is used in workouts; remove it from workouts first' });
      return;
    }
    next(err as Error);
  }
});

export default router;
