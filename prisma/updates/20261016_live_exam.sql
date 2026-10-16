-- Apply once to the pre-live-exam schema using: npx prisma db execute --file prisma/updates/20261016_live_exam.sql
-- Preserve existing exam schedules and apply all changes atomically.
BEGIN;

-- CreateEnum
CREATE TYPE "exam_attempt_scope" AS ENUM ('PUBLIC', 'INSTITUTIONAL');

-- CreateEnum
CREATE TYPE "exam_attempt_status" AS ENUM ('IN_PROGRESS', 'SUBMITTED', 'AUTO_SUBMITTED', 'GRADED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "enrollment_status" AS ENUM ('PENDING', 'ACTIVE', 'SUSPENDED', 'CANCELLED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "exam_access_mode" AS ENUM ('OPEN', 'INVITE_ONLY');

-- DropIndex
DROP INDEX "institution_exams_exam_date_idx";

-- DropIndex
DROP INDEX "personal_exams_exam_date_idx";

-- AlterTable
ALTER TABLE "institution_exams" RENAME COLUMN "exam_date" TO "starts_at";
ALTER TABLE "institution_exams"
ADD COLUMN     "access_mode" "exam_access_mode" NOT NULL DEFAULT 'OPEN',
ADD COLUMN     "closes_at" TIMESTAMPTZ,
ADD COLUMN     "content_version" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "max_attempts" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "pass_percentage" DECIMAL(5,2);

-- AlterTable
ALTER TABLE "personal_exams" RENAME COLUMN "exam_date" TO "starts_at";
ALTER TABLE "personal_exams"
ADD COLUMN     "access_mode" "exam_access_mode" NOT NULL DEFAULT 'OPEN',
ADD COLUMN     "closes_at" TIMESTAMPTZ,
ADD COLUMN     "content_version" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "max_attempts" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "pass_percentage" DECIMAL(5,2);

-- CreateTable
CREATE TABLE "exam_attempts" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "exam_id" UUID NOT NULL,
    "exam_scope" "exam_attempt_scope" NOT NULL,
    "exam_name" VARCHAR(200) NOT NULL,
    "institution_id" UUID,
    "content_version" INTEGER NOT NULL,
    "pass_percentage" DECIMAL(5,2),
    "is_practice" BOOLEAN NOT NULL DEFAULT false,
    "attempt_number" INTEGER NOT NULL,
    "status" "exam_attempt_status" NOT NULL DEFAULT 'IN_PROGRESS',
    "started_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMPTZ NOT NULL,
    "submitted_at" TIMESTAMPTZ,
    "last_activity_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "started_ip" VARCHAR(45),
    "user_agent" VARCHAR(512),
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "exam_attempts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "exam_attempt_answers" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "attempt_id" UUID NOT NULL,
    "question_id" UUID NOT NULL,
    "answer_data" JSONB NOT NULL,
    "revision" INTEGER NOT NULL DEFAULT 1,
    "is_correct" BOOLEAN,
    "awarded_marks" DECIMAL(8,2),
    "answered_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "exam_attempt_answers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "exam_attempt_results" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "attempt_id" UUID NOT NULL,
    "score" DECIMAL(10,2) NOT NULL,
    "maximum_score" DECIMAL(10,2) NOT NULL,
    "percentage" DECIMAL(5,2) NOT NULL,
    "passed" BOOLEAN,
    "correct_answers" INTEGER NOT NULL,
    "incorrect_answers" INTEGER NOT NULL,
    "unanswered" INTEGER NOT NULL,
    "graded_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "exam_attempt_results_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "enrollments" (
    "institution_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "status" "enrollment_status" NOT NULL DEFAULT 'PENDING',
    "enrolled_at" TIMESTAMPTZ,
    "expires_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "enrollments_pkey" PRIMARY KEY ("institution_id","user_id")
);

-- CreateIndex
CREATE INDEX "exam_attempts_user_id_created_at_idx" ON "exam_attempts"("user_id", "created_at");

-- CreateIndex
CREATE INDEX "exam_attempts_exam_id_exam_scope_idx" ON "exam_attempts"("exam_id", "exam_scope");

-- CreateIndex
CREATE INDEX "exam_attempts_status_expires_at_idx" ON "exam_attempts"("status", "expires_at");

-- CreateIndex
CREATE UNIQUE INDEX "exam_attempts_user_id_exam_id_exam_scope_is_practice_attemp_key" ON "exam_attempts"("user_id", "exam_id", "exam_scope", "is_practice", "attempt_number");

-- CreateIndex
CREATE INDEX "exam_attempt_answers_attempt_id_idx" ON "exam_attempt_answers"("attempt_id");

-- CreateIndex
CREATE UNIQUE INDEX "exam_attempt_answers_attempt_id_question_id_key" ON "exam_attempt_answers"("attempt_id", "question_id");

-- CreateIndex
CREATE UNIQUE INDEX "exam_attempt_results_attempt_id_key" ON "exam_attempt_results"("attempt_id");

-- CreateIndex
CREATE INDEX "exam_attempt_results_percentage_idx" ON "exam_attempt_results"("percentage");

-- CreateIndex
CREATE INDEX "enrollments_user_id_idx" ON "enrollments"("user_id");

-- CreateIndex
CREATE INDEX "enrollments_institution_id_status_idx" ON "enrollments"("institution_id", "status");

-- CreateIndex
CREATE INDEX "enrollments_status_idx" ON "enrollments"("status");

-- CreateIndex
CREATE INDEX "institution_exams_starts_at_idx" ON "institution_exams"("starts_at");

-- CreateIndex
CREATE INDEX "institution_exams_closes_at_idx" ON "institution_exams"("closes_at");

-- CreateIndex
CREATE INDEX "personal_exams_starts_at_idx" ON "personal_exams"("starts_at");

-- CreateIndex
CREATE INDEX "personal_exams_closes_at_idx" ON "personal_exams"("closes_at");

-- AddForeignKey
ALTER TABLE "exam_attempts" ADD CONSTRAINT "exam_attempts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exam_attempt_answers" ADD CONSTRAINT "exam_attempt_answers_attempt_id_fkey" FOREIGN KEY ("attempt_id") REFERENCES "exam_attempts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exam_attempt_results" ADD CONSTRAINT "exam_attempt_results_attempt_id_fkey" FOREIGN KEY ("attempt_id") REFERENCES "exam_attempts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "enrollments" ADD CONSTRAINT "enrollments_institution_id_fkey" FOREIGN KEY ("institution_id") REFERENCES "institutions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "enrollments" ADD CONSTRAINT "enrollments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

COMMIT;

