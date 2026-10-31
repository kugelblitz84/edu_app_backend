# Repository Workflow

This repository is a NestJS backend built around a feature-first, layered structure. The main idea is to keep business rules in the domain layer, infrastructure concerns in the data layer, and HTTP handling in the presentation layer.

## 1. Application startup

1. The app starts from [src/main.ts](src/main.ts).
2. That file calls the bootstrap function from [src/app/bootstrap.ts](src/app/bootstrap.ts).
3. Bootstrap creates the NestJS application, loads configuration from [src/core/config/app-config.ts](src/core/config/app-config.ts), and applies the global application settings:
   - global `/api` prefix
   - URI versioning such as `/api/v1/...`
   - CORS settings
   - validation pipe for DTOs
   - shutdown hooks
   - server listening on the configured port

## 2. Module composition

The root module is [src/app/app.module.ts](src/app/app.module.ts). It imports the main feature modules:

- [src/features/health/health.module.ts](src/features/health/health.module.ts) for health checks
- [src/features/auth/auth.module.ts](src/features/auth/auth.module.ts) for authentication-related features

The auth module then imports the registration module, which wires the controller, use case, repository, and password hashing service together.

## 3. Request flow

A typical request follows this path:

1. A client sends an HTTP request to the NestJS server.
2. The request enters the relevant controller in the presentation layer.
3. The controller validates and transforms the incoming data.
4. The controller calls a use case from the domain layer.
5. The use case applies the business rules.
6. If persistence is needed, the use case calls a repository abstraction.
7. The repository implementation uses Prisma through [src/core/database/prisma.service.ts](src/core/database/prisma.service.ts) to communicate with the database.
8. The result is mapped into a response DTO and returned to the client.

## 4. Health check workflow

The health endpoint is a simple example of the architecture in action.

- The request reaches [src/features/health/presentation/controllers/health.controller.ts](src/features/health/presentation/controllers/health.controller.ts).
- The controller calls [src/features/health/domain/use-cases/get-health-status.use-case.ts](src/features/health/domain/use-cases/get-health-status.use-case.ts).
- The use case asks the system status service for a snapshot of the current status.
- The result is transformed into a response DTO.

This flow is intentionally simple and shows how the layers are separated.

## 5. Registration workflow

The registration feature demonstrates a fuller flow:

1. A client calls `POST /api/v1/auth/register`.
2. [src/features/auth/register/presentation/controllers/register.controller.ts](src/features/auth/register/presentation/controllers/register.controller.ts) receives the request.
3. A custom validation pipe validates the incoming DTO and rejects unsupported fields.
4. The controller forwards the request to [src/features/auth/register/domain/use-cases/register-user.use-case.ts](src/features/auth/register/domain/use-cases/register-user.use-case.ts).
5. The use case validates the email, username, and password.
6. The password is hashed by [src/features/auth/register/data/services/scrypt-password-hasher.service.ts](src/features/auth/register/data/services/scrypt-password-hasher.service.ts).
7. The repository implementation in [src/features/auth/register/data/repositories/register-user.repository.ts](src/features/auth/register/data/repositories/register-user.repository.ts) persists the user through Prisma.
8. The controller returns a sanitized response DTO.

## 6. Infrastructure and configuration

The shared infrastructure layer lives under [src/core](src/core):

- [src/core/config](src/core/config) handles environment-based configuration.
- [src/core/database](src/core/database) provides the Prisma service and module.
- [src/core/errors](src/core/errors) contains shared error types.

This keeps the feature modules focused on their own business behavior instead of duplicating infrastructure code.

## 7. Testing workflow

The repository includes both unit tests and end-to-end tests:

- unit tests live beside the relevant feature code as `.spec.ts` files
- e2e tests live in [test/app.e2e-spec.ts](test/app.e2e-spec.ts)

Common commands:

```bash
npm install
npm run start:dev
npm run test
npm run test:e2e
npm run build
```

## 8. In short

The repository works like this:

- the app boots through NestJS
- modules compose feature-specific behavior
- controllers handle HTTP input
- use cases contain business logic
- repositories interact with the database
- DTOs shape the API boundary

That structure makes the project easier to extend as new features are added.
