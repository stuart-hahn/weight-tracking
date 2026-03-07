import { Router, type Response } from 'express';
import bcrypt from 'bcryptjs';
import { prisma } from '../config/db.js';
import { signToken } from '../middleware/auth.js';

const router = Router();

interface LoginBody {
  email?: string;
  password?: string;
}

/** POST /api/auth/login - Log in with email + password */
router.post('/login', async (req, res: Response): Promise<void> => {
  const body = req.body as LoginBody;
  const email = typeof body.email === 'string' ? body.email.trim() : '';
  const password = typeof body.password === 'string' ? body.password : '';

  if (!email || !password) {
    res.status(400).json({ error: 'Email and password are required' });
    return;
  }

  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, email: true, passwordHash: true },
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
  res.json({ user: { id: user.id, email: user.email }, token });
});

export default router;
