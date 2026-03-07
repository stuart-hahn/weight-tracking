import { Router, type Response } from 'express';
import { prisma } from '../config/db.js';
import { requireAuth, type AuthRequest } from '../middleware/auth.js';
import type { ProgressMetrics } from '../types/index.js';

const router = Router({ mergeParams: true });

/** GET /api/users/:id/progress - Progress metrics (protected stub) */
router.get('/', requireAuth, async (req: AuthRequest, res: Response): Promise<void> => {
  const userId = req.params.id;
  if (req.userId !== userId) {
    res.status(403).json({ error: 'Forbidden' });
    return;
  }
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { currentWeightKg: true, targetBodyFatPercent: true },
  });
  if (!user) {
    res.status(404).json({ error: 'User not found' });
    return;
  }
  const agg = await prisma.dailyEntry.aggregate({
    where: { userId },
    _count: { id: true },
    _max: { date: true },
  });
  const count = agg._count.id;
  const maxDate = agg._max.date;
  const currentWeight = user.currentWeightKg;
  const targetBf = user.targetBodyFatPercent;
  // Phase 2: compute from lean_mass_kg or estimated BF; for now use placeholder
  const goalWeightKg = currentWeight;
  const progress: ProgressMetrics = {
    user_id: userId,
    current_weight_kg: currentWeight,
    goal_weight_kg: goalWeightKg,
    target_body_fat_percent: targetBf,
    entries_count: count,
    latest_entry_date: maxDate ? maxDate.toISOString().slice(0, 10) : null,
    weight_trend_kg_per_week: null,
  };
  res.json(progress);
});

export default router;
