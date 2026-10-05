import { SessionService } from '../../../../../core/auth/services/session.service';
import type {
  AuthTokenPair,
  SessionMetadata,
  SessionUser,
} from '../../../../../core/auth/auth.types';
import { LoginUserRepository } from '../contracts/login-user.repository';
import type { LoginUserRecord } from '../contracts/types';
import { PasswordVerifier } from '../contracts/password-verifier.service';
import {
  InvalidCredentialsError,
  LoginNotAllowedError,
} from '../errors/login.error';
import { LoginUseCase } from './login.usecase';

const ACTIVE_USER: LoginUserRecord = {
  id: '5cae6d1a-930c-45a2-8408-8fb1be8446af',
  email: 'learner@example.com',
  username: 'learner_01',
  fullName: 'Test Learner',
  passwordHash: 'stored-hash',
  platformRole: 'PLATFORM_USER',
  status: 'ACTIVE',
  emailVerifiedAt: new Date('2026-08-01T00:00:00.000Z'),
};

class FakeLoginUserRepository implements LoginUserRepository {
  public lastLogin?: { userId: string; loggedInAt: Date };

  constructor(private readonly user: LoginUserRecord | null = ACTIVE_USER) {}

  findByUsername(username: string): Promise<LoginUserRecord | null> {
    return Promise.resolve(
      username === ACTIVE_USER.username ? this.user : null,
    );
  }

  recordSuccessfulLogin(userId: string, loggedInAt: Date): Promise<void> {
    this.lastLogin = { userId, loggedInAt };
    return Promise.resolve();
  }
}

class FakePasswordVerifier implements PasswordVerifier {
  constructor(private readonly matches = true) {}

  verify(): Promise<boolean> {
    return Promise.resolve(this.matches);
  }
}

class FakeTokenGenerator implements Pick<SessionService, 'create'> {
  public subject?: SessionUser;
  public metadata?: SessionMetadata;

  create(
    subject: SessionUser,
    metadata?: SessionMetadata,
  ): Promise<AuthTokenPair> {
    this.subject = subject;
    this.metadata = metadata;
    return Promise.resolve({
      accessToken: 'access-token',
      refreshToken: 'refresh-token',
      accessTokenExpiresIn: 900,
    });
  }
}

describe(LoginUseCase.name, () => {
  it('returns a token pair and records a successful active-user login', async () => {
    const repository = new FakeLoginUserRepository();
    const tokenGenerator = new FakeTokenGenerator();
    const useCase = new LoginUseCase(
      repository,
      new FakePasswordVerifier(),
      tokenGenerator,
    );

    const result = await useCase.execute({
      username: ' learner_01 ',
      password: 'StrongPass123',
    });

    expect(tokenGenerator.subject).toEqual({
      userId: ACTIVE_USER.id,
      platformRole: 'PLATFORM_USER',
      status: 'ACTIVE',
    });
    expect(result).toMatchObject({
      user: {
        id: ACTIVE_USER.id,
        username: ACTIVE_USER.username,
        email: ACTIVE_USER.email,
        fullName: ACTIVE_USER.fullName,
        platformRole: ACTIVE_USER.platformRole,
      },
      accessToken: 'access-token',
      refreshToken: 'refresh-token',
      tokenType: 'Bearer',
      expiresIn: 900,
    });
    expect(repository.lastLogin?.userId).toBe(ACTIVE_USER.id);
  });

  it('uses the same invalid-credentials error for unknown users and bad passwords', async () => {
    const missingUserLogin = new LoginUseCase(
      new FakeLoginUserRepository(null),
      new FakePasswordVerifier(),
      new FakeTokenGenerator(),
    );
    const badPasswordLogin = new LoginUseCase(
      new FakeLoginUserRepository(),
      new FakePasswordVerifier(false),
      new FakeTokenGenerator(),
    );

    await expect(
      missingUserLogin.execute({ username: 'learner_01', password: 'wrong' }),
    ).rejects.toBeInstanceOf(InvalidCredentialsError);
    await expect(
      badPasswordLogin.execute({ username: 'learner_01', password: 'wrong' }),
    ).rejects.toBeInstanceOf(InvalidCredentialsError);
  });

  it('rejects a non-active account before issuing tokens', async () => {
    const tokenGenerator = new FakeTokenGenerator();
    const useCase = new LoginUseCase(
      new FakeLoginUserRepository({ ...ACTIVE_USER, status: 'SUSPENDED' }),
      new FakePasswordVerifier(),
      tokenGenerator,
    );

    await expect(
      useCase.execute({ username: 'learner_01', password: 'StrongPass123' }),
    ).rejects.toBeInstanceOf(LoginNotAllowedError);
    expect(tokenGenerator.subject).toBeUndefined();
  });
});
