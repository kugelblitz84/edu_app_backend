# Resources API — frontend integration guide

Base URL: `/api/v1`. Send `Authorization: Bearer <accessToken>` unless a route below says **optional auth**. Optional-auth routes work without a token, but use one when present to calculate viewer-specific `access` decisions.

All module responses send `Cache-Control: private, no-store`. IDs are UUIDs and timestamps are ISO-8601 strings. All successful `POST` creates return `201`; other successful API calls return `200`.

## Core contracts

### `MaterialDto`

Resources and collections share this response; only resources include `type` and `isStandalone`. Both include `isFeatured`.

```ts
type AccessPolicy = 'FREE' | 'OWNER_ONLY' | 'ENROLLED' | 'PURCHASE';
type MaterialStatus = 'DRAFT' | 'PUBLISHED' | 'ARCHIVED' | 'DELETED';

type AccessDecision =
  | { canAccess: true; source: 'FREE' | 'OWNER' | 'INSTITUTION_ADMIN' | 'ENROLLMENT' | 'RESOURCE_PIN' | 'COLLECTION_PIN' }
  | { canAccess: false; reason: 'AUTH_REQUIRED' | 'ENROLLMENT_REQUIRED' | 'PIN_REQUIRED' | 'OWNER_ONLY' | 'UNAVAILABLE' };

interface MaterialDto {
  id: string;
  kind: 'RESOURCE' | 'COLLECTION';
  type?: 'PDF' | 'VIDEO';                 // resource only
  isStandalone?: boolean;                 // resource only
  title: string;
  description: string | null;
  owner: { id: string };
  institution: { id: string } | null;
  accessPolicy: AccessPolicy;
  status: MaterialStatus;
  isFeatured: boolean;
  priceAmountMinor: number | null;
  currency: string | null;
  hasPin: boolean;
  version: number;
  metadata: {
    author?: string;
    tags?: string[];
    externalLink?: string;
  } | null;
  createdAt: string;
  updatedAt: string;
  publishedAt: string | null;
  archivedAt: string | null;
  deletedAt: string | null;
}
```

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

`GET` detail responses are `MaterialDto & { access: AccessDecision }`. Example:

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
  "accessPolicy": "PURCHASE",
  "status": "PUBLISHED",
  "priceAmountMinor": 15000,
  "currency": "BDT",
  "hasPin": true,
  "version": 3,
  "metadata": null,
  "createdAt": "2026-10-17T00:00:00.000Z",
  "updatedAt": "2026-10-17T01:00:00.000Z",
  "publishedAt": "2026-10-17T01:00:00.000Z",
  "archivedAt": null,
  "deletedAt": null,
  "access": { "canAccess": false, "reason": "PIN_REQUIRED" }
}
```

### Shared result DTOs

```ts
interface PageDto<T> {
  list: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}
interface UploadIntentDto {
  fileId: string;
  url: string;
  method: 'POST';
  fields: Record<string, string>;
  expiresAt: number; // Unix seconds
}
interface CompletionDto { fileId: string; completed: true; version?: number }
interface MediaDto {
  resourceId?: string; // present for content delivery
  fileId: string;
  type?: 'PDF' | 'VIDEO'; // present for content delivery
  mimeType: string;
  url: string;
  expiresAt: number; // Unix seconds
  accessSource?: 'FREE' | 'OWNER' | 'INSTITUTION_ADMIN' | 'ENROLLMENT' | 'RESOURCE_PIN' | 'COLLECTION_PIN';
}
```

Example page response:

```json
{ "list": [{ "id": "33333333-3333-4333-8333-333333333333", "kind": "RESOURCE", "type": "PDF", "isStandalone": true, "title": "Physics notes", "description": null, "owner": { "id": "44444444-4444-4444-8444-444444444444" }, "institution": null, "accessPolicy": "FREE", "status": "PUBLISHED", "priceAmountMinor": null, "currency": null, "hasPin": false, "version": 2, "metadata": null, "createdAt": "2026-10-17T00:00:00.000Z", "updatedAt": "2026-10-17T00:00:00.000Z", "publishedAt": "2026-10-17T00:00:00.000Z", "archivedAt": null, "deletedAt": null }], "total": 1, "page": 1, "limit": 20, "totalPages": 1 }
```

## Rules the client must observe

- Every management mutation includes the current positive integer `version`; success returns a new `MaterialDto` with the incremented version. Reload and retry after `409`.
- `PDF` content is `application/pdf`; `VIDEO` content is `video/mp4`. Video publication also needs an uploaded JPEG, PNG, or WebP thumbnail. Collection covers use the same image MIME types.
- Title: 1–200 characters. Description: at most 10,000. Metadata allows only `author` (160), up to 20 `tags` (40 each), and an HTTP(S) `externalLink` (2,000).
- `ENROLLED` requires `institutionId`; `OWNER_ONLY` and `PURCHASE` must be personal (no `institutionId`). `PURCHASE` requires a 6–12 digit string PIN; prices are positive minor units and default to `BDT` when supplied.
- Non-standalone resources are only delivered through a collection route. Keep `collectionId` in resource detail/thumbnail calls when rendering a collection item.
- Public catalogs contain only published material. Owner libraries include personal drafts, archived, private, and collection-only records; institution management feeds require a current admin. Deleted items are never discoverable or deliverable.
- `FREE` can be read anonymously; `OWNER_ONLY` only by its personal owner; `ENROLLED` by a current admin or active enrollment in the exact active institution; `PURCHASE` by its owner or a user who has unlocked that exact target.
- Collection members are references, not copies. Personal collection members must share the owner. Institution members must share the institution. Policy compatibility is enforced on add, policy change, and publication: FREE collections allow FREE; OWNER_ONLY allows its owner’s resources; ENROLLED allows same-institution FREE/ENROLLED; PURCHASE allows its owner’s FREE/PURCHASE resources.
- A collection PIN unlocks compatible child delivery only through `/resource-collections/:id/items/:resourceId/access`; it does not unlock standalone resource routes. A child resource PIN does not unlock the collection.

## Compound process: create, upload, complete, publish

The backend never accepts content bytes. The browser uploads directly to the returned storage URL.

1. **Create the draft** — `POST /resources`.

```json
{ "title": "Lesson 1", "type": "VIDEO", "accessPolicy": "FREE", "metadata": { "tags": ["mechanics"] } }
```

It returns `MaterialDto` with `status: "DRAFT"` and `version: 1`.

2. **Request one upload intent per attachment** — `POST /resources/:id/uploads`.

```json
{ "version": 1, "purpose": "RESOURCE_CONTENT", "fileType": "video/mp4", "sizeBytes": 1048576 }
```

For a video, also request `{"version":1,"purpose":"RESOURCE_THUMBNAIL","fileType":"image/webp","sizeBytes":50000}`. Intent creation does not increment `version`.

```json
{ "fileId": "55555555-5555-4555-8555-555555555555", "url": "https://provider.example/upload", "method": "POST", "fields": { "api_key": "…", "signature": "…", "timestamp": "1792195200" }, "expiresAt": 1792198800 }
```

3. **Upload directly to storage** — build `FormData` from every returned `fields` entry, then append `file`. `fetch(intent.url, { method: intent.method, body: formData })`. Do not add an `Authorization` header or manually set `Content-Type`; keep the returned fields unchanged. Do not send the provider result to this API.

4. **Complete each attachment** — `POST /resources/:id/uploads/:fileId/complete` with the same current version. Complete the content first; use the returned version for the thumbnail completion.

```json
{ "version": 1 }
```

```json
{ "fileId": "55555555-5555-4555-8555-555555555555", "completed": true, "version": 2 }
```

Successful replay for the still-attached file can return `{ "fileId": "…", "completed": true }` without `version`.

5. **Publish** — after all required completions, `POST /resources/:id/publish` with the latest version. It returns the published `MaterialDto`. PDFs require content; videos require content plus thumbnail.

For a collection, create with `POST /resource-collections`, request its cover through `POST /resource-collections/:id/cover-uploads`, direct-upload it, then call `/cover-uploads/:fileId/complete`. Add already-created resource IDs, publish those resources, and only then publish the non-empty collection.

## Resource endpoints

| Method and path | Auth | Request | Response |
| --- | --- | --- | --- |
| `POST /resources` | owner / institution admin | Create input below | `MaterialDto` (draft) |
| `GET /resources` | optional | Public query | `PageDto<MaterialDto>` |
| `GET /resources/:id` | optional | `?collectionId=uuid` optional | detail DTO |
| `PATCH /resources/:id` | manager | update input | `MaterialDto` |
| `POST /resources/:id/uploads` | manager | upload input | `UploadIntentDto` |
| `POST /resources/:id/uploads/:fileId/complete` | manager/uploader | `{version}` | `CompletionDto` |
| `POST /resources/:id/publish`, `/archive`, `/unarchive` | manager | `{version}` | `MaterialDto` |
| `DELETE /resources/:id` | manager | `{version}` | deleted `MaterialDto` |
| `GET /resources/:id/thumbnail` | optional | `?collectionId=uuid` optional | `MediaDto` |
| `POST /resources/:id/access` | optional | none | content `MediaDto` |
| `POST /resources/:id/preview` | manager | none | content `MediaDto` |
| `POST /resources/:id/unlock` | authenticated | `{pin}` | `{ "unlocked": true, "expiresAt": null }` |
| `PUT /resources/:id/unlock-pin` | personal PURCHASE owner | `{version,pin}` | `MaterialDto` |
| `DELETE /resources/:id/unlocks/:userId` | personal PURCHASE owner | `{version}` | `MaterialDto` |

Create input (`type` is required; `accessPolicy` is always required):

```json
{ "title": "Physics notes", "description": "Mechanics", "type": "PDF", "accessPolicy": "FREE", "isStandalone": true, "metadata": { "author": "Tutor", "tags": ["physics"], "externalLink": "https://example.com/lesson" } }
```

To create an item and attach it to a draft collection atomically, include `collectionId`, its current `collectionVersion`, and normally `isStandalone: false`.

```json
{ "title": "Lesson 1", "type": "VIDEO", "accessPolicy": "PURCHASE", "pin": "001234", "collectionId": "22222222-2222-4222-8222-222222222222", "collectionVersion": 1, "isStandalone": false }
```

`PATCH` accepts only any subset of the create fields (except `type`, `institutionId`, `collectionId`, and `collectionVersion`) plus `version`. Example: `{ "version": 2, "title": "Revised notes", "isStandalone": false }`.

## Collection endpoints

| Method and path | Auth | Request | Response |
| --- | --- | --- | --- |
| `POST /resource-collections` | owner / institution admin | collection create input | collection `MaterialDto` (draft) |
| `GET /resource-collections` | optional | Public query | `PageDto<MaterialDto>` |
| `GET /resource-collections/:id` | optional | none | collection detail DTO |
| `PATCH /resource-collections/:id` | manager | update input | `MaterialDto` |
| `POST /resource-collections/:id/cover-uploads` | manager | `{version,fileType,sizeBytes}` | `UploadIntentDto` |
| `POST /resource-collections/:id/cover-uploads/:fileId/complete` | manager/uploader | `{version}` | `CompletionDto` |
| `GET /resource-collections/:id/cover` | optional | none | image `MediaDto` |
| `GET /resource-collections/:id/items` | optional | `?page=1&limit=20` | `PageDto<MaterialDto & {position:number}>` |
| `GET /resource-collections/:id/items/:resourceId` | optional | none | resource detail DTO, in this collection context |
| `POST /resource-collections/:id/items` | manager | `{version,resourceId,position?}` | collection `MaterialDto` |
| `DELETE /resource-collections/:id/items/:resourceId` | manager | `{version}` | collection `MaterialDto` |
| `PUT /resource-collections/:id/items/order` | manager | `{version,resourceIds}` | collection `MaterialDto` |
| `POST /resource-collections/:id/items/:resourceId/access` | optional | none | content `MediaDto` |
| `POST /resource-collections/:id/publish`, `/archive`, `/unarchive` | manager | `{version}` | collection `MaterialDto` |
| `DELETE /resource-collections/:id` | manager | `{version}` | deleted collection `MaterialDto` |
| `POST /resource-collections/:id/unlock` | authenticated | `{pin}` | `{ "unlocked": true, "expiresAt": null }` |
| `PUT /resource-collections/:id/unlock-pin` | personal PURCHASE owner | `{version,pin}` | `MaterialDto` |
| `DELETE /resource-collections/:id/unlocks/:userId` | personal PURCHASE owner | `{version}` | `MaterialDto` |

Collection creation is the resource create input without `type`, `isStandalone`, `collectionId`, or `collectionVersion`:

```json
{ "title": "Mechanics course", "accessPolicy": "PURCHASE", "pin": "009999", "priceAmountMinor": 50000, "currency": "BDT" }
```

For reorder, `resourceIds` must be the complete current membership exactly once, in the desired zero-based order:

```json
{ "version": 4, "resourceIds": ["66666666-6666-4666-8666-666666666666", "33333333-3333-4333-8333-333333333333"] }
```

## Library and discovery endpoints

| Method and path | Auth | Query | Response |
| --- | --- | --- | --- |
| `GET /me/resources` | required | management query | `PageDto<MaterialDto>` |
| `GET /me/resource-collections` | required | management query | `PageDto<MaterialDto>` |
| `GET /institutions/:institutionId/resources` | optional | public query | `PageDto<MaterialDto>`; mixed resources and collections |
| `GET /institutions/:institutionId/resources/manage` | current institution admin | management query | `PageDto<MaterialDto>`; mixed resources and collections |

Public query parameters: `page` (default 1), `limit` (default 20, max 100), `search`, `type=PDF|VIDEO`, `institutionId`, `accessPolicy=FREE|OWNER_ONLY|ENROLLED|PURCHASE`, `isFeatured=true|false`, and `sort=newest|oldest|title`. Management queries additionally accept `status=DRAFT|PUBLISHED|ARCHIVED`.

Use the existing catalogs to hydrate featured content: `GET /resources?isFeatured=true` returns featured standalone videos and books (PDF resources), and `GET /resource-collections?isFeatured=true` returns featured collections. Both routes retain their normal published/public visibility rules and pagination. `GET /institutions/:institutionId/resources?isFeatured=true` filters the combined institution feed.

Only a `GLOBAL_ADMIN` can change featured status. Send `PATCH /resources/:id` or `PATCH /resource-collections/:id` with the current `version` and `isFeatured`; for example `{ "version": 3, "isFeatured": true }`. The response is the updated `MaterialDto` with an incremented version. Feature status is independent of publish status; only published records appear in public catalogs.

## Access and error handling

- Use a detail response’s `access` solely to choose UI state. Always call an access endpoint to obtain a playable/viewable URL, because authorization is checked again.
- Content/cover/thumbnail URLs expire (`expiresAt`, currently issued for about 15 minutes). Renew by calling the relevant API endpoint; do not cache signed URLs as permanent state.
- `401` means authentication is required. `403` means the account lacks entitlement, manager rights, or gave a wrong PIN. `404` intentionally hides inaccessible, deleted, or invalid-context records. `409` means stale version, invalid lifecycle state, incompatible collection policy, or missing publication prerequisite. `429` can occur on upload/PIN rate limits.
- Validation failures are `400` and include `{ "message": "Invalid request.", "violations": ["…"] }`. UUID route parameters also return `400` when malformed.
