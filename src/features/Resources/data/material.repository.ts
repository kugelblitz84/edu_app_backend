import { ConflictException, Injectable } from '@nestjs/common';
import {
  Prisma,
  type Resource,
  type ResourceCollection,
  type ResourceFile,
} from '@prisma/client';
import { z } from 'zod';
import { PrismaService } from '../../../core/database/prisma.service';
import { validGrant } from '../domain/material.policy';
import {
  MaterialRepository,
  MaterialStore,
  type CatalogScope,
} from '../domain/material.repository';
import type {
  CatalogQuery,
  Grant,
  Kind,
  Material,
  MaterialFile,
  Member,
  ViewerFacts,
} from '../domain/material.types';

const reference = z
  .object({ provider: z.string(), locator: z.record(z.string(), z.unknown()) })
  .strict();
export function mapFile(row: ResourceFile): MaterialFile {
  return {
    ...row,
    reference: reference.parse(row.reference),
    verifiedReference: row.verifiedReference
      ? reference.parse(row.verifiedReference)
      : null,
  };
}
function mapMaterial(row: Resource | ResourceCollection, kind: Kind): Material {
  return {
    ...row,
    kind,
    metadata: row.metadata as Record<string, unknown> | null,
  };
}
const json = (value: unknown): Prisma.InputJsonValue =>
  JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;

class PrismaMaterialStore extends MaterialStore {
  constructor(protected readonly db: Prisma.TransactionClient) {
    super();
  }

  async find(kind: Kind, id: string): Promise<Material | null> {
    const row =
      kind === 'RESOURCE'
        ? await this.db.resource.findUnique({ where: { id } })
        : await this.db.resourceCollection.findUnique({ where: { id } });
    return row ? mapMaterial(row, kind) : null;
  }
  private data(item: Material) {
    return {
      id: item.id,
      title: item.title,
      description: item.description,
      ownerUserId: item.ownerUserId,
      institutionId: item.institutionId,
      accessPolicy: item.accessPolicy,
      status: item.status,
      priceAmountMinor: item.priceAmountMinor,
      currency: item.currency,
      pinHash: item.pinHash,
      unlockVersion: item.unlockVersion,
      version: item.version,
      metadata: item.metadata ? json(item.metadata) : Prisma.DbNull,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
      publishedAt: item.publishedAt,
      archivedAt: item.archivedAt,
      deletedAt: item.deletedAt,
    };
  }
  async insert(item: Material, actor: string) {
    if (item.kind === 'RESOURCE')
      await this.db.resource.create({
        data: {
          ...this.data(item),
          type: item.type!,
          isStandalone: item.isStandalone!,
          uploadedByUserId: actor,
        },
      });
    else
      await this.db.resourceCollection.create({
        data: { ...this.data(item), createdByUserId: actor },
      });
  }
  async save(item: Material) {
    if (item.kind === 'RESOURCE')
      await this.db.resource.update({
        where: { id: item.id },
        data: { ...this.data(item), isStandalone: item.isStandalone },
      });
    else
      await this.db.resourceCollection.update({
        where: { id: item.id },
        data: this.data(item),
      });
  }
  async admin(institutionId: string, userId: string): Promise<boolean> {
    return !!(await this.db.institutionAdmin.findFirst({
      where: { institutionId, userId, institution: { status: 'ACTIVE' } },
    }));
  }
  async facts(item: Material, userId?: string): Promise<ViewerFacts> {
    const now = new Date();
    const institution = item.institutionId
      ? await this.db.institution.findUnique({
          where: { id: item.institutionId },
          select: { status: true },
        })
      : null;
    const admin = !!(
      userId &&
      item.institutionId &&
      (await this.admin(item.institutionId, userId))
    );
    const enrollment =
      userId && item.institutionId
        ? await this.db.enrollment.findUnique({
            where: {
              institutionId_userId: {
                institutionId: item.institutionId,
                userId,
              },
            },
            select: { status: true, expiresAt: true },
          })
        : null;
    const grant = !userId
      ? null
      : item.kind === 'RESOURCE'
        ? await this.db.resourceUnlockGrant.findUnique({
            where: { resourceId_userId: { resourceId: item.id, userId } },
          })
        : await this.db.resourceCollectionUnlockGrant.findUnique({
            where: { collectionId_userId: { collectionId: item.id, userId } },
          });
    return {
      userId,
      admin,
      institutionActive:
        !item.institutionId || institution?.status === 'ACTIVE',
      enrolled:
        enrollment?.status === 'ACTIVE' &&
        (!enrollment.expiresAt || enrollment.expiresAt > now),
      grant: validGrant(grant, item, now),
    };
  }
  members(collectionId: string): Promise<Member[]> {
    return this.db.resourceCollectionItem.findMany({
      where: { collectionId },
      orderBy: [{ position: 'asc' }, { resourceId: 'asc' }],
    });
  }
  async collections(resourceId: string): Promise<Material[]> {
    const rows = await this.db.resourceCollection.findMany({
      where: { items: { some: { resourceId } }, status: { not: 'DELETED' } },
    });
    return rows.map((row) => mapMaterial(row, 'COLLECTION'));
  }
  async replaceMembers(collectionId: string, members: Member[]) {
    // Deleting and reinserting inside the locked transaction avoids transient position collisions.
    await this.db.resourceCollectionItem.deleteMany({
      where: { collectionId },
    });
    if (members.length)
      await this.db.resourceCollectionItem.createMany({ data: members });
  }
  async file(id: string): Promise<MaterialFile | null> {
    const row = await this.db.resourceFile.findUnique({ where: { id } });
    return row ? mapFile(row) : null;
  }
  async files(item: Material): Promise<MaterialFile[]> {
    const rows = await this.db.resourceFile.findMany({
      where:
        item.kind === 'RESOURCE'
          ? {
              resourceId: item.id,
              OR: [{ attached: true }, { state: 'PENDING' }],
            }
          : {
              collectionId: item.id,
              OR: [{ attached: true }, { state: 'PENDING' }],
            },
    });
    return rows.map(mapFile);
  }
  async saveFile(file: MaterialFile) {
    const data = {
      ...file,
      reference: json(file.reference),
      verifiedReference: file.verifiedReference
        ? json(file.verifiedReference)
        : Prisma.DbNull,
    };
    await this.db.resourceFile.upsert({
      where: { id: file.id },
      create: data,
      update: data,
    });
  }
  pendingCount(uploaderUserId: string): Promise<number> {
    return this.db.resourceFile.count({
      where: {
        uploaderUserId,
        state: 'PENDING',
        expiresAt: { gt: new Date() },
      },
    });
  }
  async enqueue(file: MaterialFile, after: Date) {
    await this.db.resourceCleanupJob.upsert({
      where: { fileId: file.id },
      create: { fileId: file.id, nextAttemptAt: after },
      update: {},
    });
  }
  async grant(item: Material, userId: string, grant: Grant) {
    const data = { ...grant, grantedAt: new Date(), source: 'PIN' };
    if (item.kind === 'RESOURCE')
      await this.db.resourceUnlockGrant.upsert({
        where: { resourceId_userId: { resourceId: item.id, userId } },
        create: { ...data, resourceId: item.id },
        update: data,
      });
    else
      await this.db.resourceCollectionUnlockGrant.upsert({
        where: { collectionId_userId: { collectionId: item.id, userId } },
        create: { ...data, collectionId: item.id },
        update: data,
      });
  }
  async revoke(item: Material, userId: string) {
    if (item.kind === 'RESOURCE')
      await this.db.resourceUnlockGrant.updateMany({
        where: { resourceId: item.id, userId },
        data: { revokedAt: new Date() },
      });
    else
      await this.db.resourceCollectionUnlockGrant.updateMany({
        where: { collectionId: item.id, userId },
        data: { revokedAt: new Date() },
      });
  }
  async catalog(query: CatalogQuery, scope: CatalogScope) {
    const queries: Prisma.Sql[] = [];
    for (const kind of ['RESOURCE', 'COLLECTION'] as const) {
      if (
        (scope.kind && scope.kind !== kind) ||
        (query.type && kind === 'COLLECTION')
      )
        continue;
      const table = Prisma.raw(
        kind === 'RESOURCE' ? 'study_resources' : 'resource_collections',
      );
      const conditions = [Prisma.sql`m.status <> 'DELETED'`];
      if (scope.management) {
        if (scope.ownerUserId)
          conditions.push(
            Prisma.sql`m.owner_user_id = ${scope.ownerUserId}::uuid AND m.institution_id IS NULL`,
          );
        if (query.status)
          conditions.push(Prisma.sql`m.status::text = ${query.status}`);
      } else {
        conditions.push(
          Prisma.sql`m.status = 'PUBLISHED' AND m.access_policy <> 'OWNER_ONLY' AND (m.institution_id IS NULL OR EXISTS (SELECT 1 FROM institutions i WHERE i.id = m.institution_id AND i.institution_status = 'ACTIVE'))`,
        );
        if (kind === 'RESOURCE')
          conditions.push(Prisma.sql`m.is_standalone = true`);
      }
      const institutionId = scope.institutionId ?? query.institutionId;
      if (institutionId)
        conditions.push(Prisma.sql`m.institution_id = ${institutionId}::uuid`);
      if (query.search)
        conditions.push(
          Prisma.sql`(m.title ILIKE ${'%' + query.search + '%'} OR m.description ILIKE ${'%' + query.search + '%'})`,
        );
      if (query.accessPolicy)
        conditions.push(
          Prisma.sql`m.access_policy::text = ${query.accessPolicy}`,
        );
      if (query.type && kind === 'RESOURCE')
        conditions.push(Prisma.sql`m.type::text = ${query.type}`);
      queries.push(
        Prisma.sql`SELECT m.id, ${kind}::text AS kind, m.created_at, m.title FROM ${table} m WHERE ${Prisma.join(conditions, ' AND ')}`,
      );
    }
    const union = queries.length
      ? Prisma.join(queries, ' UNION ALL ')
      : Prisma.sql`SELECT NULL::uuid AS id, NULL::text AS kind, NULL::timestamptz AS created_at, NULL::text AS title WHERE false`;
    const order = Prisma.raw(
      query.sort === 'title'
        ? 'title ASC, id ASC, kind ASC'
        : query.sort === 'oldest'
          ? 'created_at ASC, id ASC, kind ASC'
          : 'created_at DESC, id DESC, kind ASC',
    );
    const [count] = await this.db.$queryRaw<{ total: bigint }[]>(
      Prisma.sql`SELECT count(*) AS total FROM (${union}) catalog`,
    );
    const page = await this.db.$queryRaw<{ id: string; kind: Kind }[]>(
      Prisma.sql`SELECT id, kind FROM (${union}) catalog ORDER BY ${order} LIMIT ${query.limit} OFFSET ${(query.page - 1) * query.limit}`,
    );
    const [resources, collections] = await Promise.all([
      this.db.resource.findMany({
        where: {
          id: {
            in: page
              .filter((row) => row.kind === 'RESOURCE')
              .map((row) => row.id),
          },
        },
      }),
      this.db.resourceCollection.findMany({
        where: {
          id: {
            in: page
              .filter((row) => row.kind === 'COLLECTION')
              .map((row) => row.id),
          },
        },
      }),
    ]);
    const lookup = new Map<string, Material>(
      [
        ...resources.map((row) => mapMaterial(row, 'RESOURCE')),
        ...collections.map((row) => mapMaterial(row, 'COLLECTION')),
      ].map((row) => [row.kind + row.id, row]),
    );
    return {
      total: Number(count.total),
      list: page.map((row) => lookup.get(row.kind + row.id)!),
    };
  }
  async memberPage(
    collectionId: string,
    query: CatalogQuery,
    management: boolean,
  ) {
    const where: Prisma.ResourceCollectionItemWhereInput = {
      collectionId,
      resource: {
        status: management ? { not: 'DELETED' } : 'PUBLISHED',
        ...(management ? {} : { accessPolicy: { not: 'OWNER_ONLY' } }),
      },
    };
    const [total, rows] = await Promise.all([
      this.db.resourceCollectionItem.count({ where }),
      this.db.resourceCollectionItem.findMany({
        where,
        include: { resource: true },
        orderBy: [{ position: 'asc' }, { resourceId: 'asc' }],
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
    ]);
    return {
      total,
      list: rows.map((row) => ({
        item: mapMaterial(row.resource, 'RESOURCE'),
        position: row.position,
      })),
    };
  }
}

@Injectable()
export class PrismaMaterialRepository
  extends PrismaMaterialStore
  implements MaterialRepository
{
  constructor(private readonly prisma: PrismaService) {
    super(prisma);
  }
  async transaction<T>(work: (store: MaterialStore) => Promise<T>): Promise<T> {
    for (let attempt = 0; ; attempt++) {
      try {
        return await this.prisma.$transaction(
          async (tx) => {
            // One consistent lock order covers policy, membership, attachment, and cleanup races.
            // This deliberately favors correctness at the current feature scale over write throughput.
            await tx.$executeRaw`SELECT pg_advisory_xact_lock(74121017)`;
            return work(new PrismaMaterialStore(tx));
          },
          {
            isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
            timeout: 15000,
          },
        );
      } catch (error) {
        if (
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === 'P2034' &&
          attempt < 3
        )
          continue;
        if (
          error instanceof Prisma.PrismaClientKnownRequestError &&
          ['P2002', 'P2034'].includes(error.code)
        )
          throw new ConflictException(
            'Concurrent material update; reload and retry.',
          );
        throw error;
      }
    }
  }
}
