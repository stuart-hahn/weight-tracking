/**
 * API integration tests. Use a dedicated PostgreSQL database (default: body_fat_tracker_test).
 *
 * CI: `.github/workflows/ci.yml` sets POSTGRES_DB=body_fat_tracker_test on the service container.
 *
 * Local (Docker Compose db): create the database once, then `cd backend && npm run test:integration`
 *   docker compose exec -T db psql -U postgres -c "CREATE DATABASE body_fat_tracker_test;"
 * (If it already exists, Postgres returns an error—you can ignore it.)
 *
 * Local (Postgres on host): PGPASSWORD=postgres psql -h localhost -U postgres -c "CREATE DATABASE body_fat_tracker_test;"
 *
 * Override URL: DATABASE_URL=... npm run test:integration
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
import { FIXED_PROGRAM_NAME } from './services/defaultFixedProgram.js';

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

  it('GET /api/users/:id/export returns profile, entries, optional_metrics, workouts, workout_programs', async () => {
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
    expect(res.body).toHaveProperty('workout_programs');
    expect(Array.isArray(res.body.workout_programs)).toBe(true);
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

    const iso = new Date().toISOString();
    const patchMeta = await request(app)
      .patch(`/api/users/${userId}/workouts/${workoutId}/exercises/${lineId}/sets/${setId}`)
      .set('Authorization', `Bearer ${token}`)
      .set('Content-Type', 'application/json')
      .send({
        completed_at: iso,
        set_kind: 'working',
        actual_rest_seconds: 90,
      });
    expect(patchMeta.status).toBe(200);
    expect(patchMeta.body.completed_at).toBeTruthy();
    expect(patchMeta.body.set_kind).toBe('working');
    expect(patchMeta.body.actual_rest_seconds).toBe(90);

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

    const histAfter = await request(app)
      .get(`/api/users/${userId}/exercises/${exerciseId}/history?limit=5`)
      .set('Authorization', `Bearer ${token}`);
    expect(histAfter.status).toBe(200);
    expect(histAfter.body.rows.length).toBeGreaterThanOrEqual(1);
    expect(histAfter.body.rows[0].volume_kg).toBeGreaterThan(0);

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

  it('programs: create program, day, exercise line, template, start workout, batch insights', async () => {
    const ex = await request(app)
      .post(`/api/users/${userId}/exercises`)
      .set('Authorization', `Bearer ${token}`)
      .set('Content-Type', 'application/json')
      .send({ name: 'Program Test Lift', kind: 'weight_reps' });
    expect(ex.status).toBe(201);
    const exerciseId = ex.body.id as string;

    const pr = await request(app)
      .post(`/api/users/${userId}/programs`)
      .set('Authorization', `Bearer ${token}`)
      .set('Content-Type', 'application/json')
      .send({ name: 'Integration Mesocycle' });
    expect(pr.status).toBe(201);
    const programId = pr.body.id as string;

    const day = await request(app)
      .post(`/api/users/${userId}/programs/${programId}/days`)
      .set('Authorization', `Bearer ${token}`)
      .set('Content-Type', 'application/json')
      .send({ name: 'Day A' });
    expect(day.status).toBe(201);
    const dayId = day.body.id as string;

    const pde = await request(app)
      .post(`/api/users/${userId}/programs/${programId}/days/${dayId}/exercises`)
      .set('Authorization', `Bearer ${token}`)
      .set('Content-Type', 'application/json')
      .send({ exercise_id: exerciseId, progression_variant: 'general_double' });
    expect(pde.status).toBe(201);
    const pdeId = pde.body.id as string;

    const tpl = await request(app)
      .post(`/api/users/${userId}/programs/${programId}/days/${dayId}/exercises/${pdeId}/templates`)
      .set('Authorization', `Bearer ${token}`)
      .set('Content-Type', 'application/json')
      .send({ set_role: 'working', target_reps_min: 8, target_reps_max: 12 });
    expect(tpl.status).toBe(201);

    const wo = await request(app)
      .post(`/api/users/${userId}/workouts`)
      .set('Authorization', `Bearer ${token}`)
      .set('Content-Type', 'application/json')
      .send({ program_day_id: dayId });
    expect(wo.status).toBe(201);
    expect(wo.body.program_day_id).toBe(dayId);
    expect(wo.body.exercises.length).toBeGreaterThanOrEqual(1);
    expect(wo.body.exercises[0].sets[0].target_reps_max).toBe(12);

    const batch = await request(app)
      .post(`/api/users/${userId}/exercises/batch-insights`)
      .set('Authorization', `Bearer ${token}`)
      .set('Content-Type', 'application/json')
      .send({
        exercise_ids: [exerciseId],
        progression_variant_by_exercise_id: { [exerciseId]: 'general_double' },
      });
    expect(batch.status).toBe(200);
    expect(batch.body.insights[exerciseId].progression_variant).toBe('general_double');
  });

  it('default fixed program is seeded and Monday session instantiates with notes and sets', async () => {
    const list = await request(app)
      .get(`/api/users/${userId}/programs`)
      .set('Authorization', `Bearer ${token}`);
    expect(list.status).toBe(200);
    const fixed = list.body.find((p: { name: string }) => p.name === FIXED_PROGRAM_NAME);
    expect(fixed).toBeDefined();
    const det = await request(app)
      .get(`/api/users/${userId}/programs/${fixed!.id}`)
      .set('Authorization', `Bearer ${token}`);
    expect(det.status).toBe(200);
    expect(det.body.days.length).toBe(6);
    const monday = det.body.days.find((d: { order_index: number }) => d.order_index === 0);
    expect(monday).toBeDefined();
    expect(monday!.exercises.length).toBe(6);
    const incline = monday!.exercises.find((e: { exercise: { name: string } }) =>
      e.exercise.name.toLowerCase().includes('incline press')
    );
    expect(incline?.set_templates?.length).toBe(2);

    const wo = await request(app)
      .post(`/api/users/${userId}/workouts`)
      .set('Authorization', `Bearer ${token}`)
      .set('Content-Type', 'application/json')
      .send({ program_day_id: monday!.id });
    expect(wo.status).toBe(201);
    expect(wo.body.exercises.length).toBe(6);
    expect(wo.body.exercises[0].sets.length).toBe(2);
    expect(typeof wo.body.exercises[0].notes).toBe('string');
    expect((wo.body.exercises[0].notes as string).length).toBeGreaterThan(0);
  });

  it('GET exercises custom_only and POST duplicate from global', async () => {
    if (!userId || !token) {
      expect.fail('userId/token not set');
      return;
    }
    const unique = `GlobalDupSrc-${Date.now()}`;
    const globalEx = await prisma.exercise.create({
      data: { userId: null, name: unique, kind: 'weight_reps' },
    });

    const dup = await request(app)
      .post(`/api/users/${userId}/exercises/${globalEx.id}/duplicate`)
      .set('Authorization', `Bearer ${token}`)
      .set('Content-Type', 'application/json')
      .send({});
    expect(dup.status).toBe(201);
    expect(dup.body.is_custom).toBe(true);
    expect(dup.body.user_id).toBe(userId);
    expect(dup.body.kind).toBe('weight_reps');

    const customList = await request(app)
      .get(`/api/users/${userId}/exercises?custom_only=true`)
      .set('Authorization', `Bearer ${token}`);
    expect(customList.status).toBe(200);
    expect(Array.isArray(customList.body)).toBe(true);
    expect(customList.body.every((e: { is_custom: boolean }) => e.is_custom)).toBe(true);
    const dupIds = customList.body.map((e: { id: string }) => e.id);
    expect(dupIds).toContain(dup.body.id);

    await prisma.exercise.delete({ where: { id: dup.body.id } });
    await prisma.exercise.delete({ where: { id: globalEx.id } });
  });

  it('exercise substitutions: list, add, delete', async () => {
    if (!userId || !token) {
      expect.fail('userId/token not set');
      return;
    }
    const primary = await request(app)
      .post(`/api/users/${userId}/exercises`)
      .set('Authorization', `Bearer ${token}`)
      .set('Content-Type', 'application/json')
      .send({ name: `SubPrimary-${Date.now()}`, kind: 'weight_reps' });
    expect(primary.status).toBe(201);
    const sub = await request(app)
      .post(`/api/users/${userId}/exercises`)
      .set('Authorization', `Bearer ${token}`)
      .set('Content-Type', 'application/json')
      .send({ name: `SubAlt-${Date.now()}`, kind: 'weight_reps' });
    expect(sub.status).toBe(201);

    const empty = await request(app)
      .get(`/api/users/${userId}/exercises/${primary.body.id}/substitutions`)
      .set('Authorization', `Bearer ${token}`);
    expect(empty.status).toBe(200);
    expect(empty.body).toEqual([]);

    const add = await request(app)
      .post(`/api/users/${userId}/exercises/${primary.body.id}/substitutions`)
      .set('Authorization', `Bearer ${token}`)
      .set('Content-Type', 'application/json')
      .send({ substitute_exercise_id: sub.body.id });
    expect(add.status).toBe(201);
    expect(add.body.substitute_exercise_id).toBe(sub.body.id);

    const list = await request(app)
      .get(`/api/users/${userId}/exercises/${primary.body.id}/substitutions`)
      .set('Authorization', `Bearer ${token}`);
    expect(list.status).toBe(200);
    expect(list.body.length).toBe(1);

    const del = await request(app)
      .delete(`/api/users/${userId}/exercises/${primary.body.id}/substitutions/${sub.body.id}`)
      .set('Authorization', `Bearer ${token}`);
    expect(del.status).toBe(204);

    await prisma.exercise.delete({ where: { id: primary.body.id } });
    await prisma.exercise.delete({ where: { id: sub.body.id } });
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
