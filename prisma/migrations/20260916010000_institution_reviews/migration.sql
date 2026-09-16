ALTER TYPE "institution_status" ADD VALUE IF NOT EXISTS 'REJECTED';

CREATE TYPE "institution_review_verdict" AS ENUM ('APPROVED', 'REJECTED');

ALTER TABLE "institutions"
  ADD COLUMN "review_verdict" "institution_review_verdict",
  ADD COLUMN "responded_by_user_id" UUID,
  ADD COLUMN "responded_at" TIMESTAMPTZ,
  ADD COLUMN "reject_reason" VARCHAR(500),
  ADD COLUMN "review_notes" VARCHAR(1000);

ALTER TABLE "institutions"
  ADD CONSTRAINT "institutions_responded_by_user_id_fkey"
  FOREIGN KEY ("responded_by_user_id") REFERENCES "users"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX "institutions_responded_by_user_id_responded_at_idx"
  ON "institutions"("responded_by_user_id", "responded_at");
