import { Router, type Response } from 'express';
import rateLimit from 'express-rate-limit';
import bcrypt from 'bcryptjs';
import crypto from 'node:crypto';
import { prisma } from '../config/db.js';
import { signToken } from '../middleware/auth.js';
import { sendPasswordResetEmail } from '../lib/email.js';

const router = Router();

const forgotPasswordLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: { error: 'Too many reset requests; try again later' },
  standardHeaders: true,
  legacyHeaders: false,
});

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { error: 'Too many login attempts; try again later' },
  standardHeaders: true,
  legacyHeaders: false,
});

interface LoginBody {
  email?: string;
  password?: string;
}

interface ForgotPasswordBody {
  email?: string;
}

interface ResetPasswordBody {
  token?: string;
  password?: string;
}

interface VerifyEmailBody {
  token?: string;
}

/** POST /api/auth/login - Log in with email + password */
router.post('/login', loginLimiter, async (req, res: Response): Promise<void> => {
  const body = req.body as LoginBody;
  const email = typeof body.email === 'string' ? body.email.trim() : '';
  const password = typeof body.password === 'string' ? body.password : '';

  if (!email || !password) {
    res.status(400).json({ error: 'Email and password are required' });
    return;
  }

  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, email: true, passwordHash: true, onboardingComplete: true, emailVerifiedAt: true },
  });

  if (!user) {
    res.status(401).json({ error: 'Invalid email or password' });
    return;
  }

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    res.status(401).json({ error: 'Invalid email or password' });
    return;
  }

  const token = signToken({ sub: user.id, email: user.email });
  res.json({
    user: {
      id: user.id,
      email: user.email,
      onboarding_complete: user.onboardingComplete,
      email_verified_at: user.emailVerifiedAt?.toISOString() ?? null,
    },
    token,
  });
});

/** POST /api/auth/forgot-password - Request password reset (sends email with link) */
router.post('/forgot-password', forgotPasswordLimiter, async (req, res: Response): Promise<void> => {
  const body = req.body as ForgotPasswordBody;
  const email = typeof body.email === 'string' ? body.email.trim() : '';
  if (!email) {
    res.status(400).json({ error: 'Email is required' });
    return;
  }

  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, email: true },
  });

  if (!user) {
    res.json({ message: 'If an account exists with that email, you will receive a reset link.' });
    return;
  }

  const token = crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000);

  await prisma.user.update({
    where: { id: user.id },
    data: { passwordResetToken: token, passwordResetExpiresAt: expiresAt },
  });

  const baseUrl = (process.env.FRONTEND_URL ?? 'http://localhost:5173').replace(/\/$/, '');
  const resetLink = `${baseUrl}/reset-password?token=${encodeURIComponent(token)}`;

  try {
    await sendPasswordResetEmail(user.email, resetLink);
  } catch (err) {
    console.error('Failed to send password reset email:', err);
    res.status(500).json({ error: 'Failed to send reset email' });
    return;
  }

  res.json({ message: 'If an account exists with that email, you will receive a reset link.' });
});

/** POST /api/auth/reset-password - Set new password using token from email link */
router.post('/reset-password', async (req, res: Response): Promise<void> => {
  const body = req.body as ResetPasswordBody;
  const token = typeof body.token === 'string' ? body.token.trim() : '';
  const password = typeof body.password === 'string' ? body.password : '';

  if (!token || !password) {
    res.status(400).json({ error: 'Token and new password are required' });
    return;
  }

  if (password.length < 8) {
    res.status(400).json({ error: 'Password must be at least 8 characters' });
    return;
  }

  const user = await prisma.user.findFirst({
    where: {
      passwordResetToken: token,
      passwordResetExpiresAt: { gt: new Date() },
    },
    select: { id: true },
  });

  if (!user) {
    res.status(400).json({ error: 'Invalid or expired reset link. Request a new one.' });
    return;
  }

  const passwordHash = await bcrypt.hash(password, 10);
  await prisma.user.update({
    where: { id: user.id },
    data: {
      passwordHash,
      passwordResetToken: null,
      passwordResetExpiresAt: null,
    },
  });

  res.json({ message: 'Password has been reset. You can log in with your new password.' });
});

/** POST /api/auth/verify-email - Verify email using token from link */
router.post('/verify-email', async (req, res: Response): Promise<void> => {
  const body = req.body as VerifyEmailBody;
  const token = typeof body.token === 'string' ? body.token.trim() : '';
  if (!token) {
    res.status(400).json({ error: 'Verification token is required' });
    return;
  }
  const user = await prisma.user.findFirst({
    where: {
      emailVerificationToken: token,
      emailVerificationExpiresAt: { gt: new Date() },
    },
    select: { id: true },
  });
  if (!user) {
    res.status(400).json({ error: 'Invalid or expired verification link. Request a new one from settings.' });
    return;
  }
  await prisma.user.update({
    where: { id: user.id },
    data: {
      emailVerifiedAt: new Date(),
      emailVerificationToken: null,
      emailVerificationExpiresAt: null,
    },
  });
  res.json({ message: 'Email verified. You can now use all features.' });
});

export default router;
