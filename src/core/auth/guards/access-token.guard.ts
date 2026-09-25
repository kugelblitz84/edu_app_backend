import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import type { AuthenticatedRequest } from '../auth.types';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { AccessTokenService } from '../services/access-token.service';
import { SessionService } from '../services/session.service';

@Injectable()
export class AccessTokenGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly accessTokens: AccessTokenService,
    private readonly sessions: SessionService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest<Request>();
    const match = request.get('authorization')?.match(/^Bearer ([^\s]+)$/i);
    if (!match || match[1].length > 4096) {
      throw new UnauthorizedException('A valid access token is required.');
    }

    try {
      const claims = await this.accessTokens.verify(match[1]);
      const user = await this.sessions.authenticateAccessToken(claims);
      if (!user) throw new Error('Inactive session');
      (request as AuthenticatedRequest).user = user;
      return true;
    } catch {
      throw new UnauthorizedException('A valid access token is required.');
    }
  }
}
