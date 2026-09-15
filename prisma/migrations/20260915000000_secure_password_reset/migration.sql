ALTER TABLE "users"
  ADD COLUMN "last_login_ip" VARCHAR(45),
  ADD COLUMN "last_login_region" VARCHAR(64),
  ADD COLUMN "password_changed_at" TIMESTAMPTZ;

ALTER TABLE "pass_resets"
  ALTER COLUMN "code_digest" TYPE VARCHAR(64);

CREATE UNIQUE INDEX "pass_resets_code_digest_key"
  ON "pass_resets"("code_digest");
