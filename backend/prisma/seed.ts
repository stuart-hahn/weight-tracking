/**
 * Seed script: creates a test user with one month of realistic daily entries.
 * For dev/demo only. Run: npx prisma db seed (from backend directory).
 * Requires DATABASE_URL (PostgreSQL).
 */
import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client.js';
import { ensureDefaultFixedProgram } from '../src/services/defaultFixedProgram.js';

const TEST_EMAIL = 'test@example.com';
const TEST_PASSWORD = 'TestPassword123';

const connectionString = process.env.DATABASE_URL ?? '';

function describeDatabaseTarget(url: string): string {
  if (!url.trim()) return '(DATABASE_URL is empty — seed will fail)';
  try {
    const m = url.match(/postgresql:\/\/(?:[^@/]+@)?([^/]+)\/([^?]+)/);
    if (m) return `${m[1]}/${m[2]}`;
  } catch {
    /* ignore */
  }
  return '(could not parse DATABASE_URL)';
}

function printLoginHint(): void {
  console.log('');
  console.log('---');
  console.log('Test login:', TEST_EMAIL);
  console.log('Password:   ', TEST_PASSWORD);
  console.log('Database:  ', describeDatabaseTarget(connectionString));
  console.log('Use the same DATABASE_URL for `npm run dev` as for migrate/seed.');
  console.log('Tip: after `npm run db:fresh:dev`, run `npm run dev:devdb` OR set DATABASE_URL in .env to that URL.');
  console.log('---');
  console.log('');
}
const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

/** Seeded RNG for reproducible weight variance (minimal drift) */
function seeded(seed: number): () => number {
  return () => {
    seed = (seed * 9301 + 49297) % 233280;
    return seed / 233280;
  };
}

async function main(): Promise<void> {
  const passwordHash = await bcrypt.hash(TEST_PASSWORD, 10);

  let user = await prisma.user.findUnique({ where: { email: TEST_EMAIL } });
  if (!user) {
    user = await prisma.user.create({
      data: {
        email: TEST_EMAIL,
        passwordHash,
        age: 35,
        sex: 'male',
        heightCm: 178,
        currentWeightKg: 82,
        targetBodyFatPercent: 15,
        activityLevel: 'moderate',
        leanMassKg: null,
        units: 'metric',
      },
    });
    console.log('Created test user:', user.email);
  } else {
    console.log('Test user already exists:', user.email);
  }

  const userId = user.id;
  await ensureDefaultFixedProgram(userId);
  console.log('Ensured default fixed workout program for test user.');
  const entriesExisting = await prisma.dailyEntry.count({ where: { userId } });
  if (entriesExisting >= 30) {
    console.log('Test user already has', entriesExisting, 'entries; skipping entry seed.');
    printLoginHint();
    return;
  }

  const days = 35;
  const startKg = 82;
  const endKg = 79;
  const rng = seeded(12345);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  for (let i = 0; i < days; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() - (days - 1 - i));
    const date = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    const t = i / (days - 1);
    const trendKg = startKg + (endKg - startKg) * t;
    const variance = (rng() - 0.5) * 0.4;
    const weightKg = Math.round((trendKg + variance) * 10) / 10;
    const calories = 1900 + Math.floor(rng() * 400);

    await prisma.dailyEntry.upsert({
      where: {
        userId_date: { userId, date },
      },
      create: {
        userId,
        date,
        weightKg,
        calories,
        waistCm: i % 5 === 0 ? 86 + (rng() - 0.5) * 2 : null,
        hipCm: i % 5 === 0 ? 98 + (rng() - 0.5) * 2 : null,
      },
      update: {},
    });
  }

  console.log('Seeded', days, 'daily entries for test user.');

  const globalExercises: { name: string; kind: string }[] = [
    { name: 'Barbell back squat', kind: 'weight_reps' },
    { name: 'Barbell bench press', kind: 'weight_reps' },
    { name: 'Deadlift', kind: 'weight_reps' },
    { name: 'Overhead press', kind: 'weight_reps' },
    { name: 'Barbell row', kind: 'weight_reps' },
    { name: 'Romanian deadlift', kind: 'weight_reps' },
    { name: 'Leg press', kind: 'weight_reps' },
    { name: 'Lat pulldown', kind: 'weight_reps' },
    { name: 'Dumbbell curl', kind: 'weight_reps' },
    { name: 'Tricep pushdown', kind: 'weight_reps' },
    { name: 'Pull-up', kind: 'bodyweight_reps' },
    { name: 'Push-up', kind: 'bodyweight_reps' },
    { name: 'Plank', kind: 'time' },
    { name: 'Treadmill run', kind: 'time' },
    { name: 'Bike', kind: 'time' },
  ];
  let addedEx = 0;
  for (const ex of globalExercises) {
    const exists = await prisma.exercise.findFirst({
      where: { userId: null, name: ex.name },
    });
    if (!exists) {
      await prisma.exercise.create({
        data: { userId: null, name: ex.name, kind: ex.kind },
      });
      addedEx += 1;
    }
  }
  if (addedEx > 0) {
    console.log('Seeded', addedEx, 'global exercises.');
  }

  printLoginHint();
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error(e);
    prisma.$disconnect();
    process.exit(1);
  });
