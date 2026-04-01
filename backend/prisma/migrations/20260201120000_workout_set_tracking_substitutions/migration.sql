-- AlterTable
ALTER TABLE "workout_exercises" ADD COLUMN "substituted_from_exercise_id" TEXT;

-- AlterTable
ALTER TABLE "workout_sets" ADD COLUMN "completed_at" TIMESTAMP(3),
ADD COLUMN "set_kind" TEXT,
ADD COLUMN "actual_rest_seconds" INTEGER;

-- CreateTable
CREATE TABLE "exercise_substitutions" (
    "id" TEXT NOT NULL,
    "primary_exercise_id" TEXT NOT NULL,
    "substitute_exercise_id" TEXT NOT NULL,
    "order_index" INTEGER NOT NULL,

    CONSTRAINT "exercise_substitutions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "exercise_substitutions_primary_exercise_id_substitute_exercise_id_key" ON "exercise_substitutions"("primary_exercise_id", "substitute_exercise_id");

-- CreateIndex
CREATE INDEX "exercise_substitutions_primary_exercise_id_order_index_idx" ON "exercise_substitutions"("primary_exercise_id", "order_index");

-- AddForeignKey
ALTER TABLE "exercise_substitutions" ADD CONSTRAINT "exercise_substitutions_primary_exercise_id_fkey" FOREIGN KEY ("primary_exercise_id") REFERENCES "exercises"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exercise_substitutions" ADD CONSTRAINT "exercise_substitutions_substitute_exercise_id_fkey" FOREIGN KEY ("substitute_exercise_id") REFERENCES "exercises"("id") ON DELETE CASCADE ON UPDATE CASCADE;
