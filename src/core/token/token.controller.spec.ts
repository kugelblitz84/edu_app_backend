import { INestApplication, VersioningType } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { ConfigModule } from '../config/config.module';
import type { RefreshTokenResponseDto } from './token.controller';
import { TokenModule } from './token.module';
import { TokenService } from './token.service';

interface ErrorResponseBody {
  statusCode?: number;
  message: string;
  error?: string;
  violations?: string[];
}

describe('TokenController', () => {
  let app: INestApplication<App>;
  let tokenService: TokenService;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [ConfigModule, TokenModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    app.enableVersioning({
      type: VersioningType.URI,
      defaultVersion: '1',
    });
    tokenService = app.get(TokenService);

    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('rotates a valid refresh token', async () => {
    const original = tokenService.generate({
      userId: 'user-id',
      username: 'learner',
      email: 'learner@example.com',
      platformRole: 'GUEST',
      status: 'ACTIVE',
      emailVerified: true,
    });

    const response = await request(app.getHttpServer())
      .post('/api/v1/auth/refresh')
      .send({ refreshToken: original.refreshToken })
      .expect(200);
    const body = response.body as RefreshTokenResponseDto;

    expect(typeof body.accessToken).toBe('string');
    expect(typeof body.refreshToken).toBe('string');
    expect(body.tokenType).toBe('Bearer');
    expect(body.expiresIn).toBeGreaterThan(0);
    expect(body.accessToken).not.toBe(original.accessToken);
    expect(body.refreshToken).not.toBe(original.refreshToken);
    expect(tokenService.verify(body.accessToken).userId).toBe('user-id');
  });

  it('rejects an invalid refresh token', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/v1/auth/refresh')
      .send({ refreshToken: 'not-a-token' })
      .expect(401);

    expect(response.body as ErrorResponseBody).toMatchObject({
      statusCode: 401,
      message: 'The refresh token is invalid or expired.',
      error: 'Unauthorized',
    });
  });

  it('rejects malformed refresh requests', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/v1/auth/refresh')
      .send({ refreshToken: '', unsupportedField: true })
      .expect(400);

    const body = response.body as ErrorResponseBody;
    expect(body).toMatchObject({
      message: 'Invalid request.',
    });
    expect(body.violations).toContain('Refresh token is required.');
  });
});
