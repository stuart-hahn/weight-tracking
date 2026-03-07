import type { Request, Response, NextFunction } from 'express';
import type { UserCreateInput, DailyEntryCreateInput } from '../types/index.js';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function isValidDate(s: string): boolean {
  const d = new Date(s);
  return !Number.isNaN(d.getTime()) && s === d.toISOString().slice(0, 10);
}

export function validateCreateUser(
  req: Request<object, unknown, UserCreateInput>,
  res: Response,
  next: NextFunction
): void {
  const body = req.body;
  if (!body || typeof body !== 'object') {
    res.status(400).json({ error: 'Request body must be a JSON object' });
    return;
  }
  const { email, password, age, sex, height_cm, current_weight_kg, target_body_fat_percent } = body;
  const errors: string[] = [];
  if (typeof email !== 'string' || !EMAIL_REGEX.test(email)) errors.push('Valid email required');
  if (typeof password !== 'string' || password.length < 8) errors.push('Password must be at least 8 characters');
  if (typeof age !== 'number' || age < 10 || age > 120) errors.push('Age must be between 10 and 120');
  if (sex !== 'male' && sex !== 'female') errors.push('Sex must be "male" or "female"');
  if (typeof height_cm !== 'number' || height_cm <= 0 || height_cm > 300) errors.push('Valid height_cm required');
  if (typeof current_weight_kg !== 'number' || current_weight_kg <= 0 || current_weight_kg > 500) errors.push('Valid current_weight_kg required');
  if (typeof target_body_fat_percent !== 'number' || target_body_fat_percent <= 0 || target_body_fat_percent >= 100) errors.push('target_body_fat_percent must be between 0 and 100');
  if (body.activity_level != null && !['sedentary', 'light', 'moderate', 'very_active'].includes(body.activity_level)) errors.push('Invalid activity_level');
  if (body.lean_mass_kg != null && (typeof body.lean_mass_kg !== 'number' || body.lean_mass_kg <= 0 || body.lean_mass_kg > 500)) errors.push('Invalid lean_mass_kg');
  if (errors.length > 0) {
    res.status(400).json({ error: errors.join('; ') });
    return;
  }
  next();
}

export function validateCreateEntry(
  req: Request<{ id: string }, unknown, DailyEntryCreateInput>,
  res: Response,
  next: NextFunction
): void {
  const body = req.body;
  if (!body || typeof body !== 'object') {
    res.status(400).json({ error: 'Request body must be a JSON object' });
    return;
  }
  const errors: string[] = [];
  if (typeof body.date !== 'string' || !isValidDate(body.date)) errors.push('Valid date (YYYY-MM-DD) required');
  if (typeof body.weight_kg !== 'number' || body.weight_kg <= 0 || body.weight_kg > 500) errors.push('Valid weight_kg required');
  if (body.calories != null && (typeof body.calories !== 'number' || body.calories < 0 || body.calories > 10000)) errors.push('calories must be 0–10000 or omitted');
  if (body.waist_cm != null && (typeof body.waist_cm !== 'number' || body.waist_cm <= 0 || body.waist_cm > 200)) errors.push('Invalid waist_cm');
  if (body.hip_cm != null && (typeof body.hip_cm !== 'number' || body.hip_cm <= 0 || body.hip_cm > 200)) errors.push('Invalid hip_cm');
  if (errors.length > 0) {
    res.status(400).json({ error: errors.join('; ') });
    return;
  }
  next();
}
