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

@Injectable()
export class AccessTokenGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly accessTokens: AccessTokenService,
  ) {}

  canActivate(context: ExecutionContext): boolean {
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
      (request as AuthenticatedRequest).user = this.accessTokens.verify(
        match[1],
      );
      return true;
    } catch {
      throw new UnauthorizedException('A valid access token is required.');
    }
  }
}
