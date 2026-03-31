/**
 * Canonical fixed upper/lower program. Idempotent per user via FIXED_PROGRAM_NAME.
 */

import { prisma } from '../config/db.js';
import type { ProgressionVariant } from './workoutProgressionStrategies.js';

export const FIXED_PROGRAM_NAME = 'Fixed — Upper / Lower';

export const FIXED_PROGRAM_DESCRIPTION =
  'Monday Upper A, Tuesday Lower A, Wednesday conditioning, Thursday Upper B, Friday Lower B, Saturday incline walk. Sunday off.';

/** Maps calendar weekday (JS: 0 Sun … 6 Sat) to program day orderIndex, or null for Sunday/rest. */
export function weekdayToProgramDayOrderIndex(d: Date): number | null {
  const w = d.getDay();
  if (w === 0) return null;
  return w - 1;
}

type SetRole = 'top' | 'backoff' | 'working';

interface SetDef {
  role: SetRole;
  targetRepsMin: number | null;
  targetRepsMax: number | null;
  targetRirMin: number | null;
  targetRirMax: number | null;
  percentOfTop?: number | null;
}

interface ExerciseLineDef {
  name: string;
  kind: string;
  variant: ProgressionVariant;
  notes?: string;
  sets: SetDef[];
}

interface DayDef {
  name: string;
  orderIndex: number;
  exercises: ExerciseLineDef[];
}

function s(
  role: SetRole,
  repsMin: number | null,
  repsMax: number | null,
  rirMin: number | null = null,
  rirMax: number | null = null,
  percentOfTop?: number | null
): SetDef {
  return {
    role,
    targetRepsMin: repsMin,
    targetRepsMax: repsMax,
    targetRirMin: rirMin,
    targetRirMax: rirMax,
    ...(percentOfTop != null ? { percentOfTop } : {}),
  };
}

function repeatSets(count: number, def: SetDef): SetDef[] {
  return Array.from({ length: count }, () => ({ ...def }));
}

const FIXED_DAYS: DayDef[] = [
  {
    name: 'Monday — Upper A',
    orderIndex: 0,
    exercises: [
      {
        name: 'Incline press (primary)',
        kind: 'weight_reps',
        variant: 'primary_smith_incline',
        notes: 'Alt: DB incline press, feet-elevated push-ups.',
        sets: [
          s('top', 6, 8, 0, 1),
          s('backoff', 8, 10, 2, 2, 0.91),
        ],
      },
      {
        name: 'Neutral grip pulldown',
        kind: 'weight_reps',
        variant: 'general_double',
        notes: 'Alt: Pull-ups, band-assisted pull-ups.',
        sets: repeatSets(2, s('working', 6, 8, 1, 2)),
      },
      {
        name: '1-arm DB row',
        kind: 'weight_reps',
        variant: 'general_double',
        notes: 'Horizontal pull bias. Alt: Chest-supported row, inverted row. 2 sets per arm (4 sets total).',
        sets: repeatSets(4, s('working', 8, 10, 1, 2)),
      },
      {
        name: 'DB lateral raise',
        kind: 'weight_reps',
        variant: 'general_double',
        notes: 'Alt: Machine lateral raise, cable lateral raise.',
        sets: repeatSets(2, s('working', 12, 15, 1, 1)),
      },
      {
        name: 'Triceps press',
        kind: 'weight_reps',
        variant: 'general_double',
        notes: 'Alt: Dips, close-grip push-ups.',
        sets: repeatSets(2, s('working', 8, 10, 1, 2)),
      },
      {
        name: 'DB curl',
        kind: 'weight_reps',
        variant: 'general_double',
        notes: 'Alt: Machine curl, chin-ups.',
        sets: repeatSets(2, s('working', 8, 10, 1, 2)),
      },
    ],
  },
  {
    name: 'Tuesday — Lower A',
    orderIndex: 1,
    exercises: [
      {
        name: 'Box jumps (power)',
        kind: 'bodyweight_reps',
        variant: 'general_double',
        notes: 'Alt: Broad jumps. Full rest; stop far from fatigue. No RIR target.',
        sets: repeatSets(3, s('working', 3, 5, null, null)),
      },
      {
        name: 'Romanian deadlift (primary)',
        kind: 'weight_reps',
        variant: 'primary_rdl',
        notes: 'Alt: Barbell RDL, single-leg RDL.',
        sets: [s('top', 6, 8, 0, 1), s('backoff', 8, 10, 2, 2, 0.91)],
      },
      {
        name: 'Leg press',
        kind: 'weight_reps',
        variant: 'general_double',
        notes: 'Alt: Goblet squat, step-ups.',
        sets: repeatSets(2, s('working', 8, 10, 1, 2)),
      },
      {
        name: 'Seated leg curl',
        kind: 'weight_reps',
        variant: 'general_double',
        notes: 'Alt: Nordic curl (assisted), stability ball curl.',
        sets: repeatSets(2, s('working', 8, 10, 1, 2)),
      },
      {
        name: 'Bulgarian split squat',
        kind: 'weight_reps',
        variant: 'general_double',
        notes: 'Unilateral. Alt: Walking lunges, step-back lunges. 2 sets per leg (4 sets total).',
        sets: repeatSets(4, s('working', 8, 10, 1, 2)),
      },
      {
        name: 'Standing calf raise',
        kind: 'weight_reps',
        variant: 'general_double',
        notes: 'Alt: Single-leg calf raise.',
        sets: repeatSets(2, s('working', 8, 12, 1, 1)),
      },
      {
        name: 'Ab wheel / rollout',
        kind: 'weight_reps',
        variant: 'general_double',
        notes: 'Alt: Hanging knee raise.',
        sets: repeatSets(2, s('working', 8, 12, 1, 2)),
      },
    ],
  },
  {
    name: 'Wednesday — Conditioning',
    orderIndex: 2,
    exercises: [
      {
        name: 'Incline walk',
        kind: 'time',
        variant: 'general_double',
        notes:
          'Pick this OR sprints below — not both. Steady 20–30 minutes. Log duration (minutes) in session or use Sec field × 60.',
        sets: [s('working', null, null, null, null)],
      },
      {
        name: 'Sprint intervals',
        kind: 'time',
        variant: 'general_double',
        notes:
          'Pick this OR incline walk above — not both. 6–10 rounds × 10–20 sec work, full recovery. Log each work interval as one set (duration in seconds).',
        sets: repeatSets(10, s('working', null, null, null, null)),
      },
    ],
  },
  {
    name: 'Thursday — Upper B',
    orderIndex: 3,
    exercises: [
      {
        name: 'Med ball chest throw (power)',
        kind: 'bodyweight_reps',
        variant: 'general_double',
        notes: 'Alt: Explosive push-ups. Full rest.',
        sets: repeatSets(3, s('working', 3, 5, null, null)),
      },
      {
        name: 'Pulldown (primary)',
        kind: 'weight_reps',
        variant: 'primary_lat_pulldown_upper_b',
        notes: 'Alt: Pull-ups.',
        sets: [s('top', 6, 8, 0, 1), s('backoff', 8, 10, 2, 2, 0.91)],
      },
      {
        name: 'Flat DB press',
        kind: 'weight_reps',
        variant: 'general_double',
        notes: 'Alt: Machine press, push-ups.',
        sets: repeatSets(2, s('working', 6, 8, 1, 2)),
      },
      {
        name: 'Chest-supported row',
        kind: 'weight_reps',
        variant: 'general_double',
        notes: 'Alt: 1-arm DB row, inverted row.',
        sets: repeatSets(2, s('working', 8, 10, 1, 2)),
      },
      {
        name: 'Rear delt raise',
        kind: 'weight_reps',
        variant: 'general_double',
        notes: 'Alt: Cable rear delt, band pull-apart.',
        sets: repeatSets(2, s('working', 12, 15, 1, 1)),
      },
      {
        name: 'DB lateral raise',
        kind: 'weight_reps',
        variant: 'general_double',
        notes: 'Alt: Machine lateral raise.',
        sets: repeatSets(2, s('working', 12, 15, 1, 1)),
      },
      {
        name: 'Incline DB curl',
        kind: 'weight_reps',
        variant: 'general_double',
        notes: 'Alt: Machine curl.',
        sets: repeatSets(2, s('working', 8, 10, 1, 2)),
      },
      {
        name: 'Overhead triceps',
        kind: 'weight_reps',
        variant: 'general_double',
        notes: 'Alt: Cable extension, dips.',
        sets: repeatSets(2, s('working', 8, 10, 1, 2)),
      },
    ],
  },
  {
    name: 'Friday — Lower B',
    orderIndex: 4,
    exercises: [
      {
        name: 'Broad jumps (power)',
        kind: 'bodyweight_reps',
        variant: 'general_double',
        notes: 'Alt: Box jumps. Full rest.',
        sets: repeatSets(3, s('working', 3, 5, null, null)),
      },
      {
        name: 'Hack squat / squat (primary)',
        kind: 'weight_reps',
        variant: 'primary_squat_or_hack',
        notes: 'Alt: Barbell squat, goblet squat.',
        sets: [s('top', 6, 8, 0, 1), s('backoff', 8, 10, 2, 2, 0.91)],
      },
      {
        name: 'Leg extension',
        kind: 'weight_reps',
        variant: 'general_double',
        notes: 'Alt: Spanish squat, sissy squat.',
        sets: repeatSets(2, s('working', 10, 12, 1, 1)),
      },
      {
        name: 'Lying leg curl',
        kind: 'weight_reps',
        variant: 'general_double',
        notes: 'Alt: Nordic curl.',
        sets: repeatSets(2, s('working', 8, 10, 1, 2)),
      },
      {
        name: 'Seated calf raise',
        kind: 'weight_reps',
        variant: 'general_double',
        notes: 'Alt: Single-leg calf raise.',
        sets: repeatSets(2, s('working', 10, 15, 1, 1)),
      },
      {
        name: 'Hanging leg raise',
        kind: 'bodyweight_reps',
        variant: 'general_double',
        notes: 'Alt: Reverse crunch.',
        sets: repeatSets(2, s('working', 10, 15, 1, 1)),
      },
      {
        name: "Farmer's carry",
        kind: 'weight_reps',
        variant: 'general_double',
        notes: 'Alt: Trap bar carry, heavy DB hold. Use Reps field as distance in meters (20–40).',
        sets: repeatSets(2, s('working', 20, 40, null, null)),
      },
    ],
  },
  {
    name: 'Saturday — Incline walk',
    orderIndex: 5,
    exercises: [
      {
        name: 'Incline walk',
        kind: 'time',
        variant: 'general_double',
        notes: '20–30 minutes steady.',
        sets: [s('working', null, null, null, null)],
      },
    ],
  },
];

function collectExerciseKinds(): Map<string, string> {
  const m = new Map<string, string>();
  for (const day of FIXED_DAYS) {
    for (const ex of day.exercises) {
      if (!m.has(ex.name)) m.set(ex.name, ex.kind);
    }
  }
  return m;
}

/**
 * Ensures the user has the fixed program. No-op if a program with FIXED_PROGRAM_NAME already exists.
 */
export async function ensureDefaultFixedProgram(userId: string): Promise<void> {
  const existing = await prisma.workoutProgram.findFirst({
    where: { userId, name: FIXED_PROGRAM_NAME },
    select: { id: true },
  });
  if (existing) return;

  const exerciseKinds = collectExerciseKinds();

  await prisma.$transaction(async (tx) => {
    const dup = await tx.workoutProgram.findFirst({
      where: { userId, name: FIXED_PROGRAM_NAME },
      select: { id: true },
    });
    if (dup) return;

    const exerciseIdByName = new Map<string, string>();
    for (const [name, kind] of exerciseKinds) {
      const existing = await tx.exercise.findFirst({ where: { userId: null, name } });
      const row =
        existing != null
          ? await tx.exercise.update({ where: { id: existing.id }, data: { kind } })
          : await tx.exercise.create({ data: { userId: null, name, kind } });
      exerciseIdByName.set(name, row.id);
    }

    const program = await tx.workoutProgram.create({
      data: {
        userId,
        name: FIXED_PROGRAM_NAME,
        description: FIXED_PROGRAM_DESCRIPTION,
      },
    });

    for (const day of FIXED_DAYS) {
      const pd = await tx.programDay.create({
        data: {
          programId: program.id,
          name: day.name,
          orderIndex: day.orderIndex,
        },
      });
      let order = 0;
      for (const line of day.exercises) {
        const exerciseId = exerciseIdByName.get(line.name);
        if (!exerciseId) throw new Error(`Missing exercise id for ${line.name}`);
        const pde = await tx.programDayExercise.create({
          data: {
            programDayId: pd.id,
            exerciseId,
            orderIndex: order,
            progressionVariant: line.variant,
            ...(line.notes != null ? { notes: line.notes } : {}),
          },
        });
        order += 1;
        let setIndex = 0;
        for (const tpl of line.sets) {
          await tx.programDaySetTemplate.create({
            data: {
              programDayExerciseId: pde.id,
              setIndex,
              setRole: tpl.role,
              targetRepsMin: tpl.targetRepsMin,
              targetRepsMax: tpl.targetRepsMax,
              targetRirMin: tpl.targetRirMin,
              targetRirMax: tpl.targetRirMax,
              percentOfTop: tpl.percentOfTop ?? null,
            },
          });
          setIndex += 1;
        }
      }
    }
  });
}
