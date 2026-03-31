-- Baseline: full schema (historical DBs used db push; this is the first Migrate migration)

-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "age" INTEGER NOT NULL,
    "sex" TEXT NOT NULL,
    "height_cm" DOUBLE PRECISION NOT NULL,
    "current_weight_kg" DOUBLE PRECISION NOT NULL,
    "target_body_fat_percent" DOUBLE PRECISION NOT NULL,
    "activity_level" TEXT,
    "lean_mass_kg" DOUBLE PRECISION,
    "units" TEXT NOT NULL DEFAULT 'metric',
    "password_reset_token" TEXT,
    "password_reset_expires_at" TIMESTAMP(3),
    "email_verified_at" TIMESTAMP(3),
    "email_verification_token" TEXT,
    "email_verification_expires_at" TIMESTAMP(3),
    "onboarding_complete" BOOLEAN NOT NULL DEFAULT true,
    "plan" TEXT DEFAULT 'free',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "training_block_started_at" TIMESTAMP(3),
    "last_calibration_week_index" INTEGER,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "exercises" (
    "id" TEXT NOT NULL,
    "user_id" TEXT,
    "name" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "exercises_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_exercise_favorites" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "exercise_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_exercise_favorites_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workout_programs" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "workout_programs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "program_days" (
    "id" TEXT NOT NULL,
    "program_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "order_index" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "program_days_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "program_day_exercises" (
    "id" TEXT NOT NULL,
    "program_day_id" TEXT NOT NULL,
    "exercise_id" TEXT NOT NULL,
    "order_index" INTEGER NOT NULL,
    "progression_variant" TEXT NOT NULL DEFAULT 'general_double',
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "program_day_exercises_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "program_day_set_templates" (
    "id" TEXT NOT NULL,
    "program_day_exercise_id" TEXT NOT NULL,
    "set_index" INTEGER NOT NULL,
    "set_role" TEXT NOT NULL,
    "target_reps_min" INTEGER,
    "target_reps_max" INTEGER,
    "target_rir_min" INTEGER,
    "target_rir_max" INTEGER,
    "percent_of_top" DOUBLE PRECISION,

    CONSTRAINT "program_day_set_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workouts" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "name" TEXT,
    "notes" TEXT,
    "started_at" TIMESTAMP(3) NOT NULL,
    "completed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "program_id" TEXT,
    "program_day_id" TEXT,
    "training_week_index" INTEGER,
    "is_deload_week" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "workouts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workout_exercises" (
    "id" TEXT NOT NULL,
    "workout_id" TEXT NOT NULL,
    "exercise_id" TEXT NOT NULL,
    "order_index" INTEGER NOT NULL,
    "notes" TEXT,
    "default_rest_seconds" INTEGER,

    CONSTRAINT "workout_exercises_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workout_sets" (
    "id" TEXT NOT NULL,
    "workout_exercise_id" TEXT NOT NULL,
    "set_index" INTEGER NOT NULL,
    "weight_kg" DOUBLE PRECISION,
    "reps" INTEGER,
    "duration_sec" INTEGER,
    "notes" TEXT,
    "rest_seconds_after" INTEGER,
    "rir" INTEGER,
    "set_role" TEXT,
    "target_reps_min" INTEGER,
    "target_reps_max" INTEGER,
    "target_rir_min" INTEGER,
    "target_rir_max" INTEGER,
    "calibration_to_failure" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "workout_sets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "daily_entries" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "weight_kg" DOUBLE PRECISION NOT NULL,
    "calories" INTEGER,
    "waist_cm" DOUBLE PRECISION,
    "hip_cm" DOUBLE PRECISION,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "daily_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "optional_metrics" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "body_fat_percent" DOUBLE PRECISION,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "optional_metrics_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "exercises_user_id_idx" ON "exercises"("user_id");

-- CreateIndex
CREATE INDEX "exercises_name_idx" ON "exercises"("name");

-- CreateIndex
CREATE UNIQUE INDEX "exercises_user_id_name_key" ON "exercises"("user_id", "name");

-- CreateIndex
CREATE INDEX "user_exercise_favorites_user_id_idx" ON "user_exercise_favorites"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "user_exercise_favorites_user_id_exercise_id_key" ON "user_exercise_favorites"("user_id", "exercise_id");

-- CreateIndex
CREATE INDEX "workout_programs_user_id_idx" ON "workout_programs"("user_id");

-- CreateIndex
CREATE INDEX "program_days_program_id_order_index_idx" ON "program_days"("program_id", "order_index");

-- CreateIndex
CREATE INDEX "program_day_exercises_program_day_id_order_index_idx" ON "program_day_exercises"("program_day_id", "order_index");

-- CreateIndex
CREATE INDEX "program_day_set_templates_program_day_exercise_id_set_index_idx" ON "program_day_set_templates"("program_day_exercise_id", "set_index");

-- CreateIndex
CREATE INDEX "workouts_user_id_started_at_idx" ON "workouts"("user_id", "started_at");

-- CreateIndex
CREATE INDEX "workouts_user_id_completed_at_idx" ON "workouts"("user_id", "completed_at");

-- CreateIndex
CREATE INDEX "workouts_program_day_id_idx" ON "workouts"("program_day_id");

-- CreateIndex
CREATE INDEX "workout_exercises_workout_id_order_index_idx" ON "workout_exercises"("workout_id", "order_index");

-- CreateIndex
CREATE INDEX "workout_sets_workout_exercise_id_set_index_idx" ON "workout_sets"("workout_exercise_id", "set_index");

-- CreateIndex
CREATE INDEX "daily_entries_user_id_date_idx" ON "daily_entries"("user_id", "date");

-- CreateIndex
CREATE UNIQUE INDEX "daily_entries_user_id_date_key" ON "daily_entries"("user_id", "date");

-- CreateIndex
CREATE INDEX "optional_metrics_user_id_date_idx" ON "optional_metrics"("user_id", "date");

-- CreateIndex
CREATE UNIQUE INDEX "optional_metrics_user_id_date_key" ON "optional_metrics"("user_id", "date");

-- AddForeignKey
ALTER TABLE "exercises" ADD CONSTRAINT "exercises_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_exercise_favorites" ADD CONSTRAINT "user_exercise_favorites_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_exercise_favorites" ADD CONSTRAINT "user_exercise_favorites_exercise_id_fkey" FOREIGN KEY ("exercise_id") REFERENCES "exercises"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workout_programs" ADD CONSTRAINT "workout_programs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "program_days" ADD CONSTRAINT "program_days_program_id_fkey" FOREIGN KEY ("program_id") REFERENCES "workout_programs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "program_day_exercises" ADD CONSTRAINT "program_day_exercises_program_day_id_fkey" FOREIGN KEY ("program_day_id") REFERENCES "program_days"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "program_day_exercises" ADD CONSTRAINT "program_day_exercises_exercise_id_fkey" FOREIGN KEY ("exercise_id") REFERENCES "exercises"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "program_day_set_templates" ADD CONSTRAINT "program_day_set_templates_program_day_exercise_id_fkey" FOREIGN KEY ("program_day_exercise_id") REFERENCES "program_day_exercises"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workouts" ADD CONSTRAINT "workouts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workouts" ADD CONSTRAINT "workouts_program_id_fkey" FOREIGN KEY ("program_id") REFERENCES "workout_programs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workouts" ADD CONSTRAINT "workouts_program_day_id_fkey" FOREIGN KEY ("program_day_id") REFERENCES "program_days"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workout_exercises" ADD CONSTRAINT "workout_exercises_workout_id_fkey" FOREIGN KEY ("workout_id") REFERENCES "workouts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workout_exercises" ADD CONSTRAINT "workout_exercises_exercise_id_fkey" FOREIGN KEY ("exercise_id") REFERENCES "exercises"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workout_sets" ADD CONSTRAINT "workout_sets_workout_exercise_id_fkey" FOREIGN KEY ("workout_exercise_id") REFERENCES "workout_exercises"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "daily_entries" ADD CONSTRAINT "daily_entries_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "optional_metrics" ADD CONSTRAINT "optional_metrics_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
