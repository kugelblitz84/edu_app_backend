import { Injectable } from '@nestjs/common';
import { WsException } from '@nestjs/websockets';
import type { Socket } from 'socket.io';
import type { AuthenticatedUser } from '../../../../core/auth/auth.types';
import { AccessTokenService } from '../../../../core/auth/services/access-token.service';
import { SessionService } from '../../../../core/auth/services/session.service';

@Injectable()
export class SocketAuthService {
  constructor(
    private readonly tokens: AccessTokenService,
    private readonly sessions: SessionService,
  ) {}

  async authenticate(client: Socket): Promise<AuthenticatedUser> {
    const handshakeAuth = client.handshake.auth as Record<string, unknown>;
    const authToken = handshakeAuth.token;
    const header = client.handshake.headers.authorization;
    const token =
      typeof authToken === 'string'
        ? authToken
        : typeof header === 'string' && header.startsWith('Bearer ')
          ? header.slice(7)
          : undefined;
    if (!token) return this.reject(client);
    try {
      const claims = await this.tokens.verify(token);
      const active = await this.sessions.authenticateAccessToken(claims);
      if (!active || active.expiresAt <= new Date()) return this.reject(client);
      const data = client.data as { user?: AuthenticatedUser };
      data.user = active;
      return active;
    } catch {
      return this.reject(client);
    }
  }

  async revalidate(client: Socket): Promise<AuthenticatedUser> {
    const data = client.data as { user?: AuthenticatedUser };
    const user = data.user;
    if (!user || user.expiresAt <= new Date()) return this.reject(client);
    const active = await this.sessions.authenticateAccessToken(user);
    if (!active) return this.reject(client);
    return active;
  }

  private reject(client: Socket): never {
    client.disconnect(true);
    throw new WsException('Unauthorized');
  }
}
