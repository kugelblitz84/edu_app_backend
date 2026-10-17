-- Run with psql -v ON_ERROR_STOP=1 after populating the mapping table.
-- The report is intentionally readable before the transaction aborts.
BEGIN;
CREATE TEMP VIEW study_backfill_problems AS
SELECT 'UNMAPPED_RESOURCE' AS problem, r.id FROM resources r
 WHERE NOT EXISTS (SELECT 1 FROM study_material_backfill_map m WHERE m.kind='RESOURCE' AND m.legacy_id=r.id)
UNION ALL SELECT 'UNMAPPED_COLLECTION', c.id FROM "ResourceCollection" c
 WHERE NOT EXISTS (SELECT 1 FROM study_material_backfill_map m WHERE m.kind='COLLECTION' AND m.legacy_id=c.id)
UNION ALL SELECT 'DANGLING_COLLECTION', r.id FROM resources r
 WHERE r.collection_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM "ResourceCollection" c WHERE c.id=r.collection_id)
UNION ALL SELECT 'INVALID_POLICY_SCOPE_OR_PIN_PRICE', m.legacy_id FROM study_material_backfill_map m
 WHERE (m.access_policy='ENROLLED' AND m.institution_id IS NULL)
 OR (m.access_policy IN ('OWNER_ONLY','PURCHASE') AND m.institution_id IS NOT NULL)
 OR (m.access_policy='PURCHASE' AND (m.pin_hash IS NULL OR m.pin_hash NOT LIKE 'scrypt$%'
   OR (m.price_amount_minor IS NOT NULL AND (m.price_amount_minor <= 0 OR m.currency IS NULL OR m.currency !~ '^[A-Z]{3}$'))
   OR (m.price_amount_minor IS NULL AND m.currency IS NOT NULL)))
 OR (m.access_policy <> 'PURCHASE' AND (m.pin_hash IS NOT NULL OR m.price_amount_minor IS NOT NULL OR m.currency IS NOT NULL))
UNION ALL SELECT 'INCOMPATIBLE_LEGACY_MEMBERSHIP', r.id FROM resources r
 JOIN study_material_backfill_map rm ON rm.kind='RESOURCE' AND rm.legacy_id=r.id
 JOIN study_material_backfill_map cm ON cm.kind='COLLECTION' AND cm.legacy_id=r.collection_id
 WHERE rm.institution_id IS DISTINCT FROM cm.institution_id
 OR (cm.institution_id IS NULL AND rm.owner_user_id <> cm.owner_user_id)
 OR NOT CASE cm.access_policy
   WHEN 'FREE' THEN rm.access_policy='FREE'
   WHEN 'OWNER_ONLY' THEN TRUE
   WHEN 'ENROLLED' THEN rm.access_policy IN ('FREE','ENROLLED')
   WHEN 'PURCHASE' THEN rm.access_policy IN ('FREE','PURCHASE') END
UNION ALL SELECT 'EXISTING_RESOURCE_SCOPE_POLICY_CONFLICT', r.id FROM study_resources r
 JOIN study_material_backfill_map m ON m.kind='RESOURCE' AND m.legacy_id=r.id
 WHERE r.owner_user_id <> m.owner_user_id OR r.institution_id IS DISTINCT FROM m.institution_id OR r.access_policy <> m.access_policy
UNION ALL SELECT 'EXISTING_COLLECTION_SCOPE_POLICY_CONFLICT', c.id FROM resource_collections c
 JOIN study_material_backfill_map m ON m.kind='COLLECTION' AND m.legacy_id=c.id
 WHERE c.owner_user_id <> m.owner_user_id OR c.institution_id IS DISTINCT FROM m.institution_id OR c.access_policy <> m.access_policy
UNION ALL SELECT 'LEGACY_COLLECTION_OVER_CAP', r.collection_id FROM resources r
 WHERE r.collection_id IS NOT NULL GROUP BY r.collection_id HAVING count(*) > 500;
SELECT * FROM study_backfill_problems ORDER BY problem, id;
DO $$ BEGIN
 IF EXISTS (SELECT 1 FROM study_backfill_problems) THEN
   RAISE EXCEPTION 'Study material backfill preflight failed. Resolve every reported row; no legacy content was copied or discarded.';
 END IF;
END $$;
INSERT INTO resource_collections(id,title,description,owner_user_id,created_by_user_id,institution_id,access_policy,status,pin_hash,price_amount_minor,currency,created_at,updated_at)
 SELECT c.id,c.title,c.description,m.owner_user_id,m.actor_user_id,m.institution_id,m.access_policy,'DRAFT',m.pin_hash,m.price_amount_minor,m.currency,c.created_at,c.updated_at
 FROM "ResourceCollection" c JOIN study_material_backfill_map m ON m.kind='COLLECTION' AND m.legacy_id=c.id
 ON CONFLICT(id) DO NOTHING;
INSERT INTO study_resources(id,type,title,description,owner_user_id,uploaded_by_user_id,institution_id,access_policy,status,is_standalone,pin_hash,price_amount_minor,currency,created_at,updated_at)
 SELECT r.id,r.type,r.title,r.description,m.owner_user_id,m.actor_user_id,m.institution_id,m.access_policy,'DRAFT',m.is_standalone,m.pin_hash,m.price_amount_minor,m.currency,r.created_at,r.updated_at
 FROM resources r JOIN study_material_backfill_map m ON m.kind='RESOURCE' AND m.legacy_id=r.id
 ON CONFLICT(id) DO NOTHING;
INSERT INTO resource_collection_items(collection_id,resource_id,position,added_by_user_id,added_at)
 SELECT r.collection_id,r.id,(row_number() OVER (PARTITION BY r.collection_id ORDER BY r.created_at,r.id)-1)::integer,m.actor_user_id,r.created_at
 FROM resources r JOIN study_material_backfill_map m ON m.kind='RESOURCE' AND m.legacy_id=r.id
 WHERE r.collection_id IS NOT NULL
 ON CONFLICT(collection_id,resource_id) DO NOTHING;
DROP VIEW study_backfill_problems;
COMMIT;
