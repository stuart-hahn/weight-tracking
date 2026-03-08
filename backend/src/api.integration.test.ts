/**
 * API integration tests. Use a separate test DB:
 *   DATABASE_URL=file:./data/integration_test.db npx prisma db push
 *   npm run test:integration
 * Or run once: npm run db:push:test && npm run test:integration
 */
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL ?? 'file:./data/integration_test.db';
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

  it('GET /api/users/:id/export returns profile, entries, optional_metrics', async () => {
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
