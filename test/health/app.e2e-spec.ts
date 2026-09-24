import { INestApplication, VersioningType } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../../src/app/app.module';
import { MongooseService } from '../../src/core/database/mongoose.service';
import { PrismaService } from '../../src/core/database/prisma.service';
import type { HealthResponse } from '../../src/features/health/health.service';

describe('Application (e2e)', () => {
  let app: INestApplication<App>;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PrismaService)
      .useValue({})
      .overrideProvider(MongooseService)
      .useValue({})
      .compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    app.enableVersioning({
      type: VersioningType.URI,
      defaultVersion: '1',
    });
    await app.init();
  });

  it('GET /api/v1/health/status', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/health/status')
      .expect(200);

    const body = response.body as HealthResponse;

    expect(body.status).toBe('ok');
    expect(typeof body.environment).toBe('string');
    expect(typeof body.timestamp).toBe('string');
    expect(typeof body.uptimeSeconds).toBe('number');
  });

  afterEach(async () => {
    await app.close();
  });
});
