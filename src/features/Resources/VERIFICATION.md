# Verification report � October 17, 2026

Implemented and registered ResourceModule, strict HTTP DTOs and safe metadata projections, commented resource/collection/library controller endpoints, access policy rules, optional session authentication, personal/institution management, ordered collection membership, verified file activation/replacement, lifecycle states, PIN grants/rotation/revocation and durable cleanup. The shared scrypt implementation was extracted to core without changing password parameters. Prisma models now use normalized files/memberships/grants/jobs, with additive DDL, explicit legacy mapping/preflight/backfill and configuration/API/frontend documentation.

## Completed checks

| Command                                                            | Result                                                                                                   |
| ------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------- |
| `npx prisma validate`                                              | Passed                                                                                                   |
| `npx prisma generate`                                              | Passed, Prisma Client 7.9.1                                                                              |
| `npm run build`                                                    | Passed                                                                                                   |
| `npm test -- --runInBand`                                          | Passed: 34 suites, 200 tests; includes existing auth/session, password, profile, storage and exam tests  |
| `npm run test:e2e -- --runInBand`                                  | Passed: 4 suites, 25 tests; includes 19 new study-material cases and the existing health/auth/exam cases |
| `npx jest --runInBand Resources`                                   | Passed during feature development (19 policy/DTO tests)                                                  |
| `npx jest --config test/jest-e2e.json --runInBand study-materials` | Passed during development; final feature suite is included in the full e2e command above                 |
| Scoped ESLint command below                                        | Passed with zero warnings                                                                                |
| `git diff --check`                                                 | Passed                                                                                                   |

Exact scoped lint command (npm run lint was avoided because it fixes unrelated files):

```powershell
npx eslint src/features/Resources src/core/security src/core/auth/guards/access-token.guard.ts src/core/auth/guards/optional-auth.guard.spec.ts src/core/auth/decorators/optional-auth.decorator.ts src/features/auth/login/data/services/scrypt-password-verifier.service.ts src/features/auth/register/data/services/scrypt-password-hasher.service.ts src/app/app.module.ts test/study-materials test/health/app.e2e-spec.ts --max-warnings 0
```

Formatting ran with `npx prettier --write` against changed TypeScript files and new/updated documentation. Prisma formatting was inspected; unrelated schema formatting changes were removed.

The new e2e suite creates a randomly named `materials_test_<uuid>` PostgreSQL database, applies the actual additive migration, tests real relational constraints and serializable transactions, and drops only that database. The configured base database is used to create/drop this disposable database, not to modify application rows. No migration, reset or backfill was applied to the application's configured database.

Coverage includes anonymous FREE delivery; private metadata/list/count protection; enrollment state/expiry and inactive institution checks; scoped uploader/target/admin rechecks; MIME/size/profile-file spoofing; required video thumbnails; concurrent/repeated completion; failed replacements; deletion during inspection; isolated collection/child PIN grants; PIN rotation and per-user revocation races; wrong-PIN/target rate limits; incompatible policy changes; stale and simultaneous membership/reorder/publication mutations; collection-only visibility after removal; archived child suppression; combined feed pagination; invalid optional credentials; durable cleanup failures/multiple workers/restarts/late-upload follow-up; live attachment preservation; sanitized responses; and successful/failing legacy preflight/backfill with deterministic positions. Storage network calls are faked in automated tests.

The existing health e2e fixture initially failed because it imported StorageModule without required Cloudinary settings. Its isolated test configuration now supplies a dummy storage config and disables the cleanup worker; full app module construction and all e2e tests pass without account/network operations.

## Existing full-project typecheck errors

`npx tsc --noEmit --incremental false` was also run. It remains blocked by existing test typing errors in these unchanged files; there are no reported errors in the new feature or production build:

- `src/core/auth/guards/access-token.guard.spec.ts`: Express get overload mock typing (lines 29, 53).
- `src/core/auth/services/rate-limit.service.spec.ts`: Jest mock type arguments and HttpException assertion typing (lines 7, 27).
- `src/core/auth/services/session.service.spec.ts`: missing realtime configuration and expiresAt in existing fixtures (line 7 and several lines 185�326).
- `src/features/auth/register/data/services/scrypt-password-services.spec.ts`: missing mongodbUrl/realtime in its existing AppConfig fixture (line 5).
- `src/features/exams/admin-exam/data/exam.repository.spec.ts`: parameterized test tuple arity (line 189).
- `src/features/exams/exam-live/domain/usecases/start-attempt.usecase.spec.ts`: incompatible OPEN/INVITE_ONLY fixture cast (line 88).
- `src/features/exams/user-exam/domain/user-exam.usecases.spec.ts`: outdated use-case constructor dependency fixture (line 28).
- `test/auth_test/auth.e2e-spec.ts`: legacy GUEST platform role fixture (line 65).

Jest currently transpiles these existing fixtures successfully; passing Jest is not a claim that the separate full-project tsc command passes. These unrelated fixture errors were left intact.

## Deployment steps and remaining verification

Follow [migration/backfill instructions](../../../prisma/study-materials/README.md) before enabling the new routes. The migration is intentionally staged: legacy tables/URLs remain intact; ambiguous owners/PINs require explicit operator mapping, and copied legacy content remains unverified DRAFT until re-upload/review/publication. `prisma migrate deploy` alone does not apply these manual updates.

Configure Cloudinary credentials, authenticated signed preset, format restrictions, overwrite behavior and the purpose limits documented in [.env.example](../../../.env.example) and the [storage guide](../../core/storage/README.md). No account settings were changed. PDF/video defaults remain 10 MiB and are constrained by the provider cap; the profile picture cap remains 5 MiB.

Live Cloudinary upload/delivery, MP4 seeking, PDF range rendering, browser CORS/content type, server-enforced URL expiry and client refresh behavior are outstanding because required Cloudinary credential/preset configuration is incomplete here. Execute the [exact manual acceptance procedure](README.md#required-real-providerbrowser-verification-outstanding) with a nonproduction account and actual frontend origin before release. Automated fake-provider URL assertions do not verify streaming. Any necessary delivery changes must stay behind StorageProvider after that verification.

Newly issued links recheck access, but already issued bearer links may remain usable until the default 15-minute expiry. This implementation does not provide payments, malware scanning, CDN streaming guarantees or DRM.
