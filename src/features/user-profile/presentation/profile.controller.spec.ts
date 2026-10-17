import type { Server } from 'node:http';
import { Test } from '@nestjs/testing';
import { VersioningType, type INestApplication } from '@nestjs/common';
import type { Request, Response, NextFunction } from 'express';
import request from 'supertest';
import { MeProfileController } from './profile.controller';
import { UserProfileUseCases } from '../domain/user-profile.usecases';
import { ProfilePictureUseCases } from '../domain/profile-picture.usecases';

const fileId = '00000000-0000-4000-8000-000000000000';
describe('profile picture HTTP endpoints', () => {
  let app: INestApplication<Server>;
  const profile = {
    id: 'authenticated-owner',
    email: 'a@example.com',
    username: 'owner',
    fullName: 'Owner',
    avatarUrl: 'https://example.com/avatar',
  };
  const profiles = { getOwnProfile: jest.fn().mockResolvedValue(profile) };
  const pictures = {
    createUpload: jest.fn().mockResolvedValue({
      fileId,
      url: 'https://example.com/upload',
      method: 'POST',
      fields: { signature: 'signed' },
      reference: { provider: 'CLOUDINARY', locator: { key: 'internal' } },
      expiresAt: 100,
    }),
    completeUpload: jest.fn().mockResolvedValue(undefined),
  };
  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [MeProfileController],
      providers: [
        { provide: UserProfileUseCases, useValue: profiles },
        { provide: ProfilePictureUseCases, useValue: pictures },
      ],
    }).compile();
    app = module.createNestApplication<INestApplication<Server>>();
    app.setGlobalPrefix('api');
    app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
    // Authentication is exercised by the existing auth suite; provide its request context here.
    app.use(
      (
        req: Request & { user?: unknown },
        _res: Response,
        next: NextFunction,
      ) => {
        req.user = { userId: 'authenticated-owner' };
        next();
      },
    );
    await app.init();
  });
  afterAll(async () => {
    await app.close();
  });
  beforeEach(() => jest.clearAllMocks());

  it('returns upload fields and UUID while omitting the internal reference', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/v1/me/profile-picture/upload-url')
      .send({ fileType: 'image/jpeg', sizeBytes: 100 })
      .expect(201);
    expect(response.body).toMatchObject({ fileId, method: 'POST' });
    expect(response.body).not.toHaveProperty('reference');
    expect(pictures.createUpload).toHaveBeenCalledWith('authenticated-owner', {
      fileType: 'image/jpeg',
      sizeBytes: 100,
    });
  });

  it('rejects client-controlled locators and invalid formats', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/me/profile-picture/upload-url')
      .send({ fileType: 'application/pdf', sizeBytes: 100 })
      .expect(400);
    await request(app.getHttpServer())
      .post('/api/v1/me/profile-picture/complete')
      .send({ fileId, reference: { key: 'another-user' } })
      .expect(400);
    expect(pictures.createUpload).not.toHaveBeenCalled();
    expect(pictures.completeUpload).not.toHaveBeenCalled();
  });

  it('completes as the authenticated owner and returns the profile with avatarUrl', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/v1/me/profile-picture/complete')
      .send({ fileId })
      .expect(201);
    expect(pictures.completeUpload).toHaveBeenCalledWith(
      'authenticated-owner',
      fileId,
    );
    expect(response.body).toEqual(profile);
  });

  it('includes avatarUrl in the own-profile response', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/me')
      .expect(200);
    expect(response.body).toMatchObject({ avatarUrl: profile.avatarUrl });
  });
});
