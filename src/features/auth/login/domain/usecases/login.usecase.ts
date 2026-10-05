import { SessionService } from '../../../../../core/auth/services/session.service';
import { LoginUserRepository } from '../contracts/login-user.repository';
import { PasswordVerifier } from '../contracts/password-verifier.service';
import type { LoggedInUser } from '../entities/logged-in-user.entity';
import {
  InvalidCredentialsError,
  LoginNotAllowedError,
} from '../errors/login.error';

export interface LoginInput {
  username?: unknown;
  password?: unknown;
}

export interface LoginContext {
  ipAddress?: string;
  ipRegion?: string;
  userAgent?: string;
}

export class LoginUseCase {
  constructor(
    private readonly repository: LoginUserRepository,
    private readonly passwordVerifier: PasswordVerifier,
    private readonly sessions: Pick<SessionService, 'create'>,
  ) {}

  async execute(
    input: LoginInput,
    context: LoginContext = {},
  ): Promise<LoggedInUser> {
    const username =
      typeof input.username === 'string' ? input.username.trim() : '';
    const password = typeof input.password === 'string' ? input.password : '';

    if (!username || !password) {
      throw new InvalidCredentialsError();
    }

    const user = await this.repository.findByUsername(username);
    const passwordMatches = user
      ? await this.passwordVerifier.verify(password, user.passwordHash)
      : false;

    if (!user || !passwordMatches) {
      throw new InvalidCredentialsError();
    }

    if (user.status !== 'ACTIVE') {
      throw new LoginNotAllowedError();
    }

    const tokens = await this.sessions.create(
      {
        userId: user.id,
        platformRole: user.platformRole,
        status: user.status,
      },
      {
        ipAddress: context.ipAddress,
        userAgent: context.userAgent,
      },
    );

    await this.repository.recordSuccessfulLogin(
      user.id,
      new Date(),
      context.ipAddress,
      context.ipRegion,
    );

    return {
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        fullName: user.fullName,
        platformRole: user.platformRole,
      },
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      tokenType: 'Bearer',
      expiresIn: tokens.accessTokenExpiresIn,
    };
  }
}
