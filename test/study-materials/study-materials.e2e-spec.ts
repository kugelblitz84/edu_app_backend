import type { Server } from 'node:http';
/* eslint-disable @typescript-eslint/no-unsafe-member-access, @typescript-eslint/require-await */
import { VersioningType, type INestApplication } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { Client } from 'pg';
import request from 'supertest';
import { AccessTokenGuard } from '../../src/core/auth/guards/access-token.guard';
import { AccessTokenService } from '../../src/core/auth/services/access-token.service';
import { RateLimitService } from '../../src/core/auth/services/rate-limit.service';
import { SessionService } from '../../src/core/auth/services/session.service';
import { loadAppConfig } from '../../src/core/config/app-config';
import { PrismaService } from '../../src/core/database/prisma.service';
import { ScryptSecretHasher } from '../../src/core/security/scrypt-secret-hasher.service';
import { ScryptSecretVerifier } from '../../src/core/security/scrypt-secret-verifier.service';
import type { StorageReference } from '../../src/core/modules/storage/domain/storage.types';
import { loadMaterialConfig } from '../../src/features/Resources/application/material.config';
import { MaterialService } from '../../src/features/Resources/application/material.service';
import { MaterialCleanupWorker } from '../../src/features/Resources/data/material-cleanup.worker';
import { PrismaMaterialRepository } from '../../src/features/Resources/data/material.repository';
import { MaterialLibraryController } from '../../src/features/Resources/presentation/material-library.controller';
import { ResourceCollectionController } from '../../src/features/Resources/presentation/resource-collection.controller';
import { ResourceController } from '../../src/features/Resources/presentation/resource.controller';

describe('study materials HTTP, migration and concurrency (isolated PostgreSQL)', () => {
  jest.setTimeout(60000);
  const base = loadAppConfig();
  const name = `materials_test_${randomUUID().replaceAll('-', '')}`;
  const url = new URL(base.databaseUrl);
  url.pathname = '/' + name;
  url.searchParams.delete('schema');
  url.searchParams.delete('options');
  const config = {
    ...base,
    databaseUrl: url.toString(),
    passwordHashing: { ...base.passwordHashing, cost: 16384 },
  };
  const admin = new Client({
    connectionString: base.databaseUrl,
    connectionTimeoutMillis: 3000,
  });
  const db = new PrismaService(config);
  const repository = new PrismaMaterialRepository(db);
  const limits = { ...loadMaterialConfig(), uploadsPerHour: 1000 };
  const storage = {
    createUploadUrl: jest.fn(async () => {
      const fileId = randomUUID();
      return {
        fileId,
        url: 'https://storage.test/upload',
        method: 'POST' as const,
        fields: { signature: 'test' },
        reference: { provider: 'FAKE', locator: { id: fileId } },
        expiresAt: Math.floor(Date.now() / 1000) + 3600,
      };
    }),
    inspect: jest.fn(async (reference: StorageReference) => ({
      reference,
      sizeBytes: 100,
    })),
    createReadAccessUrl: jest.fn(async () => ({
      url: 'https://storage.test/expiring-media',
      expiresAt: Math.floor(Date.now() / 1000) + 900,
    })),
    delete: jest.fn(async () => undefined),
  };
  const verifier = new ScryptSecretVerifier(config);
  const service = new MaterialService(
    repository,
    storage,
    new ScryptSecretHasher(config),
    verifier,
    new RateLimitService(db),
    limits,
  );
  let app: INestApplication;
  let owner: string, other: string, school: string;
  let databaseCreated = false;
  const revoked = new Set<string>();

  beforeAll(async () => {
    await admin.connect();
    if (!/^materials_test_[a-f0-9]{32}$/.test(name))
      throw new Error('Unsafe test database name.');
    await admin.query(`CREATE DATABASE ${name}`);
    databaseCreated = true;
    const setup = new Client({ connectionString: config.databaseUrl });
    await setup.connect();
    try {
      const schema = execFileSync(
        process.execPath,
        [
          resolve('node_modules/prisma/build/index.js'),
          'migrate',
          'diff',
          '--from-empty',
          '--to-schema',
          'prisma',
          '--script',
        ],
        {
          encoding: 'utf8',
          env: { ...process.env, DATABASE_URL: config.databaseUrl },
        },
      );
      const featureTables = [
        'study_resources',
        'resource_collections',
        'resource_collection_items',
        'resource_files',
        'resource_unlock_grants',
        'resource_collection_unlock_grants',
        'resource_cleanup_jobs',
      ];
      const baseline = schema
        .split(';')
        .filter(
          (statement) =>
            !featureTables.some(
              (table) =>
                statement.includes(`TABLE "${table}"`) ||
                statement.includes(`ON "${table}"`),
            ),
        )
        .join(';');
      await setup.query(baseline);
      // Exercise the actual additive migration rather than relying on db push.
      await setup.query(
        readFileSync(
          resolve('prisma/updates/20261017_study_materials.sql'),
          'utf8',
        ),
      );
    } finally {
      await setup.end();
    }
    await db.$connect();
    const users = await Promise.all(
      ['owner', 'viewer'].map((label) =>
        db.user.create({
          data: {
            email: `${label}@materials.test`,
            username: label,
            fullName: label,
            passwordHash: 'fixture',
          },
        }),
      ),
    );
    [owner, other] = users.map((user) => user.id);
    const institution = await db.institution.create({
      data: {
        name: 'Study school',
        slug: 'study-school',
        status: 'ACTIVE',
        createdByUserId: owner,
        admins: { create: { userId: owner } },
      },
    });
    school = institution.id;
    const module = await Test.createTestingModule({
      controllers: [
        ResourceController,
        ResourceCollectionController,
        MaterialLibraryController,
      ],
      providers: [
        { provide: MaterialService, useValue: service },
        {
          provide: AccessTokenService,
          useValue: {
            verify: (token: string) => {
              if (![owner, other].includes(token))
                throw new Error('Invalid token');
              return {
                userId: token,
                sessionId: token,
                platformRole: 'PLATFORM_USER',
              };
            },
          },
        },
        {
          provide: SessionService,
          useValue: {
            authenticateAccessToken: (claims: { userId: string }) =>
              revoked.has(claims.userId) ? null : claims,
          },
        },
        { provide: APP_GUARD, useClass: AccessTokenGuard },
      ],
    }).compile();
    app = module.createNestApplication();
    app.setGlobalPrefix('api');
    app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
    await app.init();
  });
  afterAll(async () => {
    await app?.close();
    await db.$disconnect();
    if (databaseCreated)
      await admin.query(`DROP DATABASE ${name} WITH (FORCE)`);
    await admin.end();
  });
  const api = () => request(app.getHttpServer() as Server);
  const resource = (extra = {}) =>
    service.create('RESOURCE', owner, {
      title: 'Book',
      type: 'PDF',
      accessPolicy: 'FREE',
      ...extra,
    });
  const collection = (extra = {}) =>
    service.create('COLLECTION', owner, {
      title: 'Collection',
      accessPolicy: 'FREE',
      ...extra,
    });
  async function ready(id: string, type: 'PDF' | 'VIDEO' = 'PDF') {
    let row = await db.resource.findUniqueOrThrow({ where: { id } });
    const upload = await service.upload(
      'RESOURCE',
      id,
      owner,
      row.version,
      'RESOURCE_CONTENT',
      type === 'PDF' ? 'application/pdf' : 'video/mp4',
      100,
    );
    await service.complete('RESOURCE', id, owner, upload.fileId, row.version);
    if (type === 'VIDEO') {
      row = await db.resource.findUniqueOrThrow({ where: { id } });
      const image = await service.upload(
        'RESOURCE',
        id,
        owner,
        row.version,
        'RESOURCE_THUMBNAIL',
        'image/png',
        100,
      );
      await service.complete('RESOURCE', id, owner, image.fileId, row.version);
    }
    row = await db.resource.findUniqueOrThrow({ where: { id } });
    return service.transition('RESOURCE', id, owner, row.version, 'publish');
  }

  it('serves anonymous FREE metadata/media, validates auth and emits no-store responses', async () => {
    const item = await resource();
    await ready(item.id);
    const response = await api()
      .get(`/api/v1/resources/${item.id}`)
      .expect(200);
    expect(response.headers['cache-control']).toBe('private, no-store');
    expect(JSON.stringify(response.body)).not.toMatch(
      /pinHash|reference|signature|storage.test/,
    );
    await api()
      .post(`/api/v1/resources/${item.id}/access`)
      .expect(201)
      .expect((body) => expect(body.body.accessSource).toBe('FREE'));
    await api()
      .get(`/api/v1/resources/${item.id}`)
      .set('Authorization', 'broken')
      .expect(401);
    await api()
      .get(`/api/v1/resources/${item.id}`)
      .set('Authorization', 'Bearer expired')
      .expect(401);
    revoked.add(other);
    await api()
      .get(`/api/v1/resources/${item.id}`)
      .set('Authorization', `Bearer ${other}`)
      .expect(401);
    revoked.delete(other);
    await api()
      .post('/api/v1/resources')
      .send({
        title: 'Spoof',
        type: 'PDF',
        accessPolicy: 'FREE',
        ownerUserId: other,
      })
      .set('Authorization', `Bearer ${owner}`)
      .expect(400);
  });
  it('hides owner-only rows from lists, counts, details and images while allowing owner access', async () => {
    const item = await resource({
      accessPolicy: 'OWNER_ONLY',
      title: 'UniquePrivateTitle',
    });
    await ready(item.id);
    const response = await api()
      .get('/api/v1/resources?search=UniquePrivateTitle')
      .expect(200);
    expect(response.body.total).toBe(0);
    await api().get(`/api/v1/resources/${item.id}`).expect(404);
    await api()
      .get(`/api/v1/resources/${item.id}/thumbnail`)
      .set('Authorization', `Bearer ${other}`)
      .expect(404);
    await api()
      .post(`/api/v1/resources/${item.id}/access`)
      .set('Authorization', `Bearer ${other}`)
      .expect(404);
    await api()
      .post(`/api/v1/resources/${item.id}/access`)
      .set('Authorization', `Bearer ${owner}`)
      .expect(201);
  });
  it('requires exact active unexpired enrollment and current ACTIVE institution status', async () => {
    const item = await resource({
      institutionId: school,
      accessPolicy: 'ENROLLED',
    });
    await ready(item.id);
    await api().get(`/api/v1/resources/${item.id}`).expect(200);
    await api().post(`/api/v1/resources/${item.id}/access`).expect(401);
    await api()
      .post(`/api/v1/resources/${item.id}/access`)
      .set('Authorization', `Bearer ${other}`)
      .expect(403);
    await db.enrollment.create({
      data: { institutionId: school, userId: other, status: 'ACTIVE' },
    });
    expect((await service.deliver(item.id, other)).accessSource).toBe(
      'ENROLLMENT',
    );
    for (const status of [
      'SUSPENDED',
      'CANCELLED',
      'PENDING',
      'EXPIRED',
    ] as const) {
      await db.enrollment.update({
        where: {
          institutionId_userId: { institutionId: school, userId: other },
        },
        data: { status },
      });
      await expect(service.deliver(item.id, other)).rejects.toMatchObject({
        status: 403,
      });
    }
    await db.enrollment.update({
      where: { institutionId_userId: { institutionId: school, userId: other } },
      data: { status: 'ACTIVE', expiresAt: new Date() },
    });
    await expect(service.deliver(item.id, other)).rejects.toMatchObject({
      status: 403,
    });
    expect((await service.deliver(item.id, owner)).accessSource).toBe(
      'INSTITUTION_ADMIN',
    );
    await db.institution.update({
      where: { id: school },
      data: { status: 'SUSPENDED' },
    });
    await expect(
      service.deliver(item.id, owner, { preview: true }),
    ).rejects.toMatchObject({ status: 404 });
    await db.institution.update({
      where: { id: school },
      data: { status: 'ACTIVE' },
    });
  });
  it('requires verified video thumbnails and preserves active content on a failed replacement', async () => {
    const item = await resource({ type: 'VIDEO' });
    const upload = await service.upload(
      'RESOURCE',
      item.id,
      owner,
      1,
      'RESOURCE_CONTENT',
      'video/mp4',
      100,
    );
    await service.complete('RESOURCE', item.id, owner, upload.fileId, 1);
    await expect(
      service.transition('RESOURCE', item.id, owner, 2, 'publish'),
    ).rejects.toMatchObject({ status: 409 });
    const image = await service.upload(
      'RESOURCE',
      item.id,
      owner,
      2,
      'RESOURCE_THUMBNAIL',
      'image/png',
      100,
    );
    await service.complete('RESOURCE', item.id, owner, image.fileId, 2);
    await service.transition('RESOURCE', item.id, owner, 3, 'publish');
    const replacement = await service.upload(
      'RESOURCE',
      item.id,
      owner,
      4,
      'RESOURCE_CONTENT',
      'video/mp4',
      99,
    );
    await expect(
      service.complete('RESOURCE', item.id, owner, replacement.fileId, 4),
    ).rejects.toMatchObject({ status: 400 });
    expect((await service.deliver(item.id)).fileId).toBe(upload.fileId);
    expect(
      await db.resourceCleanupJob.findUnique({
        where: { fileId: replacement.fileId },
      }),
    ).not.toBeNull();
  });
  it('makes concurrent completion idempotent and prevents replaced uploads reactivating', async () => {
    const item = await resource();
    const first = await service.upload(
      'RESOURCE',
      item.id,
      owner,
      1,
      'RESOURCE_CONTENT',
      'application/pdf',
      100,
    );
    await Promise.all([
      service.complete('RESOURCE', item.id, owner, first.fileId, 1),
      service.complete('RESOURCE', item.id, owner, first.fileId, 1),
    ]);
    expect(
      await db.resourceFile.count({
        where: { resourceId: item.id, attached: true },
      }),
    ).toBe(1);
    const next = await service.upload(
      'RESOURCE',
      item.id,
      owner,
      2,
      'RESOURCE_CONTENT',
      'application/pdf',
      100,
    );
    await service.complete('RESOURCE', item.id, owner, next.fileId, 2);
    await expect(
      service.complete('RESOURCE', item.id, owner, first.fileId, 3),
    ).rejects.toMatchObject({ status: 409 });
  });
  it('scopes completion to uploader and target and rechecks institution administration', async () => {
    const item = await resource({
      institutionId: school,
      accessPolicy: 'ENROLLED',
    });
    const upload = await service.upload(
      'RESOURCE',
      item.id,
      owner,
      1,
      'RESOURCE_CONTENT',
      'application/pdf',
      100,
    );
    await expect(
      service.complete('RESOURCE', item.id, other, upload.fileId, 1),
    ).rejects.toMatchObject({ status: 404 });
    const wrongTarget = await resource();
    await expect(
      service.complete('RESOURCE', wrongTarget.id, owner, upload.fileId, 1),
    ).rejects.toMatchObject({ status: 404 });
    await db.institutionAdmin.delete({
      where: { institutionId_userId: { institutionId: school, userId: owner } },
    });
    await expect(
      service.complete('RESOURCE', item.id, owner, upload.fileId, 1),
    ).rejects.toMatchObject({ status: 404 });
    await db.institutionAdmin.create({
      data: { institutionId: school, userId: owner },
    });
    await db.resourceFile.update({
      where: { id: upload.fileId },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });
    await expect(
      service.complete('RESOURCE', item.id, owner, upload.fileId, 1),
    ).rejects.toMatchObject({ status: 409 });
  });
  it('isolates collection PIN grants from standalone children and other collections', async () => {
    const item = await resource({ accessPolicy: 'PURCHASE', pin: '001234' });
    await ready(item.id);
    const parent = await collection({
      accessPolicy: 'PURCHASE',
      pin: '009999',
    });
    await service.changeItems(parent.id, owner, 1, { add: item.id });
    await service.transition('COLLECTION', parent.id, owner, 2, 'publish');
    await service.unlock('COLLECTION', parent.id, other, '009999', 'bundle-ip');
    expect(
      (await service.deliver(item.id, other, { collectionId: parent.id }))
        .accessSource,
    ).toBe('COLLECTION_PIN');
    await expect(service.deliver(item.id, other)).rejects.toMatchObject({
      status: 403,
    });
    const second = await collection({
      accessPolicy: 'PURCHASE',
      pin: '002222',
    });
    await service.changeItems(second.id, owner, 1, { add: item.id });
    await service.transition('COLLECTION', second.id, owner, 2, 'publish');
    await expect(
      service.deliver(item.id, other, { collectionId: second.id }),
    ).rejects.toMatchObject({ status: 403 });
    await service.unlock('RESOURCE', item.id, other, '001234', 'child-ip');
    await expect(
      service.deliver(item.id, other, { collectionId: second.id }),
    ).rejects.toMatchObject({ status: 403 });
    const current = await db.resource.findUniqueOrThrow({
      where: { id: item.id },
    });
    await service.rotatePin(
      'RESOURCE',
      item.id,
      owner,
      current.version,
      '008888',
    );
    await expect(service.deliver(item.id, other)).rejects.toMatchObject({
      status: 403,
    });
    await service.changeItems(parent.id, owner, 3, { remove: item.id });
    await expect(
      service.deliver(item.id, other, { collectionId: parent.id }),
    ).rejects.toMatchObject({ status: 404 });
  });
  it('rejects policy downgrades, stale writes and partial reorders without changing standalone visibility', async () => {
    const parent = await collection({
      accessPolicy: 'PURCHASE',
      pin: '001234',
    });
    const item = await resource({
      accessPolicy: 'PURCHASE',
      pin: '005555',
      collectionId: parent.id,
      collectionVersion: 1,
    });
    await expect(
      service.update('COLLECTION', parent.id, owner, {
        version: 2,
        accessPolicy: 'FREE',
      }),
    ).rejects.toMatchObject({ status: 409 });
    await expect(
      service.changeItems(parent.id, owner, 1, { order: [item.id] }),
    ).rejects.toMatchObject({ status: 409 });
    await expect(
      service.changeItems(parent.id, owner, 2, { order: [] }),
    ).rejects.toMatchObject({ status: 409 });
    await service.changeItems(parent.id, owner, 2, { remove: item.id });
    expect(
      (await db.resource.findUniqueOrThrow({ where: { id: item.id } }))
        .isStandalone,
    ).toBe(false);
    await ready(item.id);
    await expect(service.deliver(item.id, other)).rejects.toMatchObject({
      status: 404,
    });
  });
  it('serializes simultaneous membership and policy mutations and rejects a stale loser', async () => {
    const parent = await collection();
    const one = await resource();
    const two = await resource();
    const outcomes = await Promise.allSettled([
      service.changeItems(parent.id, owner, 1, { add: one.id }),
      service.changeItems(parent.id, owner, 1, { add: two.id }),
    ]);
    expect(
      outcomes.filter((result) => result.status === 'fulfilled'),
    ).toHaveLength(1);
    expect(
      await db.resourceCollectionItem.count({
        where: { collectionId: parent.id },
      }),
    ).toBe(1);
  });
  it('paginates and counts the combined institution feed with strict public filters', async () => {
    const item = await resource({
      title: 'InstitutionFeedUnique',
      institutionId: school,
    });
    await ready(item.id);
    const parent = await collection({
      title: 'InstitutionFeedUnique',
      institutionId: school,
    });
    await service.changeItems(parent.id, owner, 1, { add: item.id });
    await service.transition('COLLECTION', parent.id, owner, 2, 'publish');
    await resource({ title: 'InstitutionFeedUnique', institutionId: school });
    const first = await api()
      .get(
        `/api/v1/institutions/${school}/resources?search=InstitutionFeedUnique&limit=1`,
      )
      .expect(200);
    const second = await api()
      .get(
        `/api/v1/institutions/${school}/resources?search=InstitutionFeedUnique&limit=1&page=2`,
      )
      .expect(200);
    expect(first.body.total).toBe(2);
    expect(first.body.totalPages).toBe(2);
    expect(
      new Set([first.body.list[0].kind, second.body.list[0].kind]),
    ).toEqual(new Set(['RESOURCE', 'COLLECTION']));
    await api()
      .get(`/api/v1/institutions/${school}/resources?status=DRAFT`)
      .expect(400);
  });
  it('persists cleanup through retries and safely claims across worker instances', async () => {
    const item = await resource();
    const upload = await service.upload(
      'RESOURCE',
      item.id,
      owner,
      1,
      'RESOURCE_CONTENT',
      'application/pdf',
      100,
    );
    await db.resourceFile.update({
      where: { id: upload.fileId },
      data: { expiresAt: new Date(Date.now() - 3 * limits.cleanupGraceMs) },
    });
    storage.delete.mockRejectedValueOnce(new Error('Provider unavailable'));
    const worker = new MaterialCleanupWorker(db, storage, limits);
    await worker.tick();
    let job = await db.resourceCleanupJob.findUniqueOrThrow({
      where: { fileId: upload.fileId },
    });
    expect(job.completedAt).toBeNull();
    expect(job.lastError).toBe('STORAGE_UNAVAILABLE');
    await db.resourceCleanupJob.update({
      where: { fileId: upload.fileId },
      data: { nextAttemptAt: new Date(Date.now() - 1000) },
    });
    const before = storage.delete.mock.calls.length;
    await Promise.all([
      worker.tick(),
      new MaterialCleanupWorker(db, storage, limits).tick(),
    ]);
    expect(storage.delete.mock.calls.length - before).toBe(1);
    job = await db.resourceCleanupJob.findUniqueOrThrow({
      where: { fileId: upload.fileId },
    });
    expect(job.lastError).toBe('VERIFY_LATE_UPLOAD');
    expect(job.completedAt).toBeNull();
    await db.resourceCleanupJob.update({
      where: { fileId: upload.fileId },
      data: { nextAttemptAt: new Date(Date.now() - 1000) },
    });
    await new MaterialCleanupWorker(db, storage, limits).tick();
    expect(
      (
        await db.resourceFile.findUniqueOrThrow({
          where: { id: upload.fileId },
        })
      ).cleanupState,
    ).toBe('DONE');
    await expect(
      service.complete('RESOURCE', item.id, owner, upload.fileId, 1),
    ).rejects.toMatchObject({ status: 409 });
  });
  it('rejects old-PIN grants when rotation wins the verify-then-grant race', async () => {
    const item = await resource({ accessPolicy: 'PURCHASE', pin: '001234' });
    const published = await ready(item.id);
    const verify = jest
      .spyOn(verifier, 'verify')
      .mockImplementationOnce(async () => {
        await service.rotatePin(
          'RESOURCE',
          item.id,
          owner,
          published.version,
          '009999',
        );
        return true;
      });
    await expect(
      service.unlock('RESOURCE', item.id, other, '001234', 'race-ip'),
    ).rejects.toMatchObject({ status: 409 });
    expect(
      await db.resourceUnlockGrant.findUnique({
        where: { resourceId_userId: { resourceId: item.id, userId: other } },
      }),
    ).toBeNull();
    verify.mockRestore();
    await service.unlock('RESOURCE', item.id, other, '009999', 'race-ip');
    const current = await db.resource.findUniqueOrThrow({
      where: { id: item.id },
    });
    await service.revoke('RESOURCE', item.id, owner, current.version, other);
    await expect(service.deliver(item.id, other)).rejects.toMatchObject({
      status: 403,
    });
    for (let i = 0; i < 3; i++)
      await expect(
        service.unlock('RESOURCE', item.id, other, '000000', 'rate-ip'),
      ).rejects.toMatchObject({ status: 403 });
    await expect(
      service.unlock('RESOURCE', item.id, other, '009999', 'rate-ip'),
    ).rejects.toMatchObject({ status: 429 });
  });
  it('allows only one simultaneous reorder/publish mutation at the expected version', async () => {
    const parent = await collection();
    const first = await resource();
    const second = await resource();
    await ready(first.id);
    await ready(second.id);
    await service.changeItems(parent.id, owner, 1, { add: first.id });
    await service.changeItems(parent.id, owner, 2, { add: second.id });
    const outcomes = await Promise.allSettled([
      service.changeItems(parent.id, owner, 3, {
        order: [second.id, first.id],
      }),
      service.transition('COLLECTION', parent.id, owner, 3, 'publish'),
    ]);
    expect(
      outcomes.filter((result) => result.status === 'fulfilled'),
    ).toHaveLength(1);
    const members = await db.resourceCollectionItem.findMany({
      where: { collectionId: parent.id },
      orderBy: { position: 'asc' },
    });
    expect(members.map((member) => member.position)).toEqual([0, 1]);
    expect(new Set(members.map((member) => member.resourceId))).toEqual(
      new Set([first.id, second.id]),
    );
  });
  it('preflights legacy owners and backfills ordered memberships as unverified drafts', async () => {
    const client = new Client({ connectionString: config.databaseUrl });
    await client.connect();
    try {
      await client.query(
        'CREATE TABLE "ResourceCollection" (id uuid PRIMARY KEY, title text, description text, created_at timestamptz, updated_at timestamptz); CREATE TABLE resources (id uuid PRIMARY KEY, type resource_type, title text, description text, collection_id uuid, public_url text, private_url text, created_at timestamptz, updated_at timestamptz)',
      );
      await client.query(
        readFileSync(
          resolve('prisma/study-materials/01-backfill-map.sql'),
          'utf8',
        ),
      );
      const parent = randomUUID(),
        a = randomUUID(),
        b = randomUUID();
      await client.query(
        'INSERT INTO "ResourceCollection" VALUES ($1, $2, NULL, now(), now())',
        [parent, 'Legacy collection'],
      );
      await client.query(
        "INSERT INTO resources VALUES ($1, 'PDF', 'Legacy A', NULL, $3, 'https://untrusted/a', 'https://untrusted/private', now()-interval '1 day',now()), ($2, 'PDF', 'Legacy B', NULL, $3, 'https://untrusted/b', 'https://untrusted/private', now(),now())",
        [a, b, parent],
      );
      const backfill = readFileSync(
        resolve('prisma/study-materials/02-preflight-and-backfill.sql'),
        'utf8',
      );
      await expect(client.query(backfill)).rejects.toThrow(
        'Study material backfill preflight failed',
      );
      await client.query('ROLLBACK');
      expect(await db.resource.count({ where: { id: { in: [a, b] } } })).toBe(
        0,
      );
      for (const [kind, id] of [
        ['COLLECTION', parent],
        ['RESOURCE', a],
        ['RESOURCE', b],
      ])
        await client.query(
          "INSERT INTO study_material_backfill_map(kind,legacy_id,owner_user_id,actor_user_id,access_policy) VALUES ($1,$2,$3,$3,'FREE')",
          [kind, id, owner],
        );
      await client.query(backfill);
      const rows = await db.resourceCollectionItem.findMany({
        where: { collectionId: parent },
        orderBy: { position: 'asc' },
      });
      expect(rows.map((row) => row.resourceId)).toEqual([a, b]);
      expect(
        (await db.resource.findUniqueOrThrow({ where: { id: a } })).status,
      ).toBe('DRAFT');
      expect(
        await db.resourceFile.count({ where: { resourceId: { in: [a, b] } } }),
      ).toBe(0);
      expect(
        (await client.query('SELECT count(*) AS total FROM resources')).rows[0]
          .total,
      ).toBe('2');
    } finally {
      await client.end();
    }
  });
  it('rejects spoofed upload MIME, oversized images, profile-file reuse and unknown completion evidence', async () => {
    const item = await resource();
    await expect(
      service.upload(
        'RESOURCE',
        item.id,
        owner,
        1,
        'RESOURCE_CONTENT',
        'video/mp4',
        100,
      ),
    ).rejects.toMatchObject({ status: 400 });
    await expect(
      service.upload(
        'RESOURCE',
        item.id,
        owner,
        1,
        'RESOURCE_THUMBNAIL',
        'image/png',
        limits.image + 1,
      ),
    ).rejects.toMatchObject({ status: 400 });
    const profileId = randomUUID();
    await db.profilePictureUpload.create({
      data: {
        id: profileId,
        userId: owner,
        fileType: 'image/png',
        sizeBytes: 100,
        reference: { provider: 'FAKE', locator: {} },
        expiresAt: new Date(Date.now() + 3600000),
      },
    });
    await expect(
      service.complete('RESOURCE', item.id, owner, profileId, 1),
    ).rejects.toMatchObject({ status: 404 });
    await api()
      .post(
        '/api/v1/resources/' + item.id + '/uploads/' + profileId + '/complete',
      )
      .set('Authorization', 'Bearer ' + owner)
      .send({ version: 1, url: 'https://evil.test', sizeBytes: 100 })
      .expect(400);
  });
  it('blocks a completion whose inspection overlaps terminal deletion', async () => {
    const item = await resource();
    const upload = await service.upload(
      'RESOURCE',
      item.id,
      owner,
      1,
      'RESOURCE_CONTENT',
      'application/pdf',
      100,
    );
    const inspection = storage.inspect.mockImplementationOnce(
      async (reference) => {
        await service.transition('RESOURCE', item.id, owner, 1, 'delete');
        return { reference, sizeBytes: 100 };
      },
    );
    await expect(
      service.complete('RESOURCE', item.id, owner, upload.fileId, 1),
    ).rejects.toMatchObject({ status: 404 });
    expect(
      (
        await db.resourceFile.findUniqueOrThrow({
          where: { id: upload.fileId },
        })
      ).attached,
    ).toBe(false);
    expect(
      await db.resourceCleanupJob.findUnique({
        where: { fileId: upload.fileId },
      }),
    ).not.toBeNull();
    expect(inspection).toHaveBeenCalled();
    await expect(
      service.deliver(item.id, owner, { preview: true }),
    ).rejects.toMatchObject({ status: 404 });
  });
  it('suppresses archived collection children immediately and retains standalone FREE access in locked bundles', async () => {
    const item = await resource();
    const published = await ready(item.id);
    const parent = await collection({
      accessPolicy: 'PURCHASE',
      pin: '001234',
    });
    await service.changeItems(parent.id, owner, 1, { add: item.id });
    await service.transition('COLLECTION', parent.id, owner, 2, 'publish');
    expect((await service.deliver(item.id)).accessSource).toBe('FREE');
    await expect(
      service.deliver(item.id, other, { collectionId: parent.id }),
    ).rejects.toMatchObject({ status: 403 });
    const privateItem = await resource({ accessPolicy: 'OWNER_ONLY' });
    await expect(
      service.changeItems(parent.id, owner, 3, { add: privateItem.id }),
    ).rejects.toMatchObject({ status: 409 });
    await service.transition(
      'RESOURCE',
      item.id,
      owner,
      published.version,
      'archive',
    );
    const items = await service.items(parent.id, other, {
      page: 1,
      limit: 20,
      sort: 'newest',
    });
    expect(items.total).toBe(0);
    await expect(
      service.deliver(item.id, owner, { collectionId: parent.id }),
    ).rejects.toMatchObject({ status: 404 });
    expect(
      (await service.deliver(item.id, owner, { preview: true })).accessSource,
    ).toBe('OWNER');
    const parentVersion = (
      await db.resourceCollection.findUniqueOrThrow({
        where: { id: parent.id },
      })
    ).version;
    await service.transition(
      'COLLECTION',
      parent.id,
      owner,
      parentVersion,
      'delete',
    );
    expect(
      (await db.resource.findUniqueOrThrow({ where: { id: item.id } })).status,
    ).toBe('ARCHIVED');
  });
  it('keeps live attached files out of cleanup even if a stale job exists', async () => {
    const item = await resource();
    await ready(item.id);
    const file = await db.resourceFile.findFirstOrThrow({
      where: { resourceId: item.id, attached: true },
    });
    await db.resourceCleanupJob.create({
      data: { fileId: file.id, nextAttemptAt: new Date(Date.now() - 1000) },
    });
    await db.resourceFile.update({
      where: { id: file.id },
      data: { expiresAt: new Date(Date.now() - 3 * limits.cleanupGraceMs) },
    });
    const calls = storage.delete.mock.calls.length;
    await new MaterialCleanupWorker(db, storage, limits).tick();
    expect(storage.delete.mock.calls.length).toBe(calls);
    expect((await service.deliver(item.id)).fileId).toBe(file.id);
  });
  it('does not resurrect a grant when owner revocation wins an in-flight PIN verification', async () => {
    const item = await resource({ accessPolicy: 'PURCHASE', pin: '001234' });
    const published = await ready(item.id);
    await service.unlock(
      'RESOURCE',
      item.id,
      other,
      '001234',
      'revoke-race-ip',
    );
    const verify = jest
      .spyOn(verifier, 'verify')
      .mockImplementationOnce(async () => {
        await service.revoke(
          'RESOURCE',
          item.id,
          owner,
          published.version,
          other,
        );
        return true;
      });
    await expect(
      service.unlock('RESOURCE', item.id, other, '001234', 'revoke-race-ip'),
    ).rejects.toMatchObject({ status: 409 });
    verify.mockRestore();
    await expect(service.deliver(item.id, other)).rejects.toMatchObject({
      status: 403,
    });
  });
});
