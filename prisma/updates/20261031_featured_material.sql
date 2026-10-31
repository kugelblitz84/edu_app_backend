-- Track featured resources (books/videos) and collections independently.
ALTER TABLE "study_resources"
  ADD COLUMN "is_featured" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "resource_collections"
  ADD COLUMN "is_featured" BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX "study_resources_featured_catalog_idx"
  ON "study_resources" ("is_featured", "status", "created_at" DESC);

CREATE INDEX "resource_collections_featured_catalog_idx"
  ON "resource_collections" ("is_featured", "status", "created_at" DESC);
