import { Router, type Response, type NextFunction } from 'express';
import { Prisma } from '../../generated/prisma/client.js';
import { prisma } from '../config/db.js';
import { requireAuth, type AuthRequest } from '../middleware/auth.js';
import { validateCreateEntry } from '../middleware/validate.js';
import type { DailyEntryCreateInput } from '../types/index.js';

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

export default router;
