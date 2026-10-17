-- Additive manual migration. Existing legacy tables and data are untouched.
BEGIN;
DO $$ BEGIN CREATE TYPE "resource_file_purpose" AS ENUM ('RESOURCE_CONTENT', 'RESOURCE_THUMBNAIL', 'COLLECTION_COVER'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "resource_upload_state" AS ENUM ('PENDING', 'READY', 'REJECTED'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "resource_cleanup_state" AS ENUM ('NONE', 'QUEUED', 'DONE'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "resource_type" AS ENUM ('PDF', 'VIDEO', 'ARTICLE'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "resource_status" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED', 'DELETED'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "resource_access_policy" AS ENUM ('FREE', 'OWNER_ONLY', 'ENROLLED', 'PURCHASE'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
CREATE TABLE "study_resources" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "type" "resource_type" NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "description" TEXT,
    "owner_user_id" UUID NOT NULL,
    "uploaded_by_user_id" UUID NOT NULL,
    "institution_id" UUID,
    "access_policy" "resource_access_policy" NOT NULL,
    "status" "resource_status" NOT NULL DEFAULT 'DRAFT',
    "is_standalone" BOOLEAN NOT NULL DEFAULT true,
    "price_amount_minor" INTEGER,
    "currency" VARCHAR(3),
    "pin_hash" TEXT,
    "unlock_version" INTEGER NOT NULL DEFAULT 1,
    "version" INTEGER NOT NULL DEFAULT 1,
    "metadata" JSONB,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "published_at" TIMESTAMPTZ,
    "archived_at" TIMESTAMPTZ,
    "deleted_at" TIMESTAMPTZ,

    CONSTRAINT "study_resources_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "resource_collections" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "title" VARCHAR(200) NOT NULL,
    "description" TEXT,
    "owner_user_id" UUID NOT NULL,
    "created_by_user_id" UUID NOT NULL,
    "institution_id" UUID,
    "access_policy" "resource_access_policy" NOT NULL,
    "status" "resource_status" NOT NULL DEFAULT 'DRAFT',
    "price_amount_minor" INTEGER,
    "currency" VARCHAR(3),
    "pin_hash" TEXT,
    "unlock_version" INTEGER NOT NULL DEFAULT 1,
    "version" INTEGER NOT NULL DEFAULT 1,
    "metadata" JSONB,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "published_at" TIMESTAMPTZ,
    "archived_at" TIMESTAMPTZ,
    "deleted_at" TIMESTAMPTZ,

    CONSTRAINT "resource_collections_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "resource_collection_items" (
    "collection_id" UUID NOT NULL,
    "resource_id" UUID NOT NULL,
    "position" INTEGER NOT NULL,
    "added_by_user_id" UUID NOT NULL,
    "added_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "resource_collection_items_pkey" PRIMARY KEY ("collection_id","resource_id")
);

CREATE TABLE "resource_files" (
    "id" UUID NOT NULL,
    "uploader_user_id" UUID NOT NULL,
    "resource_id" UUID,
    "collection_id" UUID,
    "purpose" "resource_file_purpose" NOT NULL,
    "file_type" TEXT NOT NULL,
    "size_bytes" INTEGER NOT NULL,
    "reference" JSONB NOT NULL,
    "verified_reference" JSONB,
    "verified_size_bytes" INTEGER,
    "expires_at" TIMESTAMPTZ NOT NULL,
    "completed_at" TIMESTAMPTZ,
    "state" "resource_upload_state" NOT NULL DEFAULT 'PENDING',
    "attached" BOOLEAN NOT NULL DEFAULT false,
    "cleanup_state" "resource_cleanup_state" NOT NULL DEFAULT 'NONE',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "resource_files_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "resource_unlock_grants" (
    "resource_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'PIN',
    "unlock_version" INTEGER NOT NULL,
    "granted_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMPTZ,
    "revoked_at" TIMESTAMPTZ,

    CONSTRAINT "resource_unlock_grants_pkey" PRIMARY KEY ("resource_id","user_id")
);

CREATE TABLE "resource_collection_unlock_grants" (
    "collection_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'PIN',
    "unlock_version" INTEGER NOT NULL,
    "granted_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMPTZ,
    "revoked_at" TIMESTAMPTZ,

    CONSTRAINT "resource_collection_unlock_grants_pkey" PRIMARY KEY ("collection_id","user_id")
);

CREATE TABLE "resource_cleanup_jobs" (
    "file_id" UUID NOT NULL,
    "next_attempt_at" TIMESTAMPTZ NOT NULL,
    "claimed_at" TIMESTAMPTZ,
    "claim_token" UUID,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "completed_at" TIMESTAMPTZ,
    "last_error" VARCHAR(100),

    CONSTRAINT "resource_cleanup_jobs_pkey" PRIMARY KEY ("file_id")
);

CREATE INDEX "study_resources_owner_user_id_status_created_at_id_idx" ON "study_resources"("owner_user_id", "status", "created_at", "id");

CREATE INDEX "study_resources_institution_id_status_created_at_id_idx" ON "study_resources"("institution_id", "status", "created_at", "id");

CREATE INDEX "study_resources_status_is_standalone_access_policy_created__idx" ON "study_resources"("status", "is_standalone", "access_policy", "created_at", "id");

CREATE INDEX "resource_collections_owner_user_id_status_created_at_id_idx" ON "resource_collections"("owner_user_id", "status", "created_at", "id");

CREATE INDEX "resource_collections_institution_id_status_created_at_id_idx" ON "resource_collections"("institution_id", "status", "created_at", "id");

CREATE INDEX "resource_collections_status_access_policy_created_at_id_idx" ON "resource_collections"("status", "access_policy", "created_at", "id");

CREATE INDEX "resource_collection_items_resource_id_idx" ON "resource_collection_items"("resource_id");

CREATE UNIQUE INDEX "resource_collection_items_collection_id_position_key" ON "resource_collection_items"("collection_id", "position");

CREATE INDEX "resource_files_resource_id_attached_idx" ON "resource_files"("resource_id", "attached");

CREATE INDEX "resource_files_collection_id_attached_idx" ON "resource_files"("collection_id", "attached");

CREATE INDEX "resource_files_uploader_user_id_state_expires_at_idx" ON "resource_files"("uploader_user_id", "state", "expires_at");

CREATE INDEX "resource_files_state_expires_at_idx" ON "resource_files"("state", "expires_at");

CREATE INDEX "resource_unlock_grants_user_id_idx" ON "resource_unlock_grants"("user_id");

CREATE INDEX "resource_collection_unlock_grants_user_id_idx" ON "resource_collection_unlock_grants"("user_id");

CREATE INDEX "resource_cleanup_jobs_completed_at_next_attempt_at_claimed__idx" ON "resource_cleanup_jobs"("completed_at", "next_attempt_at", "claimed_at");

ALTER TABLE "study_resources" ADD CONSTRAINT "study_resources_owner_user_id_fkey" FOREIGN KEY ("owner_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "study_resources" ADD CONSTRAINT "study_resources_uploaded_by_user_id_fkey" FOREIGN KEY ("uploaded_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "study_resources" ADD CONSTRAINT "study_resources_institution_id_fkey" FOREIGN KEY ("institution_id") REFERENCES "institutions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "resource_collections" ADD CONSTRAINT "resource_collections_owner_user_id_fkey" FOREIGN KEY ("owner_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "resource_collections" ADD CONSTRAINT "resource_collections_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "resource_collections" ADD CONSTRAINT "resource_collections_institution_id_fkey" FOREIGN KEY ("institution_id") REFERENCES "institutions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "resource_collection_items" ADD CONSTRAINT "resource_collection_items_collection_id_fkey" FOREIGN KEY ("collection_id") REFERENCES "resource_collections"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "resource_collection_items" ADD CONSTRAINT "resource_collection_items_resource_id_fkey" FOREIGN KEY ("resource_id") REFERENCES "study_resources"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "resource_collection_items" ADD CONSTRAINT "resource_collection_items_added_by_user_id_fkey" FOREIGN KEY ("added_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "resource_files" ADD CONSTRAINT "resource_files_uploader_user_id_fkey" FOREIGN KEY ("uploader_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "resource_files" ADD CONSTRAINT "resource_files_resource_id_fkey" FOREIGN KEY ("resource_id") REFERENCES "study_resources"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "resource_files" ADD CONSTRAINT "resource_files_collection_id_fkey" FOREIGN KEY ("collection_id") REFERENCES "resource_collections"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "resource_unlock_grants" ADD CONSTRAINT "resource_unlock_grants_resource_id_fkey" FOREIGN KEY ("resource_id") REFERENCES "study_resources"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "resource_unlock_grants" ADD CONSTRAINT "resource_unlock_grants_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "resource_collection_unlock_grants" ADD CONSTRAINT "resource_collection_unlock_grants_collection_id_fkey" FOREIGN KEY ("collection_id") REFERENCES "resource_collections"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "resource_collection_unlock_grants" ADD CONSTRAINT "resource_collection_unlock_grants_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "resource_cleanup_jobs" ADD CONSTRAINT "resource_cleanup_jobs_file_id_fkey" FOREIGN KEY ("file_id") REFERENCES "resource_files"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Included in the additive migration; also apply to isolated db-push test schemas.
ALTER TABLE study_resources ADD CONSTRAINT study_resource_policy_scope CHECK (
  (access_policy <> 'ENROLLED' OR institution_id IS NOT NULL) AND
  (access_policy NOT IN ('OWNER_ONLY', 'PURCHASE') OR institution_id IS NULL));
ALTER TABLE resource_collections ADD CONSTRAINT collection_policy_scope CHECK (
  (access_policy <> 'ENROLLED' OR institution_id IS NOT NULL) AND
  (access_policy NOT IN ('OWNER_ONLY', 'PURCHASE') OR institution_id IS NULL));
ALTER TABLE study_resources ADD CONSTRAINT study_resource_pin_price CHECK (
  (access_policy = 'PURCHASE' AND pin_hash IS NOT NULL AND pin_hash LIKE 'scrypt$%' AND
    (price_amount_minor IS NULL OR price_amount_minor > 0) AND
    ((price_amount_minor IS NULL AND currency IS NULL) OR (price_amount_minor IS NOT NULL AND currency IS NOT NULL AND currency ~ '^[A-Z]{3}$'))) OR
  (access_policy <> 'PURCHASE' AND pin_hash IS NULL AND price_amount_minor IS NULL AND currency IS NULL));
ALTER TABLE resource_collections ADD CONSTRAINT collection_pin_price CHECK (
  (access_policy = 'PURCHASE' AND pin_hash IS NOT NULL AND pin_hash LIKE 'scrypt$%' AND
    (price_amount_minor IS NULL OR price_amount_minor > 0) AND
    ((price_amount_minor IS NULL AND currency IS NULL) OR (price_amount_minor IS NOT NULL AND currency IS NOT NULL AND currency ~ '^[A-Z]{3}$'))) OR
  (access_policy <> 'PURCHASE' AND pin_hash IS NULL AND price_amount_minor IS NULL AND currency IS NULL));
ALTER TABLE study_resources ADD CONSTRAINT study_resource_versions CHECK (version > 0 AND unlock_version > 0 AND (status = 'DELETED') = (deleted_at IS NOT NULL));
ALTER TABLE resource_collections ADD CONSTRAINT collection_versions CHECK (version > 0 AND unlock_version > 0 AND (status = 'DELETED') = (deleted_at IS NOT NULL));
ALTER TABLE resource_collection_items ADD CONSTRAINT collection_position CHECK (position >= 0);
ALTER TABLE resource_files ADD CONSTRAINT resource_file_target CHECK (
  (purpose IN ('RESOURCE_CONTENT', 'RESOURCE_THUMBNAIL') AND resource_id IS NOT NULL AND collection_id IS NULL) OR
  (purpose = 'COLLECTION_COVER' AND resource_id IS NULL AND collection_id IS NOT NULL));
ALTER TABLE resource_files ADD CONSTRAINT resource_file_format CHECK (
  size_bytes > 0 AND
  ((purpose = 'RESOURCE_CONTENT' AND file_type IN ('application/pdf', 'video/mp4')) OR
   (purpose <> 'RESOURCE_CONTENT' AND file_type IN ('image/jpeg', 'image/png', 'image/webp'))));
ALTER TABLE resource_files ADD CONSTRAINT resource_file_ready CHECK (
  (state <> 'READY' OR (verified_reference IS NOT NULL AND verified_size_bytes IS NOT NULL AND verified_size_bytes = size_bytes AND completed_at IS NOT NULL)) AND
  (NOT attached OR (state = 'READY' AND cleanup_state = 'NONE')));
CREATE UNIQUE INDEX resource_file_one_active_resource_purpose ON resource_files(resource_id, purpose) WHERE attached AND resource_id IS NOT NULL;
CREATE UNIQUE INDEX resource_file_one_active_collection_cover ON resource_files(collection_id, purpose) WHERE attached AND collection_id IS NOT NULL;
ALTER TABLE resource_unlock_grants ADD CONSTRAINT resource_grant_pin CHECK (source = 'PIN' AND unlock_version > 0);
ALTER TABLE resource_collection_unlock_grants ADD CONSTRAINT collection_grant_pin CHECK (source = 'PIN' AND unlock_version > 0);

COMMIT;
