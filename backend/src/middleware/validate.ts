import type { Request, Response, NextFunction } from 'express';
import type {
  UserCreateInput,
  UserUpdateInput,
  DailyEntryCreateInput,
  DailyEntryUpdateInput,
  OptionalMetricCreateInput,
  ExerciseCreateInput,
  ExerciseUpdateInput,
  WorkoutCreateInput,
  WorkoutUpdateInput,
  WorkoutExerciseCreateInput,
  WorkoutExerciseUpdateInput,
  WorkoutSetCreateInput,
  WorkoutSetUpdateInput,
  ExerciseBatchInsightsInput,
} from '../types/index.js';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function isValidDate(s: string): boolean {
  const d = new Date(s);
  return !Number.isNaN(d.getTime()) && s === d.toISOString().slice(0, 10);
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isUuid(s: string): boolean {
  return typeof s === 'string' && UUID_RE.test(s);
}

const EXERCISE_KINDS = ['weight_reps', 'bodyweight_reps', 'time'] as const;

function validWeightKg(v: unknown): boolean {
  return typeof v === 'number' && v > 0 && v <= 500;
}

function validOptionalWeightKg(v: unknown): boolean {
  if (v === undefined || v === null) return true;
  return typeof v === 'number' && v > 0 && v <= 500;
}

function validReps(v: unknown): boolean {
  if (v === undefined || v === null) return true;
  return typeof v === 'number' && Number.isInteger(v) && v >= 0 && v <= 1000;
}

function validDurationSec(v: unknown): boolean {
  if (v === undefined || v === null) return true;
  return typeof v === 'number' && Number.isInteger(v) && v >= 0 && v <= 86400;
}

function validRestSec(v: unknown): boolean {
  if (v === undefined || v === null) return true;
  return typeof v === 'number' && Number.isInteger(v) && v >= 0 && v <= 3600;
}

function validOptionalRir(v: unknown): boolean {
  if (v === undefined || v === null) return true;
  return typeof v === 'number' && Number.isInteger(v) && v >= 0 && v <= 30;
}

const SET_ROLES = ['top', 'backoff', 'working'] as const;

function validOptionalSetRole(v: unknown): boolean {
  if (v === undefined || v === null) return true;
  return typeof v === 'string' && SET_ROLES.includes(v as (typeof SET_ROLES)[number]);
}

function validOptionalTargetInt(v: unknown): boolean {
  if (v === undefined || v === null) return true;
  return typeof v === 'number' && Number.isInteger(v) && v >= 0 && v <= 1000;
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
  if (body.units !== undefined && body.units !== null && body.units !== 'metric' && body.units !== 'imperial') errors.push('units must be "metric" or "imperial"');
  if (errors.length > 0) {
    res.status(400).json({ error: errors.join('; ') });
    return;
  }
  next();
}

export function validateUpdateUser(
  req: Request<{ id: string }, unknown, UserUpdateInput>,
  res: Response,
  next: NextFunction
): void {
  const body = req.body;
  if (!body || typeof body !== 'object') {
    res.status(400).json({ error: 'Request body must be a JSON object' });
    return;
  }
  const errors: string[] = [];
  if (body.age !== undefined) {
    if (typeof body.age !== 'number' || body.age < 10 || body.age > 120) errors.push('Age must be between 10 and 120');
  }
  if (body.sex !== undefined && body.sex !== 'male' && body.sex !== 'female') errors.push('Sex must be "male" or "female"');
  if (body.height_cm !== undefined && (typeof body.height_cm !== 'number' || body.height_cm <= 0 || body.height_cm > 300)) errors.push('Valid height_cm required');
  if (body.current_weight_kg !== undefined && (typeof body.current_weight_kg !== 'number' || body.current_weight_kg <= 0 || body.current_weight_kg > 500)) errors.push('Valid current_weight_kg required');
  if (body.target_body_fat_percent !== undefined && (typeof body.target_body_fat_percent !== 'number' || body.target_body_fat_percent <= 0 || body.target_body_fat_percent >= 100)) errors.push('target_body_fat_percent must be between 0 and 100');
  if (body.activity_level !== undefined && body.activity_level != null && !['sedentary', 'light', 'moderate', 'very_active'].includes(body.activity_level)) errors.push('Invalid activity_level');
  if (body.lean_mass_kg !== undefined && body.lean_mass_kg != null && (typeof body.lean_mass_kg !== 'number' || body.lean_mass_kg <= 0 || body.lean_mass_kg > 500)) errors.push('Invalid lean_mass_kg');
  if (body.units !== undefined && body.units !== null && body.units !== 'metric' && body.units !== 'imperial') errors.push('units must be "metric" or "imperial"');
  if (body.onboarding_complete !== undefined && typeof body.onboarding_complete !== 'boolean') errors.push('onboarding_complete must be a boolean');
  if (body.plan !== undefined && body.plan !== null && body.plan !== 'free' && body.plan !== 'premium') errors.push('plan must be "free" or "premium"');
  if (body.training_block_started_at !== undefined && body.training_block_started_at !== null) {
    if (typeof body.training_block_started_at !== 'string' || Number.isNaN(Date.parse(body.training_block_started_at))) {
      errors.push('training_block_started_at must be a valid ISO date or datetime, or null');
    }
  }
  if (
    body.last_calibration_week_index !== undefined &&
    body.last_calibration_week_index !== null &&
    (!Number.isInteger(body.last_calibration_week_index) || body.last_calibration_week_index < 0 || body.last_calibration_week_index > 10000)
  ) {
    errors.push('last_calibration_week_index must be a non-negative integer or null');
  }
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

export function validateUpdateEntry(
  req: Request<{ id: string; entryId: string }, unknown, DailyEntryUpdateInput>,
  res: Response,
  next: NextFunction
): void {
  const body = req.body;
  if (!body || typeof body !== 'object') {
    res.status(400).json({ error: 'Request body must be a JSON object' });
    return;
  }
  const errors: string[] = [];
  if (body.weight_kg !== undefined && (typeof body.weight_kg !== 'number' || body.weight_kg <= 0 || body.weight_kg > 500)) errors.push('Valid weight_kg required');
  if (body.calories != null && (typeof body.calories !== 'number' || body.calories < 0 || body.calories > 10000)) errors.push('calories must be 0–10000 or null');
  if (body.waist_cm != null && (typeof body.waist_cm !== 'number' || body.waist_cm <= 0 || body.waist_cm > 200)) errors.push('Invalid waist_cm');
  if (body.hip_cm != null && (typeof body.hip_cm !== 'number' || body.hip_cm <= 0 || body.hip_cm > 200)) errors.push('Invalid hip_cm');
  if (errors.length > 0) {
    res.status(400).json({ error: errors.join('; ') });
    return;
  }
  next();
}

export function validateOptionalMetric(
  req: Request<{ id: string }, unknown, OptionalMetricCreateInput>,
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
  if (typeof body.body_fat_percent !== 'number' || body.body_fat_percent < 0 || body.body_fat_percent > 100) errors.push('body_fat_percent must be a number between 0 and 100');
  if (errors.length > 0) {
    res.status(400).json({ error: errors.join('; ') });
    return;
  }
  next();
}

export function validateCreateExercise(
  req: Request<{ id: string }, unknown, ExerciseCreateInput>,
  res: Response,
  next: NextFunction
): void {
  const body = req.body;
  if (!body || typeof body !== 'object') {
    res.status(400).json({ error: 'Request body must be a JSON object' });
    return;
  }
  const errors: string[] = [];
  if (typeof body.name !== 'string' || body.name.trim().length < 1 || body.name.length > 120) {
    errors.push('name must be 1–120 characters');
  }
  if (!EXERCISE_KINDS.includes(body.kind as (typeof EXERCISE_KINDS)[number])) {
    errors.push(`kind must be one of: ${EXERCISE_KINDS.join(', ')}`);
  }
  if (errors.length > 0) {
    res.status(400).json({ error: errors.join('; ') });
    return;
  }
  next();
}

export function validateUpdateExercise(
  req: Request<{ id: string; exerciseId: string }, unknown, ExerciseUpdateInput>,
  res: Response,
  next: NextFunction
): void {
  const body = req.body;
  if (!body || typeof body !== 'object') {
    res.status(400).json({ error: 'Request body must be a JSON object' });
    return;
  }
  const errors: string[] = [];
  if (body.name !== undefined && (typeof body.name !== 'string' || body.name.trim().length < 1 || body.name.length > 120)) {
    errors.push('name must be 1–120 characters');
  }
  if (body.kind !== undefined && !EXERCISE_KINDS.includes(body.kind as (typeof EXERCISE_KINDS)[number])) {
    errors.push(`kind must be one of: ${EXERCISE_KINDS.join(', ')}`);
  }
  if (body.name === undefined && body.kind === undefined) {
    errors.push('At least one of name, kind required');
  }
  if (errors.length > 0) {
    res.status(400).json({ error: errors.join('; ') });
    return;
  }
  next();
}

export function validateCreateWorkout(
  req: Request<{ id: string }, unknown, WorkoutCreateInput>,
  res: Response,
  next: NextFunction
): void {
  const body = req.body;
  if (!body || typeof body !== 'object') {
    res.status(400).json({ error: 'Request body must be a JSON object' });
    return;
  }
  const errors: string[] = [];
  if (body.name != null && body.name !== undefined && (typeof body.name !== 'string' || body.name.length > 200)) {
    errors.push('name must be at most 200 characters or null');
  }
  if (body.notes != null && body.notes !== undefined && (typeof body.notes !== 'string' || body.notes.length > 8000)) {
    errors.push('notes too long');
  }
  if (body.clone_from_workout_id != null && body.clone_from_workout_id !== undefined) {
    if (typeof body.clone_from_workout_id !== 'string' || !isUuid(body.clone_from_workout_id)) {
      errors.push('clone_from_workout_id must be a valid UUID');
    }
  }
  if (body.program_day_id != null && body.program_day_id !== undefined) {
    if (typeof body.program_day_id !== 'string' || !isUuid(body.program_day_id)) {
      errors.push('program_day_id must be a valid UUID');
    }
  }
  const hasClone = body.clone_from_workout_id != null && body.clone_from_workout_id !== undefined;
  const hasProgram = body.program_day_id != null && body.program_day_id !== undefined;
  if (hasClone && hasProgram) {
    errors.push('Use only one of clone_from_workout_id or program_day_id');
  }
  if (errors.length > 0) {
    res.status(400).json({ error: errors.join('; ') });
    return;
  }
  next();
}

export function validateUpdateWorkout(
  req: Request<{ id: string; workoutId: string }, unknown, WorkoutUpdateInput>,
  res: Response,
  next: NextFunction
): void {
  const body = req.body;
  if (!body || typeof body !== 'object') {
    res.status(400).json({ error: 'Request body must be a JSON object' });
    return;
  }
  const errors: string[] = [];
  if (body.name !== undefined && body.name !== null && (typeof body.name !== 'string' || body.name.length > 200)) {
    errors.push('Invalid name');
  }
  if (body.notes !== undefined && body.notes !== null && (typeof body.notes !== 'string' || body.notes.length > 8000)) {
    errors.push('notes too long');
  }
  if (body.completed_at !== undefined && body.completed_at !== null) {
    if (typeof body.completed_at !== 'string' || Number.isNaN(Date.parse(body.completed_at))) {
      errors.push('completed_at must be a valid ISO datetime');
    }
  }
  if (
    body.name === undefined &&
    body.notes === undefined &&
    body.completed_at === undefined
  ) {
    errors.push('At least one of name, notes, completed_at required');
  }
  if (errors.length > 0) {
    res.status(400).json({ error: errors.join('; ') });
    return;
  }
  next();
}

export function validateCreateWorkoutExercise(
  req: Request<{ id: string; workoutId: string }, unknown, WorkoutExerciseCreateInput>,
  res: Response,
  next: NextFunction
): void {
  const body = req.body;
  if (!body || typeof body !== 'object') {
    res.status(400).json({ error: 'Request body must be a JSON object' });
    return;
  }
  const errors: string[] = [];
  if (typeof body.exercise_id !== 'string' || !isUuid(body.exercise_id)) {
    errors.push('exercise_id must be a valid UUID');
  }
  if (body.notes != null && body.notes !== undefined && (typeof body.notes !== 'string' || body.notes.length > 2000)) {
    errors.push('notes too long');
  }
  if (body.default_rest_seconds != null && body.default_rest_seconds !== undefined && !validRestSec(body.default_rest_seconds)) {
    errors.push('default_rest_seconds must be 0–3600 or null');
  }
  if (body.sets !== undefined) {
    if (!Array.isArray(body.sets)) {
      errors.push('sets must be an array');
    } else if (body.sets.length > 50) {
      errors.push('At most 50 sets');
    } else {
      for (const s of body.sets) {
        if (!s || typeof s !== 'object') {
          errors.push('Each set must be an object');
          break;
        }
        const set = s as WorkoutSetCreateInput;
        if (!validOptionalWeightKg(set.weight_kg)) errors.push('Invalid weight_kg in sets');
        if (!validReps(set.reps)) errors.push('Invalid reps in sets');
        if (!validDurationSec(set.duration_sec)) errors.push('Invalid duration_sec in sets');
        if (set.notes != null && set.notes !== undefined && (typeof set.notes !== 'string' || set.notes.length > 500)) {
          errors.push('Invalid set notes');
        }
        if (!validRestSec(set.rest_seconds_after)) errors.push('Invalid rest_seconds_after in sets');
        if (!validOptionalRir(set.rir)) errors.push('Invalid rir in sets');
        if (!validOptionalSetRole(set.set_role)) errors.push('Invalid set_role in sets');
        if (!validOptionalTargetInt(set.target_reps_min)) errors.push('Invalid target_reps_min in sets');
        if (!validOptionalTargetInt(set.target_reps_max)) errors.push('Invalid target_reps_max in sets');
        if (!validOptionalRir(set.target_rir_min)) errors.push('Invalid target_rir_min in sets');
        if (!validOptionalRir(set.target_rir_max)) errors.push('Invalid target_rir_max in sets');
        if (set.calibration_to_failure !== undefined && typeof set.calibration_to_failure !== 'boolean') {
          errors.push('calibration_to_failure must be boolean');
        }
      }
    }
  }
  if (errors.length > 0) {
    res.status(400).json({ error: errors.join('; ') });
    return;
  }
  next();
}

export function validateUpdateWorkoutExercise(
  req: Request<{ id: string; workoutId: string; lineId: string }, unknown, WorkoutExerciseUpdateInput>,
  res: Response,
  next: NextFunction
): void {
  const body = req.body;
  if (!body || typeof body !== 'object') {
    res.status(400).json({ error: 'Request body must be a JSON object' });
    return;
  }
  const errors: string[] = [];
  if (body.notes !== undefined && body.notes !== null && (typeof body.notes !== 'string' || body.notes.length > 2000)) {
    errors.push('Invalid notes');
  }
  if (body.default_rest_seconds !== undefined && body.default_rest_seconds !== null && !validRestSec(body.default_rest_seconds)) {
    errors.push('default_rest_seconds must be 0–3600 or null');
  }
  if (body.order_index !== undefined && (!Number.isInteger(body.order_index) || body.order_index < 0 || body.order_index > 500)) {
    errors.push('order_index must be an integer 0–500');
  }
  if (body.notes === undefined && body.default_rest_seconds === undefined && body.order_index === undefined) {
    errors.push('At least one of notes, default_rest_seconds, order_index required');
  }
  if (errors.length > 0) {
    res.status(400).json({ error: errors.join('; ') });
    return;
  }
  next();
}

export function validateCreateWorkoutSet(
  req: Request<{ id: string; workoutId: string; lineId: string }, unknown, WorkoutSetCreateInput>,
  res: Response,
  next: NextFunction
): void {
  const body = req.body;
  if (!body || typeof body !== 'object') {
    res.status(400).json({ error: 'Request body must be a JSON object' });
    return;
  }
  const errors: string[] = [];
  if (!validOptionalWeightKg(body.weight_kg)) errors.push('Invalid weight_kg');
  if (!validReps(body.reps)) errors.push('Invalid reps');
  if (!validDurationSec(body.duration_sec)) errors.push('Invalid duration_sec');
  if (body.notes != null && body.notes !== undefined && (typeof body.notes !== 'string' || body.notes.length > 500)) {
    errors.push('Invalid notes');
  }
  if (!validRestSec(body.rest_seconds_after)) errors.push('Invalid rest_seconds_after');
  if (!validOptionalRir(body.rir)) errors.push('Invalid rir');
  if (!validOptionalSetRole(body.set_role)) errors.push('Invalid set_role');
  if (!validOptionalTargetInt(body.target_reps_min)) errors.push('Invalid target_reps_min');
  if (!validOptionalTargetInt(body.target_reps_max)) errors.push('Invalid target_reps_max');
  if (!validOptionalRir(body.target_rir_min)) errors.push('Invalid target_rir_min');
  if (!validOptionalRir(body.target_rir_max)) errors.push('Invalid target_rir_max');
  if (body.calibration_to_failure !== undefined && typeof body.calibration_to_failure !== 'boolean') {
    errors.push('calibration_to_failure must be boolean');
  }
  if (errors.length > 0) {
    res.status(400).json({ error: errors.join('; ') });
    return;
  }
  next();
}

export function validateUpdateWorkoutSet(
  req: Request<{ id: string; workoutId: string; lineId: string; setId: string }, unknown, WorkoutSetUpdateInput>,
  res: Response,
  next: NextFunction
): void {
  const body = req.body;
  if (!body || typeof body !== 'object') {
    res.status(400).json({ error: 'Request body must be a JSON object' });
    return;
  }
  const errors: string[] = [];
  if (body.weight_kg !== undefined) {
    if (body.weight_kg !== null && !validWeightKg(body.weight_kg)) {
      errors.push('weight_kg must be > 0 and ≤ 500, or null');
    }
  }
  if (body.reps !== undefined && body.reps !== null && (!Number.isInteger(body.reps) || body.reps < 0 || body.reps > 1000)) {
    errors.push('Invalid reps');
  }
  if (body.duration_sec !== undefined && body.duration_sec !== null && (!Number.isInteger(body.duration_sec) || body.duration_sec < 0 || body.duration_sec > 86400)) {
    errors.push('Invalid duration_sec');
  }
  if (body.notes !== undefined && body.notes !== null && (typeof body.notes !== 'string' || body.notes.length > 500)) {
    errors.push('Invalid notes');
  }
  if (body.rest_seconds_after !== undefined && body.rest_seconds_after !== null && !validRestSec(body.rest_seconds_after)) {
    errors.push('Invalid rest_seconds_after');
  }
  if (body.rir !== undefined && body.rir !== null && !validOptionalRir(body.rir)) {
    errors.push('Invalid rir');
  }
  if (body.set_role !== undefined && body.set_role !== null && !validOptionalSetRole(body.set_role)) {
    errors.push('Invalid set_role');
  }
  if (body.target_reps_min !== undefined && body.target_reps_min !== null && !validOptionalTargetInt(body.target_reps_min)) {
    errors.push('Invalid target_reps_min');
  }
  if (body.target_reps_max !== undefined && body.target_reps_max !== null && !validOptionalTargetInt(body.target_reps_max)) {
    errors.push('Invalid target_reps_max');
  }
  if (body.target_rir_min !== undefined && body.target_rir_min !== null && !validOptionalRir(body.target_rir_min)) {
    errors.push('Invalid target_rir_min');
  }
  if (body.target_rir_max !== undefined && body.target_rir_max !== null && !validOptionalRir(body.target_rir_max)) {
    errors.push('Invalid target_rir_max');
  }
  if (body.calibration_to_failure !== undefined && typeof body.calibration_to_failure !== 'boolean') {
    errors.push('calibration_to_failure must be boolean');
  }
  if (
    body.weight_kg === undefined &&
    body.reps === undefined &&
    body.duration_sec === undefined &&
    body.notes === undefined &&
    body.rest_seconds_after === undefined &&
    body.rir === undefined &&
    body.set_role === undefined &&
    body.target_reps_min === undefined &&
    body.target_reps_max === undefined &&
    body.target_rir_min === undefined &&
    body.target_rir_max === undefined &&
    body.calibration_to_failure === undefined
  ) {
    errors.push('At least one field to update required');
  }
  if (errors.length > 0) {
    res.status(400).json({ error: errors.join('; ') });
    return;
  }
  next();
}

const PROGRESSION_VARIANTS = new Set([
  'general_double',
  'primary_smith_incline',
  'primary_rdl',
  'primary_lat_pulldown_upper_b',
  'primary_squat_or_hack',
  'isolation_calibration_candidate',
  'custom',
]);

export function validateBatchExerciseInsights(
  req: Request<{ id: string }, unknown, ExerciseBatchInsightsInput>,
  res: Response,
  next: NextFunction
): void {
  const body = req.body;
  if (!body || typeof body !== 'object') {
    res.status(400).json({ error: 'Request body must be a JSON object' });
    return;
  }
  const errors: string[] = [];
  if (!Array.isArray(body.exercise_ids) || body.exercise_ids.length === 0) {
    errors.push('exercise_ids must be a non-empty array');
  } else if (body.exercise_ids.length > 50) {
    errors.push('At most 50 exercise_ids');
  } else {
    for (const id of body.exercise_ids) {
      if (typeof id !== 'string' || !isUuid(id)) {
        errors.push('Each exercise_id must be a UUID');
        break;
      }
    }
  }
  if (body.progression_variant_by_exercise_id !== undefined && body.progression_variant_by_exercise_id !== null) {
    if (typeof body.progression_variant_by_exercise_id !== 'object' || Array.isArray(body.progression_variant_by_exercise_id)) {
      errors.push('progression_variant_by_exercise_id must be an object');
    } else {
      for (const [k, v] of Object.entries(body.progression_variant_by_exercise_id)) {
        if (!isUuid(k) || typeof v !== 'string' || !PROGRESSION_VARIANTS.has(v)) {
          errors.push('Invalid progression_variant_by_exercise_id entry');
          break;
        }
      }
    }
  }
  if (errors.length > 0) {
    res.status(400).json({ error: errors.join('; ') });
    return;
  }
  next();
}
