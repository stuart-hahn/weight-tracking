/**
 * API integration tests. Use a test DB (PostgreSQL). In CI, DATABASE_URL is set by the workflow.
 * Locally: set DATABASE_URL or run a Postgres (e.g. Docker) and use the default below.
 */
process.env.DATABASE_URL =
  process.env.DATABASE_URL ??
  process.env.TEST_DATABASE_URL ??
  'postgresql://postgres:postgres@localhost:5432/body_fat_tracker_test';
process.env.JWT_SECRET = process.env.JWT_SECRET ?? 'test-secret-for-integration-tests';

import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { app } from './app.js';
import { prisma } from './config/db.js';

describe('API integration', () => {
  let userId: string;
  let token: string;
  const email = `test-${Date.now()}@example.com`;
  const password = 'TestPassword123';

  beforeAll(async () => {
    await prisma.$connect();
  });

  it('POST /api/users creates user and returns token', async () => {
    const res = await request(app)
      .post('/api/users')
      .set('Content-Type', 'application/json')
      .send({
        email,
        password,
        age: 30,
        sex: 'male',
        height_cm: 175,
        current_weight_kg: 80,
        target_body_fat_percent: 18,
      });
    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('user');
    expect(res.body.user).toHaveProperty('id');
    expect(res.body.user.email).toBe(email);
    expect(res.body).toHaveProperty('token');
    userId = res.body.user.id;
    token = res.body.token;
  });

  it('POST /api/auth/login returns token for valid credentials', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .set('Content-Type', 'application/json')
      .send({ email, password });
    expect(res.status).toBe(200);
    expect(res.body.user.id).toBe(userId);
    expect(res.body).toHaveProperty('token');
  });

  it('GET /api/users/:id returns profile with valid token', async () => {
    const res = await request(app)
      .get(`/api/users/${userId}`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.id).toBe(userId);
    expect(res.body.email).toBe(email);
    expect(res.body.age).toBe(30);
    expect(res.body.height_cm).toBe(175);
    expect(res.body.current_weight_kg).toBe(80);
    expect(res.body.target_body_fat_percent).toBe(18);
  });

  it('GET /api/users/:id returns 403 without token', async () => {
    const res = await request(app).get(`/api/users/${userId}`);
    expect(res.status).toBe(401);
  });

  it('PATCH /api/users/:id updates profile', async () => {
    const res = await request(app)
      .patch(`/api/users/${userId}`)
      .set('Authorization', `Bearer ${token}`)
      .set('Content-Type', 'application/json')
      .send({ current_weight_kg: 79 });
    expect(res.status).toBe(200);
    expect(res.body.current_weight_kg).toBe(79);
  });

  it('POST /api/users/:id/entries creates entry', async () => {
    const today = new Date().toISOString().slice(0, 10);
    const res = await request(app)
      .post(`/api/users/${userId}/entries`)
      .set('Authorization', `Bearer ${token}`)
      .set('Content-Type', 'application/json')
      .send({ date: today, weight_kg: 79, calories: 2000 });
    expect(res.status).toBe(201);
    expect(res.body.date).toBe(today);
    expect(res.body.weight_kg).toBe(79);
    expect(res.body.calories).toBe(2000);
  });

  it('GET /api/users/:id/entries returns entries', async () => {
    const res = await request(app)
      .get(`/api/users/${userId}/entries`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThanOrEqual(1);
  });

  it('GET /api/users/:id/progress returns progress with goal and trend', async () => {
    const res = await request(app)
      .get(`/api/users/${userId}/progress`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('user_id', userId);
    expect(res.body).toHaveProperty('current_weight_kg');
    expect(res.body).toHaveProperty('goal_weight_kg');
    expect(res.body).toHaveProperty('entries_count');
    expect(res.body).toHaveProperty('weekly_summary');
  });

  it('POST /api/users/:id/optional-metrics upserts body fat', async () => {
    const today = new Date().toISOString().slice(0, 10);
    const res = await request(app)
      .post(`/api/users/${userId}/optional-metrics`)
      .set('Authorization', `Bearer ${token}`)
      .set('Content-Type', 'application/json')
      .send({ date: today, body_fat_percent: 22 });
    expect(res.status).toBe(201);
    expect(res.body.date).toBe(today);
    expect(res.body.body_fat_percent).toBe(22);
  });

  it('GET /api/users/:id/export returns profile, entries, optional_metrics, workouts', async () => {
    const res = await request(app)
      .get(`/api/users/${userId}/export`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('exported_at');
    expect(res.body).toHaveProperty('profile');
    expect(res.body.profile.id).toBe(userId);
    expect(res.body).toHaveProperty('entries');
    expect(Array.isArray(res.body.entries)).toBe(true);
    expect(res.body).toHaveProperty('optional_metrics');
    expect(Array.isArray(res.body.optional_metrics)).toBe(true);
    expect(res.body).toHaveProperty('workouts');
    expect(Array.isArray(res.body.workouts)).toBe(true);
  });

  it('workouts: create exercise, workout, line, set, complete, clone', async () => {
    const ex = await request(app)
      .post(`/api/users/${userId}/exercises`)
      .set('Authorization', `Bearer ${token}`)
      .set('Content-Type', 'application/json')
      .send({ name: 'Integration Press', kind: 'weight_reps' });
    expect(ex.status).toBe(201);
    const exerciseId = ex.body.id as string;

    const wo = await request(app)
      .post(`/api/users/${userId}/workouts`)
      .set('Authorization', `Bearer ${token}`)
      .set('Content-Type', 'application/json')
      .send({ name: 'Test day' });
    expect(wo.status).toBe(201);
    const workoutId = wo.body.id as string;

    const line = await request(app)
      .post(`/api/users/${userId}/workouts/${workoutId}/exercises`)
      .set('Authorization', `Bearer ${token}`)
      .set('Content-Type', 'application/json')
      .send({ exercise_id: exerciseId });
    expect(line.status).toBe(201);
    const lineId = line.body.id as string;
    const setId = line.body.sets[0].id as string;

    const patchSet = await request(app)
      .patch(`/api/users/${userId}/workouts/${workoutId}/exercises/${lineId}/sets/${setId}`)
      .set('Authorization', `Bearer ${token}`)
      .set('Content-Type', 'application/json')
      .send({ weight_kg: 50, reps: 10 });
    expect(patchSet.status).toBe(200);
    expect(patchSet.body.weight_kg).toBe(50);
    expect(patchSet.body.reps).toBe(10);

    const done = await request(app)
      .patch(`/api/users/${userId}/workouts/${workoutId}`)
      .set('Authorization', `Bearer ${token}`)
      .set('Content-Type', 'application/json')
      .send({ completed_at: new Date().toISOString() });
    expect(done.status).toBe(200);
    expect(done.body.completed_at).not.toBeNull();

    const ins = await request(app)
      .get(`/api/users/${userId}/exercises/${exerciseId}/insights`)
      .set('Authorization', `Bearer ${token}`);
    expect(ins.status).toBe(200);
    expect(ins.body.last_performance).not.toBeNull();
    expect(ins.body.last_performance.sets.length).toBeGreaterThanOrEqual(1);

    const clone = await request(app)
      .post(`/api/users/${userId}/workouts`)
      .set('Authorization', `Bearer ${token}`)
      .set('Content-Type', 'application/json')
      .send({ clone_from_workout_id: workoutId });
    expect(clone.status).toBe(201);
    expect(clone.body.completed_at).toBeNull();
    expect(clone.body.exercises.length).toBeGreaterThanOrEqual(1);
    expect(clone.body.exercises[0].sets[0].weight_kg).toBe(50);
  });

  it('POST /api/auth/verify-email verifies with valid token', async () => {
    if (!userId) {
      expect.fail('userId not set (previous test may have failed)');
      return;
    }
    const verificationToken = await prisma.user
      .findUnique({ where: { id: userId }, select: { emailVerificationToken: true } })
      .then((u) => u?.emailVerificationToken);
    if (!verificationToken) {
      expect.fail('No verification token found (user was created with one)');
      return;
    }
    const res = await request(app)
      .post('/api/auth/verify-email')
      .set('Content-Type', 'application/json')
      .send({ token: verificationToken });
    expect(res.status).toBe(200);
    expect(res.body.message).toContain('verified');
  });

  it('GET /health returns ok', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
  });
});
