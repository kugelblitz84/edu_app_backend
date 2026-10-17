# Storage provider integration

Import StorageModule and inject StorageProvider. No controller or upload-completion endpoint is registered yet.

Configure CLOUDINARY_UPLOAD_PRESET with a **signed** Cloudinary upload preset. Set allowed formats to jpg,png,webp,mp4,pdf, delivery type to authenticated, and disable overwrites. Do not configure incoming format conversions, public-ID rewriting, or folder prefixes. The service signs the preset name and the individual allowed format on every request. Configure the preset before enabling uploads; this module does not modify your Cloudinary account.

Cloudinary presets do not support per-preset file size limits. Configure the account's upload usage limits where available for provider-side enforcement. CLOUDINARY_MAX_UPLOAD_BYTES (default 10485760 bytes) rejects oversized upload declarations and verified completion metadata; it cannot stop a dishonest client from transmitting a larger file before completion. A strict custom limit before Cloudinary receives bytes requires a controlled upload proxy or another provider capability, outside this direct-upload module's scope. See [upload preset restrictions](https://cloudinary.com/documentation/upload_presets) and [upload usage limits](https://cloudinary.com/documentation/upload_widget_reference). Client-side validation is only a convenience.

The initial allowlist supports JPEG, PNG, WebP, MP4 and PDF. Resource type, extension, and folder come from the server mapping. Raw PDF public IDs retain .pdf; image/video IDs omit extensions. Raw format verification checks the provider's extension metadata/public ID; it is not content scanning.

When adding the upload application service:

1. Persist fileId, expected size/type, owner, pending status and the internal reference returned by createUploadUrl. Return toUploadUrlResponseDto to the frontend.
2. On completion, accept only fileId. Authorize the user and load the pending reference from your database. Call inspect once, compare the returned sizeBytes to the saved expected size, then persist its verified reference and mark the file ready. Never accept a provider locator or format from the frontend. Reject or clean up invalid uploads.
3. For reads/deletes, authorize fileId and load the verified reference. createReadAccessUrl signs using the persisted format without an Admin API request. Signed multipart fields necessarily expose the upload public ID; frontend application operations still use fileId.

The module has no database persistence yet; the completion service must save the verified reference. StorageError codes provide a consistent boundary for future HTTP error mapping. Deletion is idempotent. Read links expire after 15 minutes; upload signatures after one hour.
