import { Router, type Response, type NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import { Prisma } from '../generated/prisma/client.js';
import { prisma } from '../config/db.js';
import { requireAuth, signToken, type AuthRequest } from '../middleware/auth.js';
import { validateCreateUser, validateUpdateUser } from '../middleware/validate.js';
import type { UserCreateInput, UserUpdateInput, UserProfile } from '../types/index.js';

const router = Router();

/** POST /api/users - Create user (public) */
router.post('/', validateCreateUser, async (req, res: Response, next: NextFunction): Promise<void> => {
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
      const e = new Error('Email already registered') as Error & { statusCode: number };
      e.statusCode = 409;
      next(e);
      return;
    }
    next(err);
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

/** PATCH /api/users/:id - Update profile (protected) */
router.patch('/:id', requireAuth, validateUpdateUser, async (req: AuthRequest, res: Response): Promise<void> => {
  const id = req.params.id;
  if (req.userId !== id) {
    res.status(403).json({ error: 'Forbidden' });
    return;
  }
  const body = req.body as UserUpdateInput;
  const data: {
    age?: number;
    sex?: string;
    heightCm?: number;
    currentWeightKg?: number;
    targetBodyFatPercent?: number;
    activityLevel?: string | null;
    leanMassKg?: number | null;
  } = {};
  if (body.age !== undefined) data.age = body.age;
  if (body.sex !== undefined) data.sex = body.sex;
  if (body.height_cm !== undefined) data.heightCm = body.height_cm;
  if (body.current_weight_kg !== undefined) data.currentWeightKg = body.current_weight_kg;
  if (body.target_body_fat_percent !== undefined) data.targetBodyFatPercent = body.target_body_fat_percent;
  if (body.activity_level !== undefined) data.activityLevel = body.activity_level ?? null;
  if (body.lean_mass_kg !== undefined) data.leanMassKg = body.lean_mass_kg ?? null;
  if (Object.keys(data).length === 0) {
    const user = await prisma.user.findUnique({
      where: { id },
      select: { id: true, email: true, age: true, sex: true, heightCm: true, currentWeightKg: true, targetBodyFatPercent: true, activityLevel: true, leanMassKg: true, createdAt: true, updatedAt: true },
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
    return;
  }
  const user = await prisma.user.update({
    where: { id },
    data,
    select: { id: true, email: true, age: true, sex: true, heightCm: true, currentWeightKg: true, targetBodyFatPercent: true, activityLevel: true, leanMassKg: true, createdAt: true, updatedAt: true },
  });
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

export default router;
