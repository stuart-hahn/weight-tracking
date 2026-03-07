import { Router, type Response } from 'express';
import { prisma } from '../config/db.js';
import { requireAuth, type AuthRequest } from '../middleware/auth.js';
import { validateOptionalMetric } from '../middleware/validate.js';
import type { OptionalMetricCreateInput } from '../types/index.js';

const router = Router({ mergeParams: true });

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
  res.json(
    rows.map((r) => ({
      id: r.id,
      user_id: r.userId,
      date: r.date.toISOString().slice(0, 10),
      body_fat_percent: r.bodyFatPercent,
      created_at: r.createdAt.toISOString(),
    }))
  );
});

export default router;
