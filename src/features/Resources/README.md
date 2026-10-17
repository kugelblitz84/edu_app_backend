# Study materials API

All routes below use `/api/v1`. Send `Authorization: Bearer <accessToken>` on authenticated calls. Optional-auth routes allow an absent header; supplied malformed, expired or revoked credentials return 401 through the existing token/session guard. Existing `@Public()` routes retain their existing behavior. Every materials response uses `Cache-Control: private, no-store`; never cache signed links, PINs, or viewer-specific decisions in a public cache.

## Ownership and policies

Creation assigns ownership and upload/creation attribution from the authenticated actor. Personal records can be managed only by their owner. Institution records require a current administrator of the exact ACTIVE institution on every mutation. Enrollment grants reading, never upload/edit rights. Scope, type, ownership and attribution cannot be changed through PATCH. GLOBAL_ADMIN has no implicit personal-content or PIN bypass. A former institution admin loses preview rights, even for their own historical uploads. Institution content is unavailable while the institution is inactive.

| Policy     | Published metadata  | Main content                                                                                           |
| ---------- | ------------------- | ------------------------------------------------------------------------------------------------------ |
| FREE       | Public              | Anonymous                                                                                              |
| OWNER_ONLY | Personal owner only | Personal owner                                                                                         |
| ENROLLED   | Public              | Current institution admin or ACTIVE enrollment with null/future expiry in the exact ACTIVE institution |
| PURCHASE   | Public              | Personal owner or authenticated exact-target PIN grant                                                 |

ENROLLED requires institutionId. OWNER_ONLY and PURCHASE reject institutionId. FREE can be personal or institutional. PURCHASE means PIN-gated access; there is no payment, order or sales entitlement.

Draft, archived and deleted content is excluded from public discovery and counts. Owners/current institution managers can fetch individual drafts/archives and preview ready content. Private and nonpublic lookups return 404. Otherwise discoverable protected media returns 401 when authentication is absent and 403 when enrollment or PIN entitlement is missing. Deleted records have no preview/delivery route.

A resource defaults to `isStandalone: true`, or false when created with collectionId. Nonstandalone records are excluded from standalone discovery and direct media access, including for owners (use `/preview` while editing). They remain visible to managers by ID and through visible collection metadata. Removing their last membership never changes isStandalone. Set it explicitly through PATCH to expose them independently.

## Collections and bundles

Collections are ordered playlists or mixed PDF/video collections; there is no nesting or separate playlist type. Adding a member never copies its file or changes its policy/standalone visibility. Personal members must share the collection owner; institution members must share its institution. Adding another person's public upload is not bookmarking.

| Collection policy | Eligible resource policies in matching scope                     |
| ----------------- | ---------------------------------------------------------------- |
| FREE              | FREE                                                             |
| OWNER_ONLY        | Any policy from the same personal owner                          |
| ENROLLED          | Institution-affiliated FREE or ENROLLED in that same institution |
| PURCHASE          | FREE or PURCHASE from the same personal owner                    |

The matrix is checked on membership insertion, publication and policy changes inside the same serialization boundary. Conflicting policy updates return 409 with conflictingIds. Remove those memberships first. A valid collection PIN grants access to its compatible published items only when requesting the collection item access route. It includes later eligible additions. It does not grant standalone access or access through another collection. A child PIN grant does not unlock its parent. There is no fallback to another grant/context when the explicitly requested collection is locked. FREE standalone children retain direct FREE access even inside a locked collection.

A collection needs at least one item on publication; every included item must be published, policy-compatible and ready. Published collections accept only already-published ready existing resources. To upload new lessons, create them in a draft collection and publish resources before publishing the collection. Archiving/deleting a child immediately removes it from public item lists/counts and blocks its collection delivery. It does not delete the parent. Deleting a collection schedules only its cover cleanup and retains all child resources.

## Routes

Unless marked optional, routes require authentication and the ownership/admin checks above. `version` is required in the JSON body for every management mutation, including DELETE, upload issuance/completion and grant revocation. UUID route parameters are validated. POST returns 201, GET/PATCH/PUT/DELETE return 200. Successful write responses return safe metadata with the new version; reload detail after completion to obtain current state.

| Method / path                                                 | Authentication and result                                                                   |
| ------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| POST /resources                                               | Create draft: owner/current institution admin                                               |
| PATCH /resources/:id                                          | Edit metadata, policy, price or standalone visibility                                       |
| POST /resources/:id/uploads                                   | Create CONTENT/THUMBNAIL direct-upload intent                                               |
| POST /resources/:id/uploads/:fileId/complete                  | Upload actor who still manages the resource; inspect and activate                           |
| POST /resources/:id/publish                                   | DRAFT ? PUBLISHED; verified content and video thumbnail required                            |
| POST /resources/:id/archive                                   | PUBLISHED ? ARCHIVED                                                                        |
| POST /resources/:id/unarchive                                 | ARCHIVED ? DRAFT; does not republish                                                        |
| DELETE /resources/:id                                         | Soft-delete; terminal; queue content/thumbnail and pending upload cleanup                   |
| GET /resources                                                | Optional auth; public published standalone catalog                                          |
| GET /resources/:id                                            | Optional auth; safe metadata; optional `?collectionId=uuid`                                 |
| GET /me/resources                                             | Personal owner library; includes collection-only, draft, private, archived records          |
| GET /institutions/:institutionId/resources                    | Optional auth; combined public resource + collection feed                                   |
| GET /institutions/:institutionId/resources/manage             | Current institution admin; combined management feed                                         |
| POST /resources/:id/access                                    | Optional auth; standalone inline PDF/MP4 link                                               |
| POST /resources/:id/preview                                   | Current manager; ready content, including DRAFT/ARCHIVED                                    |
| GET /resources/:id/thumbnail                                  | Optional auth; safe metadata visibility; optional `?collectionId=uuid`                      |
| POST /resources/:id/unlock                                    | Authenticated; verify PIN; rate-limited                                                     |
| PUT /resources/:id/unlock-pin                                 | Personal PURCHASE owner; rotate PIN                                                         |
| DELETE /resources/:id/unlocks/:userId                         | Personal PURCHASE owner; revoke one user's grant                                            |
| POST /resource-collections                                    | Create a collection draft                                                                   |
| PATCH /resource-collections/:id                               | Edit metadata, policy or display price                                                      |
| POST /resource-collections/:id/cover-uploads                  | Create an image cover upload intent                                                         |
| POST /resource-collections/:id/cover-uploads/:fileId/complete | Upload actor/current manager; inspect and activate cover                                    |
| POST /resource-collections/:id/items                          | Add existing eligible resourceId, optionally at zero-based position                         |
| DELETE /resource-collections/:id/items/:resourceId            | Membership removal only                                                                     |
| PUT /resource-collections/:id/items/order                     | Exact full resource ID permutation; atomic                                                  |
| GET /resource-collections                                     | Optional auth; public published catalog                                                     |
| GET /resource-collections/:id                                 | Optional auth; safe metadata; manager draft/archive detail                                  |
| GET /resource-collections/:id/items                           | Optional auth; ordered safe metadata with pagination; managers can inspect unfinished items |
| GET /resource-collections/:id/items/:resourceId               | Optional auth; child's safe detail in the exact collection context                          |
| GET /me/resource-collections                                  | Personal owner's collections, including private/drafts/archives                             |
| GET /resource-collections/:id/cover                           | Optional auth; cover visibility follows metadata                                            |
| POST /resource-collections/:id/items/:resourceId/access       | Optional auth; authorized published collection + current membership + published ready child |
| POST /resource-collections/:id/unlock                         | Authenticated; rate-limited collection PIN verification                                     |
| PUT /resource-collections/:id/unlock-pin                      | Personal PURCHASE owner; rotate PIN                                                         |
| DELETE /resource-collections/:id/unlocks/:userId              | Personal PURCHASE owner; revoke one grant                                                   |
| POST /resource-collections/:id/publish                        | Validate all members, then DRAFT ? PUBLISHED                                                |
| POST /resource-collections/:id/archive                        | PUBLISHED ? ARCHIVED                                                                        |
| POST /resource-collections/:id/unarchive                      | ARCHIVED ? DRAFT                                                                            |
| DELETE /resource-collections/:id                              | Terminal soft deletion; children retained                                                   |

Publish/archive/unarchive are explicit transitions. Repeating them returns 409 (stale version or invalid source state). DELETE is idempotent for an authorized manager after deletion and returns the deleted metadata without another version increment. Repeated successful completion returns success only while that file remains the current attachment; it cannot reactivate a replaced file. Simultaneous successful completion converges to the same attachment. A version conflict requires reloading and retrying with the current version. Completion is a server-side state check; it does not publish.

## Request/response examples

Create a standalone PDF with POST /resources:

```json
{
  "title": "Physics notes",
  "description": "Mechanics",
  "type": "PDF",
  "accessPolicy": "FREE",
  "isStandalone": true,
  "metadata": { "author": "Tutor", "tags": ["physics"] }
}
```

Create a PIN-gated video:

```json
{
  "title": "Lesson 1",
  "type": "VIDEO",
  "accessPolicy": "PURCHASE",
  "pin": "001234",
  "priceAmountMinor": 15000,
  "currency": "BDT"
}
```

Create an institution draft (resource or collection; collections omit type):

```json
{
  "title": "Calculus",
  "type": "PDF",
  "accessPolicy": "ENROLLED",
  "institutionId": "11111111-1111-4111-8111-111111111111"
}
```

Create a collection with POST /resource-collections:

```json
{
  "title": "Mechanics course",
  "accessPolicy": "PURCHASE",
  "pin": "009999",
  "priceAmountMinor": 50000,
  "currency": "BDT"
}
```

Upload directly into a collection with POST /resources (collectionVersion is mandatory with collectionId):

```json
{
  "title": "Lesson 1",
  "type": "VIDEO",
  "accessPolicy": "PURCHASE",
  "pin": "001234",
  "collectionId": "22222222-2222-4222-8222-222222222222",
  "collectionVersion": 1,
  "isStandalone": false
}
```

Every creation explicitly requires accessPolicy. `ARTICLE` is preserved in the database enum but new ARTICLE uploads/publication are rejected. Titles have 1�200 trimmed characters, descriptions at most 10,000. Metadata is limited to author (160), up to 20 tags (40 characters each) and an optional descriptive HTTP(S) externalLink (2,000). External links are never trusted storage references. Owner, attribution, role, scope changes, URLs and arbitrary metadata fields are rejected by strict validation.

Example resource metadata response (actual timestamps are ISO strings):

```json
{
  "id": "33333333-3333-4333-8333-333333333333",
  "kind": "RESOURCE",
  "type": "PDF",
  "isStandalone": true,
  "title": "Physics notes",
  "description": "Mechanics",
  "owner": { "id": "44444444-4444-4444-8444-444444444444" },
  "institution": null,
  "accessPolicy": "FREE",
  "status": "DRAFT",
  "priceAmountMinor": null,
  "currency": null,
  "hasPin": false,
  "version": 1,
  "metadata": { "author": "Tutor", "tags": ["physics"] },
  "createdAt": "2026-10-17T00:00:00.000Z",
  "updatedAt": "2026-10-17T00:00:00.000Z",
  "publishedAt": null,
  "archivedAt": null,
  "deletedAt": null
}
```

Individual details additionally contain `access`, e.g. `{"canAccess":false,"reason":"PIN_REQUIRED"}` or `{"canAccess":true,"source":"FREE"}`. Reasons: AUTH_REQUIRED, ENROLLMENT_REQUIRED, PIN_REQUIRED, OWNER_ONLY, UNAVAILABLE. These are a UI hint; every link request authorizes again. Collection-context detail uses the requested collection's entitlement. Draft editing uses the authenticated preview route.

Upload intent POST /resources/:id/uploads:

```json
{
  "version": 1,
  "purpose": "RESOURCE_CONTENT",
  "fileType": "application/pdf",
  "sizeBytes": 1048576
}
```

For videos use video/mp4. Thumbnail purpose is RESOURCE_THUMBNAIL and MIME is image/jpeg, image/png or image/webp. A cover intent has `{"version":1,"fileType":"image/png","sizeBytes":1000}`; the cover route fixes its purpose server-side.

```json
{
  "fileId": "55555555-5555-4555-8555-555555555555",
  "url": "https://provider.example/upload",
  "method": "POST",
  "fields": { "signature": "provider-signature", "timestamp": "1792195200" },
  "expiresAt": 1792198800
}
```

Send every returned field unchanged in multipart FormData plus `file`, directly to url. Fields necessarily contain the signed provider upload parameters; keep using the application fileId for application operations. Do not set multipart Content-Type manually. The backend never receives the file bytes through these endpoints.

Completion POST /resources/:id/uploads/:fileId/complete:

```json
{ "version": 1 }
```

Only the route's application fileId identifies the upload; the body contains concurrency control only. Provider responses, client locators, declared completion sizes and URLs are rejected. Response: `{"fileId":"55555555-5555-4555-8555-555555555555","completed":true,"version":2}`. An idempotent replay can omit version in its response; refresh resource detail before the next mutation. Intent creation does not increment the target version; completion does. Failed replacement retains the previous valid attachment.

Add existing POST /resource-collections/:id/items:

```json
{
  "version": 3,
  "resourceId": "33333333-3333-4333-8333-333333333333",
  "position": 0
}
```

Reorder PUT /resource-collections/:id/items/order:

```json
{
  "version": 4,
  "resourceIds": [
    "66666666-6666-4666-8666-666666666666",
    "33333333-3333-4333-8333-333333333333"
  ]
}
```

Remove membership DELETE /resource-collections/:id/items/:resourceId, lifecycle POSTs, soft DELETEs and grant revocations all carry `{"version":5}`. Positions are contiguous zero-based integers after mutations. Duplicate membership, out-of-bounds position, duplicate IDs, partial reorder and stale versions return errors without partial writes. Adding/removing/reordering increments the collection version; collection-associated draft creation does too. Reordering does not invalidate PIN grants.

Unlock POST /resources/:id/unlock (or collection equivalent):

```json
{ "pin": "001234" }
```

Response `{"unlocked":true,"expiresAt":null}`. PIN is a string of 6�12 digits; leading zeroes are retained. Salted adaptive scrypt hashing is shared with the password implementation and verification is constant-time. Responses contain only hasPin, never plaintext/hash or grants. Attempts are database-rate-limited before hashing by user/target and request IP. The trusted reverse proxy must supply the actual request IP; the app's production trust-proxy configuration applies. Wrong PIN: generic 403; excessive attempts: 429.

Rotate with PUT /resources/:id/unlock-pin, body `{"pin":"008888","version":5}`. Rotation and policy/lifecycle changes increment unlockVersion. Grants are persistent, exact-target, user-bound PIN grants with no default expiry; version changes, explicit revocation and current availability are checked on every read. A concurrent rotation cannot grant access from a previously verified PIN. Policy switch to PURCHASE requires its PIN in the same PATCH. Switching away clears PIN and display price, invalidating prior grants. Title/description edits do not revoke grants. Display prices are optional positive integer minor units; currency defaults to BDT when a price is present and must be an accepted ISO currency code. Other policies have no price/PIN.

Media POST /resources/:id/access or POST /resource-collections/:id/items/:resourceId/access has no request body:

```json
{
  "resourceId": "33333333-3333-4333-8333-333333333333",
  "fileId": "55555555-5555-4555-8555-555555555555",
  "type": "PDF",
  "mimeType": "application/pdf",
  "url": "https://provider.example/expiring-inline-url",
  "expiresAt": 1792196100,
  "accessSource": "FREE"
}
```

accessSource is FREE, OWNER, INSTITUTION_ADMIN, ENROLLMENT, RESOURCE_PIN or COLLECTION_PIN. Image responses contain fileId, mimeType, url and expiresAt. Metadata/list/item endpoints contain no full-content URLs, storage references, PIN hashes, uploader email or arbitrary internal JSON. All upload/read expiresAt values are Unix seconds, not milliseconds. Standard metadata lifecycle dates are ISO timestamps.

## Pagination and errors

Catalog queries: page (default 1, maximum 100000), limit (default 20, maximum 100), search, type (PDF/VIDEO), institutionId, accessPolicy, sort (newest/oldest/title). Unknown keys are rejected. Management listings additionally allow status DRAFT/PUBLISHED/ARCHIVED; public queries reject status and owner overrides. Collection items accept only page/limit and always use item position order. Catalog sort has an ID tiebreaker. The combined institution feed sorts/paginates/counts a single UNION result, with `kind: RESOURCE | COLLECTION`. A type filter selects resources of that type. Personal library endpoints list personal records; institution uploads are managed through the separate institution management feed.

```json
{ "list": [], "page": 1, "limit": 20, "total": 0, "totalPages": 0 }
```

400: invalid/unknown fields, UUID/MIME/size/PIN format, incompatible policy scope. 401: missing or invalid authentication. 403: discoverable content lacks entitlement, inactive access context or wrong PIN. 404: absent, private/nonpublic or wrong scoped target. 409: stale version, invalid transition, incompatible membership, unfinished publication, expired/detached upload, upload/collection cap. 429: PIN/intent/provider limits. 503: storage unavailable. Provider NOT_FOUND during completion returns 404 and permits retry before intent expiry. Invalid verified bytes queue the new upload for cleanup. Standard Nest errors contain statusCode, message and error; conflicts can include currentVersion or conflictingIds. Never put raw PINs or signed URLs in request/application/proxy logs.

## Frontend sequences

1. Standalone PDF: create draft ? create content intent ? POST multipart directly ? complete with current version ? fetch detail ? publish with current version ? request `/access` when opening the viewer.
2. Standalone VIDEO: create ? content upload/complete ? refresh version ? thumbnail upload/complete ? refresh ? publish. A remote thumbnail URL or pending image cannot satisfy publication.
3. Course: create a draft collection ? create each resource with collectionId/collectionVersion, explicit child policy and optional isStandalone ? upload/complete required attachments ? publish each child ? refresh parent version ? publish collection. Membership insertion changes parent version; attachment completion changes resource version.
4. Add existing: load collection version and eligible own/institution uploads ? POST items ? replace local version from response. One upload can appear in several eligible collections.
5. Reorder/remove: fetch all current IDs via paginated manager item listing and current parent version ? PUT exact order or DELETE membership with version. On 409 reload; never merge a stale complete order blindly. Removal retains files and standalone visibility.
6. Enrollment denial: show public ENROLLED metadata; prompt login on 401, enrollment help on ENROLLMENT_REQUIRED/403. ACTIVE status alone is insufficient if membership expired or the institution is inactive. Do not trust client membership flags.
7. PIN: show metadata ? login ? submit string PIN to the exact resource/collection unlock route ? retry the exact corresponding access route. Store no PIN or assumed entitlement in a public cache; collection grants never substitute for child grants on direct routes.
8. Link refresh: compare Date.now()/1000 to expiresAt; request a fresh authorized link before expiry. For MP4, save currentTime, replace src, reload, and restore position after metadata loads. For PDF, refresh the viewer source while preserving page state if the viewer supports it. On refresh denial stop requesting new bytes and show the current access reason.

## Configuration, storage and cleanup

See `.env.example` and the [storage setup](../../core/storage/README.md). Defaults: PDF/video 10 MiB; images 5 MiB; collection length 500 (hard maximum configurable to 1000); one resource in at most 100 collections; 10 pending uploads per actor; 30 intent requests/hour per actor; 5 PIN attempts per user/target and 30 per IP per 15 minutes. The effective upload cap is the smaller of the purpose limit and provider cap. Raising the shared Cloudinary cap does not raise the existing 5 MiB profile picture limit. Large-video chunked upload is not implemented.

Pending intents persist exact server-side references, expected MIME/bytes, uploader, target and purpose. Inspection validates provider metadata and exact size, not malware or safe PDF content. Pending upload state is separate from publication. Activation and deletion use the same short transaction boundary; storage calls occur outside transactions. Current attachments remain valid until a replacement is verified and committed.

The durable cleanup worker polls every 30 seconds, claims at most 20 jobs with SKIP LOCKED and claim tokens, reclaims stale claims after 10 minutes, and retries failures with bounded exponential backoff (maximum one day). Tombstones/references remain in PostgreSQL. It sweeps expired pending intents. Rejected, replaced and soft-deleted attachments are queued transactionally. It skips attached files, never deletes a child on membership removal, and tolerates NOT_FOUND deletion. Earliest deletion is upload expiry + one-hour grace; a second deletion pass one grace period later catches late uploads. A pre-expiry NOT_FOUND is never treated as final cleanup. Workers can run on multiple instances and resume durable jobs after restart.

Feature reads/mutations currently share a PostgreSQL advisory lock plus serializable transactions with bounded retries, favoring invariant correctness at modest write volume. No network calls hold that lock. This is a deliberate throughput limit; load testing and narrower lock partitioning would be needed for high-volume authoring.

Read URLs currently expire after 900 seconds; upload signatures after 3600. Revocation, PIN rotation, archiving and deletion block newly issued links, but previously issued bearer links may remain usable until expiry, and already delivered bytes cannot be recalled. The default exposure window is up to 15 minutes; this is access control, not DRM. Cloudinary's expiring API download links bypass CDN caching and have a bandwidth tradeoff, as documented in [Cloudinary media access controls](https://cloudinary.com/documentation/control_access_to_media#providing_time_limited_access_to_private_media_assets). Permanent public URLs or ordinary signed transformation links are not substitutes for expiry.

## Required real-provider/browser verification (outstanding)

Automated integration tests use real isolated PostgreSQL and a fake storage provider. They prove authorization, migration and transactional lifecycle behavior, not Cloudinary account enforcement or browser playback. The required Cloudinary credential/preset configuration is incomplete in this environment; no real-account uploads or browser playback verification ran.

After configuring a nonproduction account/preset, execute both PDF and MP4+thumbnail frontend sequences from the actual allowed application origin:

1. Confirm authenticated delivery type, signed preset, allowed formats and overwrite=false in the account. Keep API secret server-side. Upload a PDF, JPEG/PNG/WebP and an MP4 within the smaller configured cap. Complete successfully; verify wrong size/MIME is rejected and cleanup jobs exist.
2. Use the issued MP4 URL in `<video controls>` and PDF URL in a browser PDF viewer. Confirm inline disposition and Content-Type video/mp4 or application/pdf, readable CORS responses and no mixed-origin error. Record actual provider response headers without persisting the signed query string.
3. In DevTools seek to the middle of the MP4; confirm successful range requests, 206 Partial Content, appropriate Content-Range and playable seeking. Test PDF range loading with a viewer that requests ranges. From a private terminal, `curl.exe -D headers.txt -H "Range: bytes=0-1023" -o range.bin "$mediaUrl"` should retrieve the expected partial bytes. Do not commit headers or URLs.
4. After expiresAt, verify a fresh request to the old URL fails; request a new link and confirm playback/viewing resumes with position/page retained. Test URL query tampering and anonymous requests to the authenticated original; they must fail. Test from the production frontend origin with its actual CORS configuration.
5. Revoke enrollment/grant, rotate PIN, archive and delete separately; new access calls must fail. Old issued URLs are allowed their documented remaining lifetime. Confirm draft/publication/thumbnail visibility from another user and an anonymous browser.
6. Replace a file and verify old content stays readable until completion, then new requests use the new file. Let one signed intent expire without completion and run multiple cleanup workers; confirm late-upload second-pass cleanup and retained tombstones.

If expiring API URLs do not support the required MP4/PDF range/CORS behavior for the configured account, release delivery only after adding a tested provider capability behind StorageProvider. No CDN streaming guarantee is made by URL generation tests. Do not remove expiry or move content to public delivery to work around a failed check.
