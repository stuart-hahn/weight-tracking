import { Router, type Response } from 'express';
import bcrypt from 'bcryptjs';
import { Prisma } from '../generated/prisma/client.js';
import { prisma } from '../config/db.js';
import { requireAuth, signToken, type AuthRequest } from '../middleware/auth.js';
import { validateCreateUser } from '../middleware/validate.js';
import type { UserCreateInput, UserProfile } from '../types/index.js';

const router = Router();

/** POST /api/users - Create user (public) */
router.post('/', validateCreateUser, async (req, res: Response): Promise<void> => {
  const body = req.body as UserCreateInput;
  const passwordHash = await bcrypt.hash(body.password, 10);
  try {
    const user = await prisma.user.create({
      data: {
        email: body.email,
        passwordHash,
        age: body.age,
        sex: body.sex,
        heightCm: body.height_cm,
        currentWeightKg: body.current_weight_kg,
        targetBodyFatPercent: body.target_body_fat_percent,
        activityLevel: body.activity_level ?? null,
        leanMassKg: body.lean_mass_kg ?? null,
      },
      select: { id: true, email: true },
    });
    const token = signToken({ sub: user.id, email: user.email });
    res.status(201).json({ user: { id: user.id, email: user.email }, token });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      res.status(409).json({ error: 'Email already registered' });
      return;
    }
    res.status(500).json({ error: 'Failed to create user' });
  }
});

/** GET /api/users/:id - Get user profile (protected) */
router.get('/:id', requireAuth, async (req: AuthRequest, res: Response): Promise<void> => {
  const id = req.params.id;
  if (req.userId !== id) {
    res.status(403).json({ error: 'Forbidden' });
    return;
  }
  const user = await prisma.user.findUnique({
    where: { id },
    select: {
      id: true,
      email: true,
      age: true,
      sex: true,
      heightCm: true,
      currentWeightKg: true,
      targetBodyFatPercent: true,
      activityLevel: true,
      leanMassKg: true,
      createdAt: true,
      updatedAt: true,
    },
  });
  if (!user) {
    res.status(404).json({ error: 'User not found' });
    return;
  }
  const profile: UserProfile = {
    id: user.id,
    email: user.email,
    age: user.age,
    sex: user.sex as 'male' | 'female',
    height_cm: user.heightCm,
    current_weight_kg: user.currentWeightKg,
    target_body_fat_percent: user.targetBodyFatPercent,
    activity_level: user.activityLevel as UserProfile['activity_level'],
    lean_mass_kg: user.leanMassKg,
    created_at: user.createdAt.toISOString(),
    updated_at: user.updatedAt.toISOString(),
  };
  res.json(profile);
});

/** PATCH /api/users/:id - Update profile (protected, stub) */
router.patch('/:id', requireAuth, async (req: AuthRequest, res: Response): Promise<void> => {
  if (req.userId !== req.params.id) {
    res.status(403).json({ error: 'Forbidden' });
    return;
  }
  res.json({ message: 'Profile update stub – Phase 2' });
});

export default router;
