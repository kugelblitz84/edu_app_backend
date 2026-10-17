import { UnauthorizedException, type ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { OPTIONAL_AUTH_KEY } from '../decorators/optional-auth.decorator';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import type { AccessTokenService } from '../services/access-token.service';
import type { SessionService } from '../services/session.service';
import { AccessTokenGuard } from './access-token.guard';

describe('optional authentication preserves global guard semantics', () => {
  const verify = jest.fn();
  const authenticateAccessToken = jest.fn();
  const guard = new AccessTokenGuard(
    new Reflector(),
    { verify } as unknown as AccessTokenService,
    { authenticateAccessToken } as unknown as SessionService,
  );
  function request(
    header?: string,
    mode: 'optional' | 'protected' | 'public' = 'optional',
  ) {
    const handler = () => undefined;
    if (mode === 'optional')
      Reflect.defineMetadata(OPTIONAL_AUTH_KEY, true, handler);
    if (mode === 'public') Reflect.defineMetadata(IS_PUBLIC_KEY, true, handler);
    const req = { get: () => header, user: undefined as unknown };
    const context = {
      getHandler: () => handler,
      getClass: () => class TestController {},
      switchToHttp: () => ({ getRequest: () => req }),
    } as unknown as ExecutionContext;
    return { req, context };
  }
  beforeEach(() => jest.resetAllMocks());
  it('allows absent credentials only for optional and public routes', async () => {
    await expect(guard.canActivate(request().context)).resolves.toBe(true);
    await expect(
      guard.canActivate(request(undefined, 'public').context),
    ).resolves.toBe(true);
    await expect(
      guard.canActivate(request(undefined, 'protected').context),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(verify).not.toHaveBeenCalled();
  });
  it.each(['', 'Basic abc', 'Bearer', 'Bearer two tokens'])(
    'rejects malformed optional credentials: %s',
    async (header) => {
      await expect(
        guard.canActivate(request(header).context),
      ).rejects.toBeInstanceOf(UnauthorizedException);
      expect(verify).not.toHaveBeenCalled();
    },
  );
  it('rejects an expired token and a valid token with revoked session', async () => {
    verify.mockRejectedValueOnce(new Error('Expired'));
    await expect(
      guard.canActivate(request('Bearer expired').context),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    verify.mockResolvedValueOnce({ userId: 'viewer' });
    authenticateAccessToken.mockResolvedValueOnce(null);
    await expect(
      guard.canActivate(request('Bearer revoked').context),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });
  it('populates an optional viewer only after token and session validation', async () => {
    const user = { userId: 'viewer' };
    verify.mockResolvedValue(user);
    authenticateAccessToken.mockResolvedValue(user);
    const { req, context } = request('Bearer valid');
    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(req.user).toEqual(user);
  });
  it('preserves Public bypass for existing routes even with invalid supplied credentials', async () => {
    await expect(
      guard.canActivate(request('invalid', 'public').context),
    ).resolves.toBe(true);
    expect(verify).not.toHaveBeenCalled();
  });
});
