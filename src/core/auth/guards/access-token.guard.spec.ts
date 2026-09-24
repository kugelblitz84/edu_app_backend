import { UnauthorizedException } from '@nestjs/common';
import type { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import type { AccessTokenService } from '../services/access-token.service';
import { AccessTokenGuard } from './access-token.guard';

describe(AccessTokenGuard.name, () => {
  const verify = jest.fn();
  const accessTokens = { verify } as unknown as AccessTokenService;
  const reflector = new Reflector();
  const guard = new AccessTokenGuard(reflector, accessTokens);

  function context(request: Partial<Request>, handler = () => undefined) {
    return {
      getHandler: () => handler,
      getClass: () => class TestController {},
      switchToHttp: () => ({ getRequest: () => request }),
    } as unknown as ExecutionContext;
  }

  beforeEach(() => jest.clearAllMocks());

  it('attaches the verified user to protected requests', () => {
    const request = { get: () => 'Bearer access-token' } as Partial<Request>;
    const subject = {
      userId: 'user-id',
      platformRole: 'GUEST' as const,
      issuedAt: new Date(),
    };
    verify.mockReturnValue(subject);

    expect(guard.canActivate(context(request))).toBe(true);
    expect((request as { user?: unknown }).user).toBe(subject);
  });

  it('rejects protected requests without a bearer token', () => {
    const request = { get: () => undefined } as Partial<Request>;
    expect(() => guard.canActivate(context(request))).toThrow(
      UnauthorizedException,
    );
  });

  it('allows handlers marked public without authenticating', () => {
    const handler = () => undefined;
    Reflect.defineMetadata(IS_PUBLIC_KEY, true, handler);
    expect(guard.canActivate(context({} as Request, handler))).toBe(true);
    expect(verify).not.toHaveBeenCalled();
  });
});
