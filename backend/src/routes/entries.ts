import { Router, type Response, type NextFunction } from 'express';
import { Prisma } from '../../generated/prisma/client.js';
import { prisma } from '../config/db.js';
import { requireAuth, type AuthRequest } from '../middleware/auth.js';
import { validateCreateEntry, validateUpdateEntry } from '../middleware/validate.js';
import type { DailyEntryCreateInput, DailyEntryUpdateInput } from '../types/index.js';

const router = Router({ mergeParams: true });

/** POST /api/users/:id/entries - Log daily entry (protected) */
router.post('/', requireAuth, validateCreateEntry, async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  const userId = req.params.id;
  if (req.userId !== userId) {
    res.status(403).json({ error: 'Forbidden' });
    return;
  }
  const body = req.body as DailyEntryCreateInput;
  const date = new Date(body.date);
  try {
    const entry = await prisma.dailyEntry.create({
      data: {
        userId,
        date,
        weightKg: body.weight_kg,
        calories: body.calories ?? null,
        waistCm: body.waist_cm ?? null,
        hipCm: body.hip_cm ?? null,
      },
    });
    res.status(201).json({
      id: entry.id,
      user_id: entry.userId,
      date: body.date,
      weight_kg: entry.weightKg,
      calories: entry.calories,
      waist_cm: entry.waistCm,
      hip_cm: entry.hipCm,
      created_at: entry.createdAt.toISOString(),
    });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && (err as Prisma.PrismaClientKnownRequestError).code === 'P2002') {
      const e = new Error('Entry already exists for this date') as Error & { statusCode: number };
      e.statusCode = 409;
      next(e);
      return;
    }
    next(err as Error);
  }
});

/** GET /api/users/:id/entries - List entries (protected) */
router.get('/', requireAuth, async (req: AuthRequest, res: Response): Promise<void> => {
  const userId = req.params.id;
  if (req.userId !== userId) {
    res.status(403).json({ error: 'Forbidden' });
    return;
  }
  const limit = Math.min(Number(req.query.limit) || 90, 365);
  const entries = await prisma.dailyEntry.findMany({
    where: { userId },
    orderBy: { date: 'desc' },
    take: limit,
  });
  type EntryRow = { id: string; userId: string; date: Date; weightKg: number; calories: number | null; waistCm: number | null; hipCm: number | null; createdAt: Date };
  res.json(
    entries.map((e: EntryRow) => ({
      id: e.id,
      user_id: e.userId,
      date: e.date.toISOString().slice(0, 10),
      weight_kg: e.weightKg,
      calories: e.calories,
      waist_cm: e.waistCm,
      hip_cm: e.hipCm,
      created_at: e.createdAt.toISOString(),
    }))
  );
});

/** PATCH /api/users/:id/entries/:entryId - Update entry (protected) */
router.patch('/:entryId', requireAuth, validateUpdateEntry, async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  const userId = req.params.id;
  const entryId = req.params.entryId;
  if (req.userId !== userId) {
    res.status(403).json({ error: 'Forbidden' });
    return;
  }
  const body = req.body as DailyEntryUpdateInput;
  try {
    const entry = await prisma.dailyEntry.findFirst({ where: { id: entryId, userId } });
    if (!entry) {
      res.status(404).json({ error: 'Entry not found' });
      return;
    }
    const updated = await prisma.dailyEntry.update({
      where: { id: entryId },
      data: {
        ...(body.weight_kg !== undefined && { weightKg: body.weight_kg }),
        ...(body.calories !== undefined && { calories: body.calories }),
        ...(body.waist_cm !== undefined && { waistCm: body.waist_cm }),
        ...(body.hip_cm !== undefined && { hipCm: body.hip_cm }),
      },
    });
    type UpdatedRow = { id: string; userId: string; date: Date; weightKg: number; calories: number | null; waistCm: number | null; hipCm: number | null; createdAt: Date };
    const e = updated as UpdatedRow;
    res.json({
      id: e.id,
      user_id: e.userId,
      date: e.date.toISOString().slice(0, 10),
      weight_kg: e.weightKg,
      calories: e.calories,
      waist_cm: e.waistCm,
      hip_cm: e.hipCm,
      created_at: e.createdAt.toISOString(),
    });
  } catch (err) {
    next(err as Error);
  }
});

/** DELETE /api/users/:id/entries/:entryId - Delete entry (protected) */
router.delete('/:entryId', requireAuth, async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  const userId = req.params.id;
  const entryId = req.params.entryId;
  if (req.userId !== userId) {
    res.status(403).json({ error: 'Forbidden' });
    return;
  }
  try {
    const entry = await prisma.dailyEntry.findFirst({ where: { id: entryId, userId } });
    if (!entry) {
      res.status(404).json({ error: 'Entry not found' });
      return;
    }
    await prisma.dailyEntry.delete({ where: { id: entryId } });
    res.status(204).send();
  } catch (err) {
    next(err as Error);
  }
});

export default router;
