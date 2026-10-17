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
