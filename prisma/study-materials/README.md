# Study materials migration and rollout

This repository uses reviewed manual SQL under `prisma/updates/`; no checked-in Prisma migration history existed when this feature was added. `prisma.config.ts` points migrate commands at `prisma/migrations/`. **`prisma migrate deploy` does not execute files in prisma/updates.** Do not run db push or reset against an existing/production database to roll this feature out.

The new Prisma Resource model maps to `study_resources`, and ResourceCollection maps explicitly to `resource_collections`. The legacy `resources` and quoted `"ResourceCollection"` tables remain untouched, including legacy URLs, string prices, optional owners, collection IDs and any thumbnail_url column already added locally. Keeping separate new tables is the additive stage: no legacy rows are published or silently discarded. New tables have non-null real ownership/attribution FKs from the start. Existing legacy data is copied only after explicit mapping and preflight. No URL is converted into a trusted provider reference.

## Existing database sequence

1. Back up and review database/schema inventory in a staging copy. Check applied live-exam/profile-picture updates and actual table/enum names. Inspect `SELECT to_regclass('resources'), to_regclass('"ResourceCollection"');`. Use the connection's intended search_path (the repository default is public). Apply prior manual updates only when missing; do not replay non-idempotent CREATE statements blindly. This feature requires existing users, institutions, enrollments, institution_admins and shared rate_limit_buckets.
2. Apply the additive feature DDL once, using an operator-provided database URL:

   ```powershell
   npx prisma db execute --file prisma/updates/20261017_study_materials.sql
   npx prisma validate
   npx prisma generate
   ```

   `db execute` obtains its connection from prisma.config.ts/DATABASE_URL. The SQL has an explicit BEGIN/COMMIT and creates only feature tables/types/indexes/constraints. It neither rewrites nor drops the legacy tables. A missing base table, incompatible existing enum, or preexisting feature table causes a clear SQL error/rollback; reconcile manually instead of resetting. For a truly fresh installation, bootstrap the existing application schema through your established database provisioning, then apply feature DDL; do not assume migrate deploy provides that missing baseline.

3. If legacy resource/collection tables exist, initialize the mapping table:

   ```powershell
   npx prisma db execute --file prisma/study-materials/01-backfill-map.sql
   ```

   Populate `study_material_backfill_map` with one row for every legacy resource and collection. The composite key is kind RESOURCE/COLLECTION + legacy_id. A human must determine and record owner_user_id, actor_user_id, optional institution_id, access_policy, optional scrypt pin_hash/display price, and intended is_standalone. The defaults keep legacy resources collection-only until reviewed. Do not infer collection ownership from a title or the first public item, and do not invent a user to satisfy constraints. Preserve historical attribution using the correct actor. Validate institution mappings and administrative responsibility separately.

   FREE and ENROLLED mapping examples (replace UUIDs only after review):

   ```sql
   INSERT INTO study_material_backfill_map
     (kind, legacy_id, owner_user_id, actor_user_id, institution_id, access_policy, is_standalone)
   VALUES ('RESOURCE', '<legacy-uuid>', '<reviewed-owner-uuid>', '<reviewed-uploader-uuid>', NULL, 'FREE', false);
   ```

   PURCHASE needs a newly agreed PIN hashed with the application's shared adaptive scrypt settings, obtained through a secure operator workflow; do not write plaintext PINs into SQL, shell history or version control. String legacy prices must be reviewed and converted to positive integer minor units and a valid ISO currency explicitly. Mapping a policy is a reviewed remediation decision, not an automatic downgrade. Invalid or ambiguous rows must stay in the legacy tables until resolved. Legacy ARTICLE rows can be preserved as drafts; no ARTICLE publishing/editor is implemented.

4. Run the reporting preflight/backfill with a client that shows SELECT results and stops on errors:

   ```powershell
   psql "$env:DATABASE_URL" -v ON_ERROR_STOP=1 -f prisma/study-materials/02-preflight-and-backfill.sql
   ```

   If psql is unavailable, an operator can use a PostgreSQL SQL client that displays result sets and executes the whole script in its explicit transaction. `prisma db execute` can execute it but does not display the detailed SELECT report; its error still aborts the transaction. Inspect the report using a SQL client before proceeding.

   The script reports unmapped resources/collections, dangling collection IDs, invalid policy/PIN/price/scope mappings, incompatible membership and legacy collections exceeding the default 500-item cap. Any reported problem aborts before inserts. Resolve references/ownership in mappings or a reviewed legacy remediation; preserve originals/backups. If a deployment raises the configured item cap, review the SQL preflight cap consistently, never exceed the hard 1000-item API limit. Foreign keys additionally reject invalid users/institutions. No destructive removal is performed.

5. Successful backfill preserves IDs/titles/descriptions/timestamps in the new tables and migrates every valid non-null collection_id into membership rows ordered deterministically by created_at,id with zero-based positions. Both resources and collections start in DRAFT, with no ResourceFile records. Legacy metadata and URLs remain in the preserved legacy tables for review; arbitrary JSON is not exposed. Re-running the script does not overwrite new edited records. Run the backfill before permitting new writes that could conflict with legacy IDs/positions; quiesce authoring during the copy.
6. Owners/current admins must re-upload through signed intents and completion, review visibility/policies and publish resources before publishing collections. A legacy URL never satisfies ready content or video thumbnail requirements. Confirm legacy/new row counts and all membership positions in staging, then enable frontend use. Keep legacy tables and backups until an independently reviewed retirement/backfill audit is complete. There is no destructive legacy-column removal in this change.

If no legacy tables exist, steps 3�5 are unnecessary. If only one legacy table exists, inspect the actual schema and deliberately reconcile it before using the supplied script; a missing table fails explicitly rather than guessing relationships.

## SQL invariants and concurrency

The additive DDL includes FKs, policy/institution checks, PIN/display-money checks, positive versions/positions, purpose-bound exact-one upload target, exact verified size, ready/attached state constraints, and partial unique indexes for one active content/thumbnail/cover per target. Separate grant tables have real FKs. Position uniqueness and collection/resource uniqueness enforce ordered many-to-many membership. Cross-table eligibility remains in serializable application transactions sharing a consistent advisory lock; concurrent stale writers receive 409.

Prisma cannot represent all custom CHECK/partial unique indexes in its model. Preserve them in subsequent migrations. A bare db push does not replace the manual SQL constraint step. When introducing Prisma migration history later, introspect/audit the full schema including custom SQL and both legacy tables, create an explicit baseline, and mark only that reviewed baseline applied. Do not mark this update as deployed in a nonexistent migration history or generate a destructive diff that drops legacy tables.

## Verification and rollback

The PostgreSQL e2e suite builds a disposable database, applies the actual additive SQL migration, checks preflight failure and deterministic backfill, exercises HTTP and critical concurrency/file/PIN/cleanup cases, then drops only its generated test database. It never resets the configured base database. It needs permission to CREATE/DROP isolated test databases. Run:

```powershell
npx jest --config test/jest-e2e.json --runInBand study-materials
```

Rollback deployment by disabling authoring/feature routes and deploying the prior application after reviewing any newly created content. Retain all new and legacy tables/files for recovery and outstanding durable cleanup jobs. Do not drop tables or storage assets as an automatic rollback.
