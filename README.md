# Edu App Backend

A lightweight feature-first Clean Architecture foundation for NestJS.

## Structure

```text
src/
├── app/
│   ├── app.module.ts          # Root composition module
│   └── bootstrap.ts           # HTTP/framework startup configuration
├── core/
│   ├── config/                # Framework-wide configuration
│   ├── database/              # Future ORM/client and migration wiring
│   └── errors/                # Shared domain/application errors
├── features/
│   └── health/
│       ├── domain/
│       │   ├── contracts/     # Abstract ports required by use cases
│       │   ├── entities/      # Business objects and invariants
│       │   └── use-cases/     # Application behaviour
│       ├── data/
│       │   └── providers/     # Infrastructure implementations
│       ├── presentation/
│       │   ├── controllers/   # HTTP endpoints
│       │   └── dto/           # Request/response boundary shapes
│       └── health.module.ts   # Feature-level dependency wiring
└── main.ts
```

## Architectural rules

- `domain` must not import NestJS, ORM models, HTTP requests, or database code.
- `data` implements contracts declared by the domain.
- `presentation` translates HTTP input/output and calls use cases.
- Feature modules are the composition boundary for their own dependencies.
- `core` is for genuinely shared infrastructure, not feature business logic.
- Add abstractions at external boundaries; do not create interfaces for every class.

## Included minimum setup

- Global `/api` prefix
- URI API versioning (`/api/v1/...`)
- CORS configuration through environment variables
- Graceful shutdown hooks
- Typed, dependency-free environment parsing
- Health endpoint at `GET /api/v1/health`
- Abstract domain contract with a data-layer implementation
- Unit test using a fake contract implementation
- End-to-end health test

## Run locally

```bash
npm install
npm run start:dev
```

The app has safe local defaults, so an `.env` file is not required. The
`.env.example` file documents production variables; provide them through your
hosting platform or shell. A dedicated configuration package can be introduced
later when request validation and secrets management are added.

## Verify

```bash
npm run lint
npm test
npm run test:e2e
npm run build
```

## Password reset

The API exposes:

- `POST /api/v1/auth/password-reset/request` with `{ "email": "..." }`.
  It always returns the same accepted response, whether or not an account exists.
- `POST /api/v1/auth/password-reset/confirm` with
  `{ "token": "...", "newPassword": "..." }`.
- `POST /api/v1/auth/password-reset/change` with a bearer access token and
  `{ "currentPassword": "...", "newPassword": "..." }`. If the request IP
  or configured region differs from the last successful login, an email reset
  link is issued instead.

Configure the HTTPS frontend reset URL and SMTP settings shown in
`.env.example`. The region header must be injected by a trusted edge proxy
(Cloudflare's `CF-IPCountry` by default), and the application origin must not
be directly reachable by clients. Apply database migrations before deployment:

```bash
npx prisma migrate deploy
```

## Add a feature

Use this minimum template:

```text
features/<feature>/
├── domain/
│   ├── entities/
│   ├── contracts/
│   └── use-cases/
├── data/
│   ├── repositories/
│   └── mappers/
├── presentation/
│   ├── controllers/
│   └── dto/
└── <feature>.module.ts
```

Only create the subfolders a feature actually needs. Simple read-only features do
not need artificial entities or repository abstractions.

## Deferred intentionally

Database ORM, authentication, authorization, Redis, queues, Swagger, structured
logging, and third-party integrations are not selected yet. Add them when their
requirements are confirmed rather than locking the project into premature choices.
