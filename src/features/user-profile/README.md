# Profile picture uploads

Apply `prisma/updates/20261017_profile_pictures.sql` to the PostgreSQL database before starting the updated application, then run `npx prisma generate`. This adds a dedicated upload table and a unique index allowing one current picture per user. The schema update has not been applied automatically.

Set `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`, and `CLOUDINARY_UPLOAD_PRESET` as described in `src/core/storage/README.md`. The preset must allow JPEG, PNG and WebP. Profile pictures have a 5 MiB application limit (a smaller configured storage limit also applies).

Both endpoints require the existing session authentication/CSRF handling used by other profile mutations.

1. `POST /api/v1/me/profile-picture/upload-url` with `{ "fileType": "image/jpeg", "sizeBytes": 12345 }`. Supported file types: image/jpeg, image/png, image/webp. The response contains fileId, url, method, fields and expiresAt. Keep fileId for completion. The provider reference stays on the server.
2. Send a multipart/form-data POST directly to the returned url. Include every returned field unchanged, plus the file under `file`. Let the HTTP client supply the multipart boundary.
3. `POST /api/v1/me/profile-picture/complete` with `{ "fileId": "<UUID from step 1>" }`. The server checks ownership, expiry, actual format and exact byte size before activating the picture. The response is the updated own profile with avatarUrl. Completion retries for the current picture are idempotent; replaced uploads cannot be reactivated.

`GET /api/v1/me` and the public username profile generate a fresh avatarUrl from the saved verified reference. These URLs expire after 15 minutes; fetch the profile again to renew them. Legacy avatarUrl values remain supported. Setting avatarUrl through the existing profile-update endpoint deactivates the managed avatar, including when clearing it with null.

The current avatar remains in use while a replacement uploads or fails verification. After activation, deletion of the previous managed object is attempted; cleanup failures are logged and do not undo the successful profile change. Pending/expired uploads and objects left behind by failed verification or legacy avatar updates require a future retention cleanup job. No such background job is installed by this change.
