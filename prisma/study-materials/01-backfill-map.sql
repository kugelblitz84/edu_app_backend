-- Explicit operator-reviewed mappings. No owner or PIN is inferred from legacy URLs.
CREATE TABLE IF NOT EXISTS study_material_backfill_map (
  kind TEXT NOT NULL CHECK (kind IN ('RESOURCE','COLLECTION')),
  legacy_id UUID NOT NULL,
  owner_user_id UUID NOT NULL REFERENCES users(id),
  actor_user_id UUID NOT NULL REFERENCES users(id),
  institution_id UUID REFERENCES institutions(id),
  access_policy resource_access_policy NOT NULL,
  pin_hash TEXT,
  price_amount_minor INTEGER,
  currency VARCHAR(3),
  is_standalone BOOLEAN NOT NULL DEFAULT FALSE,
  PRIMARY KEY(kind, legacy_id)
);
