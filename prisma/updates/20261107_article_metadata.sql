-- Additive migration for Article metadata and unlock grants in PostgreSQL
BEGIN;

DO $$ BEGIN
  CREATE TYPE "article_access_policy" AS ENUM ('FREE', 'PURCHASE');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "article_status" AS ENUM ('DRAFT', 'PENDING_REVIEW', 'PUBLISHED', 'REJECTED', 'ARCHIVED');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "articles" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "title" VARCHAR(200) NOT NULL,
  "description" TEXT,
  "cover_image_url" VARCHAR(2048),
  "tags" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "access_policy" "article_access_policy" NOT NULL DEFAULT 'FREE',
  "status" "article_status" NOT NULL DEFAULT 'DRAFT',
  "price_amount_minor" INTEGER,
  "currency" VARCHAR(3) DEFAULT 'USD',
  "pin_hash" TEXT,
  "content_version" INTEGER NOT NULL DEFAULT 1,
  "author_id" UUID NOT NULL,
  "reviewed_by_user_id" UUID,
  "reviewed_at" TIMESTAMPTZ,
  "review_notes" TEXT,
  "reject_reason" TEXT,
  "published_at" TIMESTAMPTZ,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "deleted_at" TIMESTAMPTZ,

  CONSTRAINT "articles_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "articles_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "articles_reviewed_by_user_id_fkey" FOREIGN KEY ("reviewed_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "article_unlock_grants" (
  "article_id" UUID NOT NULL,
  "user_id" UUID NOT NULL,
  "source" VARCHAR(32) NOT NULL DEFAULT 'PIN',
  "granted_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "article_unlock_grants_pkey" PRIMARY KEY ("article_id", "user_id"),
  CONSTRAINT "article_unlock_grants_article_id_fkey" FOREIGN KEY ("article_id") REFERENCES "articles"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "article_unlock_grants_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "articles_author_id_status_created_at_idx" ON "articles"("author_id", "status", "created_at");
CREATE INDEX IF NOT EXISTS "articles_status_access_policy_published_at_idx" ON "articles"("status", "access_policy", "published_at");
CREATE INDEX IF NOT EXISTS "articles_status_created_at_idx" ON "articles"("status", "created_at");
CREATE INDEX IF NOT EXISTS "article_unlock_grants_user_id_idx" ON "article_unlock_grants"("user_id");

COMMIT;
