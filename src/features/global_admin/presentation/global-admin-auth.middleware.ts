import {
  ForbiddenException,
  Injectable,
  NestMiddleware,
  UnauthorizedException,
} from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';
import type { VerifiedAccessToken } from '../../../core/token/token.entities';
import { TokenService } from '../../../core/token/token.service';

export interface GlobalAdminRequest extends Request {
  globalAdminUserId: string;
}

@Injectable()
export class GlobalAdminAuthMiddleware implements NestMiddleware {
  constructor(private readonly tokenService: TokenService) {}

  use(request: Request, _response: Response, next: NextFunction): void {
    const match = request.header('authorization')?.match(/^Bearer ([^\\s]+)$/i);
    if (!match || match[1].length > 4096) {
      throw new UnauthorizedException('A valid access token is required.');
    }

    let token: VerifiedAccessToken;
    try {
      token = this.tokenService.verify(match[1]);
    } catch {
      throw new UnauthorizedException('A valid access token is required.');
    }

    if (token.platformRole !== 'GLOBAL_ADMIN') {
      throw new ForbiddenException('Global administrator access is required.');
    }

    (request as GlobalAdminRequest).globalAdminUserId = token.userId;
    next();
  }
}
