CREATE TABLE "profile_picture_uploads" (
  "id" UUID PRIMARY KEY,
  "user_id" UUID NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "file_type" TEXT NOT NULL,
  "size_bytes" INTEGER NOT NULL CHECK ("size_bytes" > 0),
  "reference" JSONB NOT NULL,
  "expires_at" TIMESTAMPTZ NOT NULL,
  "completed_at" TIMESTAMPTZ,
  "is_current" BOOLEAN NOT NULL DEFAULT FALSE,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "profile_picture_uploads_user_id_is_current_idx" ON "profile_picture_uploads"("user_id", "is_current");
CREATE INDEX "profile_picture_uploads_expires_at_idx" ON "profile_picture_uploads"("expires_at");
CREATE UNIQUE INDEX "profile_picture_uploads_one_current_per_user" ON "profile_picture_uploads"("user_id") WHERE "is_current";
