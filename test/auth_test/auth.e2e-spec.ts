import { INestApplication, VersioningType } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { randomBytes, randomUUID } from 'node:crypto';
import request from 'supertest';
import { App } from 'supertest/types';
import { ConfigModule } from '../../src/core/config/config.module';
import { PrismaService } from '../../src/core/database/prisma.service';
import { AuthModule } from '../../src/features/auth/auth.module';
import type { AuthTokenPair } from '../../src/core/auth/auth.types';
import { SessionService } from '../../src/core/auth/services/session.service';
import { LoginUserRepository } from '../../src/features/auth/login/domain/contracts/login-user.repository';
import type { LoginUserRecord } from '../../src/features/auth/login/domain/contracts/types';
import type { LoginResponseDto } from '../../src/features/auth/login/presentation/login.dto';
import { RegisterUserRepository } from '../../src/features/auth/register/domain/contracts/register-user.repository';
import type { CreateUserRecord } from '../../src/features/auth/register/domain/contracts/types';
import type { RegisteredUser } from '../../src/features/auth/register/domain/entities/registered-user.entity';
import { RegistrationConflictError } from '../../src/features/auth/register/domain/errors/registration.error';
import type { RegisterUserResponseDto } from '../../src/features/auth/register/presentation/dto/register-user-response.dto';

interface ErrorResponseBody {
  statusCode?: number;
  message: string | string[];
  error?: string;
  violations?: string[];
}

interface StoredUser extends LoginUserRecord {
  createdAt: Date;
  lastLoginAt: Date | null;
}

const AUTH_E2E_PREFIX = 'ae2e_';
const VALID_PASSWORD = 'StrongPassword123';
const WRONG_PASSWORD = 'WrongPassword123';

class InMemoryAuthUserRepository
  implements RegisterUserRepository, LoginUserRepository
{
  private readonly users = new Map<string, StoredUser>();

  reset() {
    this.users.clear();
  }

  async createGuestUser(user: CreateUserRecord): Promise<RegisteredUser> {
    await Promise.resolve();
    if (
      [...this.users.values()].some((record) => record.email === user.email)
    ) {
      throw RegistrationConflictError.email();
    }

    if (this.users.has(user.username)) {
      throw RegistrationConflictError.username();
    }

    const createdAt = new Date();
    const storedUser: StoredUser = {
      id: randomUUID(),
      email: user.email,
      username: user.username,
      passwordHash: user.passwordHash,
      fullName: user.fullName,
      platformRole: 'GUEST',
      status: 'ACTIVE',
      emailVerifiedAt: null,
      createdAt,
      lastLoginAt: null,
    };

    this.users.set(storedUser.username, storedUser);

    return {
      id: storedUser.id,
      email: storedUser.email,
      username: storedUser.username,
      platformRole: storedUser.platformRole,
      status: storedUser.status,
      createdAt: storedUser.createdAt,
    };
  }

  async findByUsername(username: string): Promise<LoginUserRecord | null> {
    await Promise.resolve();
    return this.users.get(username) ?? null;
  }

  async recordSuccessfulLogin(userId: string, loggedInAt: Date): Promise<void> {
    await Promise.resolve();
    const user = [...this.users.values()].find(
      (record) => record.id === userId,
    );

    if (user) {
      user.lastLoginAt = loggedInAt;
    }
  }

  getByUsername(username: string): StoredUser | undefined {
    return this.users.get(username);
  }

  suspend(username: string) {
    const user = this.users.get(username);

    if (user) {
      user.status = 'SUSPENDED';
    }
  }
}

function uniqueAuthSubject() {
  const suffix = `${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;

  return {
    email: `${AUTH_E2E_PREFIX}${suffix}@example.com`,
    username: `${AUTH_E2E_PREFIX}${suffix}`,
    password: VALID_PASSWORD,
  };
}

function expectJwtLikeToken(token: string) {
  expect(token).toEqual(expect.any(String));
  expect(token.split('.')).toHaveLength(3);
}

class InMemorySessionService {
  create(): Promise<AuthTokenPair> {
    return Promise.resolve({
      accessToken: 'eyJhbGciOiJIUzI1NiJ9.eyJ0eXBlIjoiYWNjZXNzIn0.signature',
      refreshToken: `${randomUUID()}.${randomBytes(32).toString('base64url')}`,
      accessTokenExpiresIn: 900,
    });
  }
}

describe('Auth module (e2e)', () => {
  let app: INestApplication<App>;
  let repository: InMemoryAuthUserRepository;

  beforeAll(async () => {
    repository = new InMemoryAuthUserRepository();

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [ConfigModule, AuthModule],
    })
      .overrideProvider(PrismaService)
      .useValue({})
      .overrideProvider(RegisterUserRepository)
      .useValue(repository)
      .overrideProvider(LoginUserRepository)
      .useValue(repository)
      .overrideProvider(SessionService)
      .useClass(InMemorySessionService)
      .compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    app.enableVersioning({
      type: VersioningType.URI,
      defaultVersion: '1',
    });

    await app.init();
  });

  beforeEach(() => {
    repository.reset();
  });

  afterAll(async () => {
    await app.close();
  });

  it('registers a new user, rejects duplicates, logs in, returns tokens, and records the login', async () => {
    const user = uniqueAuthSubject();
    const registerResponse = await request(app.getHttpServer())
      .post('/api/v1/auth/register/user')
      .send({
        email: `  ${user.email.toUpperCase()}  `,
        username: `  ${user.username}  `,
        password: user.password,
      })
      .expect(201);

    const registeredUser = registerResponse.body as RegisterUserResponseDto;

    expect(registeredUser).toMatchObject({
      email: user.email,
      username: user.username,
      platformRole: 'GUEST',
      status: 'ACTIVE',
    });
    expect(typeof registeredUser.id).toBe('string');
    expect(typeof registeredUser.createdAt).toBe('string');
    expect(Date.parse(registeredUser.createdAt)).not.toBeNaN();
    expect(registeredUser).not.toHaveProperty('password');
    expect(registeredUser).not.toHaveProperty('passwordHash');

    const persistedUserAfterRegister = repository.getByUsername(user.username);

    expect(persistedUserAfterRegister).toMatchObject({
      email: user.email,
      username: user.username,
      fullName: user.username,
      platformRole: 'GUEST',
      status: 'ACTIVE',
      lastLoginAt: null,
    });
    expect(typeof persistedUserAfterRegister?.passwordHash).toBe('string');
    expect(persistedUserAfterRegister?.passwordHash).not.toBe(user.password);

    const duplicateEmailResponse = await request(app.getHttpServer())
      .post('/api/v1/auth/register/user')
      .send({
        email: user.email,
        username: 'ae2e_duplicate_email_user',
        password: user.password,
      })
      .expect(409);

    expect(duplicateEmailResponse.body as ErrorResponseBody).toMatchObject({
      statusCode: 409,
      message: 'An account with that email already exists.',
      error: 'Conflict',
    });

    const duplicateUsernameResponse = await request(app.getHttpServer())
      .post('/api/v1/auth/register/user')
      .send({
        email: `new_${user.email}`,
        username: user.username,
        password: user.password,
      })
      .expect(409);

    expect(duplicateUsernameResponse.body as ErrorResponseBody).toMatchObject({
      statusCode: 409,
      message: 'An account with that username already exists.',
      error: 'Conflict',
    });

    const wrongPasswordResponse = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({
        username: user.username,
        password: WRONG_PASSWORD,
      })
      .expect(401);

    expect(wrongPasswordResponse.body as ErrorResponseBody).toMatchObject({
      statusCode: 401,
      message: 'Invalid username or password.',
      error: 'Unauthorized',
    });

    const loginResponse = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({
        username: `  ${user.username}  `,
        password: user.password,
      })
      .expect(201);

    const loggedInUser = loginResponse.body as LoginResponseDto;

    expect(loggedInUser).toMatchObject({
      user: {
        id: registeredUser.id,
        username: user.username,
        email: user.email,
        fullName: user.username,
        platformRole: 'GUEST',
      },
      tokenType: 'Bearer',
    });
    expect(typeof loggedInUser.accessToken).toBe('string');
    expect(typeof loggedInUser.refreshToken).toBe('string');
    expect(typeof loggedInUser.expiresIn).toBe('number');
    expectJwtLikeToken(loggedInUser.accessToken);
    expect(loggedInUser.refreshToken).toMatch(
      /^[0-9a-f-]{36}\.[A-Za-z0-9_-]{43}$/i,
    );
    expect(loggedInUser.expiresIn).toBeGreaterThan(0);
    expect(repository.getByUsername(user.username)?.lastLoginAt).toBeInstanceOf(
      Date,
    );
  });

  it('rejects invalid registration requests with detailed violations', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/v1/auth/register/user')
      .send({
        email: 'not-an-email',
        username: 'ab',
        password: 'weak',
        unsupportedField: true,
      })
      .expect(400);

    const body = response.body as ErrorResponseBody;

    expect(body).toMatchObject({
      message: 'Invalid request.',
    });
    expect(body.violations).toEqual(
      expect.arrayContaining([
        'A valid email address is required.',
        'Username must be 3-30 characters and contain only letters, numbers, and underscores.',
        'Password must be 15-128 characters long.',
      ]),
    );
  });

  it('rejects invalid login requests and non-active users', async () => {
    const invalidLoginResponse = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({
        username: '',
        password: '',
        unsupportedField: true,
      })
      .expect(400);

    const invalidLoginBody = invalidLoginResponse.body as ErrorResponseBody;
    expect(invalidLoginBody).toMatchObject({
      message: 'Invalid request.',
    });
    expect(invalidLoginBody.violations).toEqual(
      expect.arrayContaining([
        'Username is required.',
        'Password is required.',
      ]),
    );

    const user = uniqueAuthSubject();

    await request(app.getHttpServer())
      .post('/api/v1/auth/register/user')
      .send(user)
      .expect(201);

    repository.suspend(user.username);

    const suspendedLoginResponse = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({
        username: user.username,
        password: user.password,
      })
      .expect(403);

    expect(suspendedLoginResponse.body as ErrorResponseBody).toMatchObject({
      statusCode: 403,
      message: 'This account is not active.',
      error: 'Forbidden',
    });
  });
});
