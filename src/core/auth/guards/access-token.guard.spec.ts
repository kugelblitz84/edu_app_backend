import { UnauthorizedException } from '@nestjs/common';
import type { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import type { AccessTokenService } from '../services/access-token.service';
import type { SessionService } from '../services/session.service';
import { AccessTokenGuard } from './access-token.guard';

describe(AccessTokenGuard.name, () => {
  const verify = jest.fn();
  const authenticateAccessToken = jest.fn();
  const accessTokens = { verify } as unknown as AccessTokenService;
  const sessions = { authenticateAccessToken } as unknown as SessionService;
  const reflector = new Reflector();
  const guard = new AccessTokenGuard(reflector, accessTokens, sessions);

  function context(request: Partial<Request>, handler = () => undefined) {
    return {
      getHandler: () => handler,
      getClass: () => class TestController {},
      switchToHttp: () => ({ getRequest: () => request }),
    } as unknown as ExecutionContext;
  }

  beforeEach(() => jest.clearAllMocks());

  it('attaches a verified, active session user to protected requests', async () => {
    const request = { get: () => 'Bearer access-token' } as Partial<Request>;
    const subject = {
      userId: 'user-id',
      sessionId: 'session-id',
      platformRole: 'PLATFORM_USER' as const,
      issuedAt: new Date(),
    };
    verify.mockResolvedValue(subject);
    authenticateAccessToken.mockResolvedValue(subject);

    await expect(guard.canActivate(context(request))).resolves.toBe(true);
    expect((request as { user?: unknown }).user).toBe(subject);
  });

  it('rejects a valid JWT whose session is inactive', async () => {
    verify.mockResolvedValue({
      userId: 'user-id',
      sessionId: 'session-id',
      platformRole: 'PLATFORM_USER',
      issuedAt: new Date(),
    });
    authenticateAccessToken.mockResolvedValue(null);

    await expect(
      guard.canActivate(context({ get: () => 'Bearer access-token' })),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('rejects protected requests without a bearer token', async () => {
    const request = { get: () => undefined } as Partial<Request>;
    await expect(guard.canActivate(context(request))).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('allows handlers marked public without authenticating', async () => {
    const handler = () => undefined;
    Reflect.defineMetadata(IS_PUBLIC_KEY, true, handler);
    await expect(
      guard.canActivate(context({} as Request, handler)),
    ).resolves.toBe(true);
    expect(verify).not.toHaveBeenCalled();
  });
});
