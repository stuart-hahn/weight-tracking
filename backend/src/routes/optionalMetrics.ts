import { Router, type Response } from 'express';
import { prisma } from '../config/db.js';
import { requireAuth, type AuthRequest } from '../middleware/auth.js';
import { validateOptionalMetric } from '../middleware/validate.js';
import type { OptionalMetricCreateInput } from '../types/index.js';

const router = Router({ mergeParams: true });

function isValidIsoDate(s: unknown): s is string {
  if (typeof s !== 'string') return false;
  const d = new Date(s);
  return !Number.isNaN(d.getTime()) && s === d.toISOString().slice(0, 10);
}

/** POST /api/users/:id/optional-metrics - Upsert body fat % for a date (protected) */
router.post('/', requireAuth, validateOptionalMetric, async (req: AuthRequest, res: Response): Promise<void> => {
  const userId = req.params.id;
  if (req.userId !== userId) {
    res.status(403).json({ error: 'Forbidden' });
    return;
  }
  const body = req.body as OptionalMetricCreateInput;
  const date = new Date(body.date + 'T00:00:00.000Z');
  const row = await prisma.optionalMetric.upsert({
    where: {
      userId_date: { userId, date },
    },
    create: {
      userId,
      date,
      bodyFatPercent: body.body_fat_percent,
    },
    update: { bodyFatPercent: body.body_fat_percent },
    select: {
      id: true,
      userId: true,
      date: true,
      bodyFatPercent: true,
      createdAt: true,
    },
  });
  res.status(201).json({
    id: row.id,
    user_id: row.userId,
    date: row.date.toISOString().slice(0, 10),
    body_fat_percent: row.bodyFatPercent,
    created_at: row.createdAt.toISOString(),
  });
});

/** DELETE /api/users/:id/optional-metrics?date=YYYY-MM-DD - Delete optional metric for a date (protected) */
router.delete('/', requireAuth, async (req: AuthRequest, res: Response): Promise<void> => {
  const userId = req.params.id;
  if (req.userId !== userId) {
    res.status(403).json({ error: 'Forbidden' });
    return;
  }

  const dateStr = req.query.date;
  if (!isValidIsoDate(dateStr)) {
    res.status(400).json({ error: 'Valid date (YYYY-MM-DD) required' });
    return;
  }

  const date = new Date(`${dateStr}T00:00:00.000Z`);
  await prisma.optionalMetric.deleteMany({
    where: { userId, date },
  });
  res.status(204).send();
});

/** GET /api/users/:id/optional-metrics - List optional metrics (protected) */
router.get('/', requireAuth, async (req: AuthRequest, res: Response): Promise<void> => {
  const userId = req.params.id;
  if (req.userId !== userId) {
    res.status(403).json({ error: 'Forbidden' });
    return;
  }
  const limit = Math.min(Number(req.query.limit) || 365, 365);
  const rows = await prisma.optionalMetric.findMany({
    where: { userId },
    orderBy: { date: 'desc' },
    take: limit,
    select: {
      id: true,
      userId: true,
      date: true,
      bodyFatPercent: true,
      createdAt: true,
    },
  });
  type Row = { id: string; userId: string; date: Date; bodyFatPercent: number | null; createdAt: Date };
  res.json(
    rows.map((r: Row) => ({
      id: r.id,
      user_id: r.userId,
      date: r.date.toISOString().slice(0, 10),
      body_fat_percent: r.bodyFatPercent,
      created_at: r.createdAt.toISOString(),
    }))
  );
});

export default router;
