/**
 * Seed script: creates a test user with one month of realistic daily entries.
 * For dev/demo only. Run: npx prisma db seed (from backend directory).
 */
import 'dotenv/config';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import bcrypt from 'bcryptjs';
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';
import { PrismaClient } from '../src/generated/prisma/client.js';

const TEST_EMAIL = 'test@example.com';
const TEST_PASSWORD = 'TestPassword123';

// Resolve DATABASE_URL same way as app
let databaseUrl = process.env.DATABASE_URL ?? 'file:./data/body_fat_tracker.db';
if (
  process.env.DATABASE_FILE !== undefined &&
  process.env.DATABASE_FILE !== '' &&
  process.env.DATABASE_URL === undefined
) {
  process.env.DATABASE_URL = `file:${process.env.DATABASE_FILE}`;
  databaseUrl = process.env.DATABASE_URL;
}
if (databaseUrl.startsWith('file:./') || databaseUrl.startsWith('file:../')) {
  const relativePath = databaseUrl.slice(5);
  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  const backendRoot = path.resolve(__dirname, '..');
  const absolutePath = path.resolve(backendRoot, relativePath);
  databaseUrl = `file:${absolutePath}`;
}

const adapter = new PrismaBetterSqlite3({ url: databaseUrl });
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
  const entriesExisting = await prisma.dailyEntry.count({ where: { userId } });
  if (entriesExisting >= 30) {
    console.log('Test user already has', entriesExisting, 'entries; skipping entry seed.');
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
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error(e);
    prisma.$disconnect();
    process.exit(1);
  });
