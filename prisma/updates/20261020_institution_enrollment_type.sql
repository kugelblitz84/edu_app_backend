-- Add enrollment_type enum and column to institutions
BEGIN;
DO $$ BEGIN 
  CREATE TYPE "enrollment_type" AS ENUM ('FREE', 'PAID', 'INVITE_ONLY'); 
EXCEPTION 
  WHEN duplicate_object THEN NULL; 
END $$;

ALTER TABLE "institutions" 
ADD COLUMN IF NOT EXISTS "enrollment_type" "enrollment_type" NOT NULL DEFAULT 'FREE';
COMMIT;

