import { Router, type Response, type NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import crypto from 'node:crypto';
import { Prisma } from '../../generated/prisma/client.js';
import { prisma } from '../config/db.js';
import { requireAuth, signToken, type AuthRequest } from '../middleware/auth.js';
import { validateCreateUser, validateUpdateUser } from '../middleware/validate.js';
import { sendVerificationEmail } from '../lib/email.js';
import type { UserCreateInput, UserUpdateInput, UserProfile } from '../types/index.js';

const router = Router();

/** POST /api/users - Create user (public) */
router.post('/', validateCreateUser, async (req, res: Response, next: NextFunction): Promise<void> => {
  const body = req.body as UserCreateInput;
  const passwordHash = await bcrypt.hash(body.password, 10);
  const verificationToken = crypto.randomBytes(32).toString('hex');
  const verificationExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
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
        units: body.units ?? 'metric',
        onboardingComplete: false,
        plan: 'free',
        emailVerificationToken: verificationToken,
        emailVerificationExpiresAt: verificationExpiresAt,
      },
      select: { id: true, email: true, onboardingComplete: true },
    });
    const token = signToken({ sub: user.id, email: user.email });
    res.status(201).json({
      user: { id: user.id, email: user.email, onboarding_complete: user.onboardingComplete, email_verified_at: null },
      token,
    });
    const baseUrl = (process.env.FRONTEND_URL ?? 'http://localhost:5173').replace(/\/$/, '');
    const verifyLink = `${baseUrl}/verify-email?token=${encodeURIComponent(verificationToken)}`;
    sendVerificationEmail(user.email, verifyLink).catch((err) => console.error('Verification email failed:', err));
  } catch (err) {
    const prismaErr = err as Prisma.PrismaClientKnownRequestError;
    if (prismaErr instanceof Prisma.PrismaClientKnownRequestError && prismaErr.code === 'P2002') {
      const e = new Error('Email already registered') as Error & { statusCode: number };
      e.statusCode = 409;
      next(e);
      return;
    }
    next(err as Error);
  }
});

/** POST /api/users/:id/resend-verification - Resend verification email (protected, rate-limited by global limiter) */
router.post('/:id/resend-verification', requireAuth, async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  const id = req.params.id;
  if (req.userId !== id) {
    res.status(403).json({ error: 'Forbidden' });
    return;
  }
  try {
    const user = await prisma.user.findUnique({
      where: { id },
      select: { id: true, email: true, emailVerifiedAt: true },
    });
    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }
    if (user.emailVerifiedAt) {
      res.status(400).json({ error: 'Email already verified' });
      return;
    }
    const verificationToken = crypto.randomBytes(32).toString('hex');
    const verificationExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
    await prisma.user.update({
      where: { id },
      data: {
        emailVerificationToken: verificationToken,
        emailVerificationExpiresAt: verificationExpiresAt,
      },
    });
    const baseUrl = (process.env.FRONTEND_URL ?? 'http://localhost:5173').replace(/\/$/, '');
    const verifyLink = `${baseUrl}/verify-email?token=${encodeURIComponent(verificationToken)}`;
    await sendVerificationEmail(user.email, verifyLink);
    res.json({ message: "We've sent a verification email. Check your inbox (and spam)." });
  } catch (err) {
    next(err as Error);
  }
});

/** GET /api/users/:id/export - Export user data (profile + entries + optional metrics) (protected) */
router.get('/:id/export', requireAuth, async (req: AuthRequest, res: Response): Promise<void> => {
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
      units: true,
      emailVerifiedAt: true,
      createdAt: true,
      updatedAt: true,
    },
  });
  if (!user) {
    res.status(404).json({ error: 'User not found' });
    return;
  }
  const [entries, optionalMetrics] = await Promise.all([
    prisma.dailyEntry.findMany({
      where: { userId: id },
      orderBy: { date: 'desc' },
      select: {
        id: true,
        date: true,
        weightKg: true,
        calories: true,
        waistCm: true,
        hipCm: true,
        createdAt: true,
      },
    }),
    prisma.optionalMetric.findMany({
      where: { userId: id },
      orderBy: { date: 'desc' },
      select: { date: true, bodyFatPercent: true, createdAt: true },
    }),
  ]);
  const exportData = {
    exported_at: new Date().toISOString(),
    profile: {
      id: user.id,
      email: user.email,
      age: user.age,
      sex: user.sex,
      height_cm: user.heightCm,
      current_weight_kg: user.currentWeightKg,
      target_body_fat_percent: user.targetBodyFatPercent,
      activity_level: user.activityLevel,
      lean_mass_kg: user.leanMassKg,
      units: user.units,
      email_verified_at: user.emailVerifiedAt?.toISOString() ?? null,
      created_at: user.createdAt.toISOString(),
      updated_at: user.updatedAt.toISOString(),
    },
    entries: entries.map((e: { id: string; date: Date; weightKg: number; calories: number | null; waistCm: number | null; hipCm: number | null; createdAt: Date }) => ({
      id: e.id,
      date: e.date.toISOString().slice(0, 10),
      weight_kg: e.weightKg,
      calories: e.calories,
      waist_cm: e.waistCm,
      hip_cm: e.hipCm,
      created_at: e.createdAt.toISOString(),
    })),
    optional_metrics: optionalMetrics.map((m: { date: Date; bodyFatPercent: number | null; createdAt: Date }) => ({
      date: m.date.toISOString().slice(0, 10),
      body_fat_percent: m.bodyFatPercent,
      created_at: m.createdAt.toISOString(),
    })),
  };
  res.json(exportData);
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
      units: true,
      timezone: true,
      emailVerifiedAt: true,
      onboardingComplete: true,
      plan: true,
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
    units: (user.units as UserProfile['units']) ?? 'metric',
    timezone: user.timezone ?? null,
    email_verified_at: user.emailVerifiedAt?.toISOString() ?? null,
    onboarding_complete: user.onboardingComplete,
    plan: user.plan,
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
    units?: string;
    onboardingComplete?: boolean;
    plan?: string | null;
    timezone?: string | null;
  } = {};
  if (body.age !== undefined) data.age = body.age;
  if (body.sex !== undefined) data.sex = body.sex;
  if (body.height_cm !== undefined) data.heightCm = body.height_cm;
  if (body.current_weight_kg !== undefined) data.currentWeightKg = body.current_weight_kg;
  if (body.target_body_fat_percent !== undefined) data.targetBodyFatPercent = body.target_body_fat_percent;
  if (body.activity_level !== undefined) data.activityLevel = body.activity_level ?? null;
  if (body.lean_mass_kg !== undefined) data.leanMassKg = body.lean_mass_kg ?? null;
  if (body.units !== undefined) data.units = body.units;
  if (body.onboarding_complete !== undefined) data.onboardingComplete = body.onboarding_complete;
  if (body.plan !== undefined) data.plan = body.plan ?? null;
  if (body.timezone !== undefined) data.timezone = body.timezone === '' ? null : body.timezone;
  const selectFields = {
    id: true,
    email: true,
    age: true,
    sex: true,
    heightCm: true,
    currentWeightKg: true,
    targetBodyFatPercent: true,
    activityLevel: true,
    leanMassKg: true,
    units: true,
    timezone: true,
    emailVerifiedAt: true,
    onboardingComplete: true,
    plan: true,
    createdAt: true,
    updatedAt: true,
  };
  if (Object.keys(data).length === 0) {
    const user = await prisma.user.findUnique({
      where: { id },
      select: selectFields,
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
      units: (user.units as UserProfile['units']) ?? 'metric',
      timezone: user.timezone ?? null,
      email_verified_at: user.emailVerifiedAt?.toISOString() ?? null,
      onboarding_complete: user.onboardingComplete,
      plan: user.plan,
      created_at: user.createdAt.toISOString(),
      updated_at: user.updatedAt.toISOString(),
    };
    res.json(profile);
    return;
  }
  const updatedUser = await prisma.user.update({
    where: { id },
    data,
    select: selectFields,
  });
  const profile: UserProfile = {
    id: updatedUser.id,
    email: updatedUser.email,
    age: updatedUser.age,
    sex: updatedUser.sex as 'male' | 'female',
    height_cm: updatedUser.heightCm,
    current_weight_kg: updatedUser.currentWeightKg,
    target_body_fat_percent: updatedUser.targetBodyFatPercent,
    activity_level: updatedUser.activityLevel as UserProfile['activity_level'],
    lean_mass_kg: updatedUser.leanMassKg,
    units: (updatedUser.units as UserProfile['units']) ?? 'metric',
    timezone: updatedUser.timezone ?? null,
    email_verified_at: updatedUser.emailVerifiedAt?.toISOString() ?? null,
    onboarding_complete: updatedUser.onboardingComplete,
    plan: updatedUser.plan,
    created_at: updatedUser.createdAt.toISOString(),
    updated_at: updatedUser.updatedAt.toISOString(),
  };
  res.json(profile);
});

export default router;
