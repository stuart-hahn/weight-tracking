/**
 * Seed script: creates a test user with one month of realistic daily entries.
 * For dev/demo only. Run: npx prisma db seed (from backend directory).
 * Requires DATABASE_URL (PostgreSQL).
 */
import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client.js';
import {
  ensureDefaultFixedProgram,
  FIXED_PROGRAM_NAME,
  weekdayToProgramDayOrderIndex,
} from '../src/services/defaultFixedProgram.js';
import { instantiateWorkoutFromProgramDay } from '../src/services/programWorkout.js';

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

function pickInt(rng: () => number, min: number, max: number): number {
  return min + Math.floor(rng() * (max - min + 1));
}

/** Plausible top-set kg for fixed-program exercise names (test user ~82 kg, intermediate). */
const BASE_WEIGHT_KG: Record<string, number> = {
  'Incline press (primary)': 62.5,
  'Neutral grip pulldown': 52,
  '1-arm DB row': 34,
  'DB lateral raise': 9,
  'Triceps press': 26,
  'DB curl': 12,
  'Romanian deadlift (primary)': 112,
  'Leg press': 185,
  'Seated leg curl': 36,
  'Bulgarian split squat': 28,
  'Standing calf raise': 52,
  'Ab wheel / rollout': 12.5,
  'Pulldown (primary)': 56,
  'Flat DB press': 30,
  'Chest-supported row': 44,
  'Rear delt raise': 11,
  'Incline DB curl': 12,
  'Overhead triceps': 20,
  'Hack squat / squat (primary)': 102,
  'Leg extension': 52,
  'Lying leg curl': 34,
  'Seated calf raise': 45,
  "Farmer's carry": 40,
};

const MIN_COMPLETED_WORKOUTS_TO_SKIP_HISTORY = 12;

async function seedCompletedWorkoutHistory(userId: string): Promise<void> {
  const completedCount = await prisma.workout.count({
    where: { userId, completedAt: { not: null } },
  });
  if (completedCount >= MIN_COMPLETED_WORKOUTS_TO_SKIP_HISTORY) {
    console.log(
      'Test user already has',
      completedCount,
      'completed workouts; skipping workout history seed.'
    );
    return;
  }

  const program = await prisma.workoutProgram.findFirst({
    where: { userId, name: FIXED_PROGRAM_NAME },
    include: { days: { select: { id: true, orderIndex: true } } },
  });
  if (!program?.days.length) {
    console.log('No fixed program days found; skipping workout history seed.');
    return;
  }

  const dayIdByOrder = new Map(program.days.map((d) => [d.orderIndex, d.id]));
  const rng = seeded(42_424);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  let seededSessions = 0;
  for (let daysAgo = 35; daysAgo >= 1; daysAgo--) {
    const d = new Date(today);
    d.setDate(d.getDate() - daysAgo);
    const orderIndex = weekdayToProgramDayOrderIndex(d);
    if (orderIndex == null) continue;
    const programDayId = dayIdByOrder.get(orderIndex);
    if (!programDayId) continue;

    const workoutId = await instantiateWorkoutFromProgramDay(userId, programDayId);
    if (!workoutId) continue;

    const progress = 1 + (35 - daysAgo) * 0.0028;

    const wFull = await prisma.workout.findUnique({
      where: { id: workoutId },
      include: {
        exercises: {
          include: {
            exercise: true,
            sets: { orderBy: { setIndex: 'asc' } },
          },
        },
      },
    });
    if (!wFull) continue;

    for (const line of wFull.exercises) {
      const { kind, name } = line.exercise;
      for (const s of line.sets) {
        const tMin = s.targetRepsMin;
        const tMax = s.targetRepsMax;
        const rMin = s.targetRirMin;
        const rMax = s.targetRirMax;

        let weightKg = s.weightKg;
        let reps: number | null = s.reps;
        let rir: number | null = s.rir;
        let durationSec: number | null = s.durationSec;

        if (kind === 'weight_reps') {
          const base = BASE_WEIGHT_KG[name] ?? 28;
          if (weightKg == null || weightKg <= 0) {
            if (s.setRole === 'backoff') {
              weightKg = Math.round(base * progress * 0.91 * 10) / 10;
            } else {
              weightKg = Math.round(base * progress * 10) / 10;
            }
          }
          if (tMin != null && tMax != null) {
            reps = pickInt(rng, tMin, tMax);
          } else if (name.includes('carry')) {
            reps = pickInt(rng, 24, 36);
          }
          if (rMin != null && rMax != null) {
            rir = pickInt(rng, rMin, rMax);
          }
        } else if (kind === 'bodyweight_reps') {
          if (tMin != null && tMax != null) {
            reps = pickInt(rng, tMin, tMax);
          } else {
            reps = pickInt(rng, 4, 6);
          }
        } else if (kind === 'time') {
          if (name.includes('Sprint')) {
            durationSec = pickInt(rng, 12, 20);
          } else {
            durationSec = pickInt(rng, 1260, 1620);
          }
        }

        await prisma.workoutSet.update({
          where: { id: s.id },
          data: { weightKg, reps, rir, durationSec },
        });
      }
    }

    const startedAt = new Date(d);
    startedAt.setHours(18, 10 + Math.floor(rng() * 20), 0, 0);
    const durationMin = 38 + Math.floor(rng() * 32);
    const completedAt = new Date(startedAt.getTime() + durationMin * 60 * 1000);

    await prisma.workout.update({
      where: { id: workoutId },
      data: { startedAt, completedAt },
    });
    seededSessions += 1;
  }

  console.log('Seeded', seededSessions, 'completed program workouts for test user (last ~5 weeks, weekdays).');
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
  await seedCompletedWorkoutHistory(userId);

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
