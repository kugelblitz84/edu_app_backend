import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  HttpException,
  Inject,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { RateLimitService } from '../../../core/auth/services/rate-limit.service';
import { ScryptSecretHasher } from '../../../core/security/scrypt-secret-hasher.service';
import { ScryptSecretVerifier } from '../../../core/security/scrypt-secret-verifier.service';
import { StorageProvider } from '../../../core/modules/storage/domain/contracts';
import { StorageError } from '../../../core/modules/storage/domain/storage.errors';
import type {
  StorageObject,
  StorageFileType,
} from '../../../core/modules/storage/domain/storage.types';
import { toUploadUrlResponseDto } from '../../../core/modules/storage/presentation/storage.dto';
import {
  access,
  compatible,
  manages,
  validScope,
  visible,
} from '../domain/material.policy';
import {
  MaterialRepository,
  type CatalogScope,
  type MaterialStore,
} from '../domain/material.repository';
import type {
  AccessDecision,
  CatalogQuery,
  Kind,
  Material,
  MaterialFile,
  Purpose,
} from '../domain/material.types';
import type {
  CreateMaterialInput,
  UpdateMaterialInput,
} from '../presentation/material.dto';
import { metadata } from '../presentation/material.response';
import { MATERIAL_CONFIG, type MaterialConfig } from './material.config';

@Injectable()
export class MaterialService {
  constructor(
    private readonly repository: MaterialRepository,
    private readonly storage: StorageProvider,
    private readonly hasher: ScryptSecretHasher,
    private readonly verifier: ScryptSecretVerifier,
    private readonly rateLimits: RateLimitService,
    @Inject(MATERIAL_CONFIG) private readonly config: MaterialConfig,
  ) {}

  private async require(store: MaterialStore, kind: Kind, id: string) {
    const item = await store.find(kind, id);
    if (!item) throw new NotFoundException('Material not found.');
    return item;
  }
  private async manager(
    store: MaterialStore,
    kind: Kind,
    id: string,
    actor: string,
    allowDeleted = false,
  ) {
    const item = await this.require(store, kind, id);
    if (
      (!allowDeleted && item.status === 'DELETED') ||
      !manages(item, await store.facts(item, actor))
    )
      throw new NotFoundException('Managed material not found.');
    return item;
  }
  private version(item: Material, expected: number) {
    if (item.version !== expected)
      throw new ConflictException({
        message: 'Stale version; reload and retry.',
        currentVersion: item.version,
      });
  }
  private async bump(store: MaterialStore, item: Material) {
    item.version++;
    item.updatedAt = new Date();
    await store.save(item);
    return metadata(item);
  }
  private policy(item: Material) {
    if (!validScope(item.accessPolicy, item.institutionId))
      throw new BadRequestException(
        'Policy and institution scope are incompatible.',
      );
    if (item.accessPolicy === 'PURCHASE') {
      if (!item.pinHash)
        throw new BadRequestException('PURCHASE requires a PIN.');
      if (item.priceAmountMinor !== null && item.priceAmountMinor < 1)
        throw new BadRequestException('Display price must be positive.');
      item.currency =
        item.priceAmountMinor !== null ? (item.currency ?? 'BDT') : null;
    } else {
      if (
        item.priceAmountMinor !== null ||
        item.currency !== null ||
        item.pinHash !== null
      )
        throw new BadRequestException(
          'PIN and price are only supported for PURCHASE.',
        );
    }
  }
  private async compatibility(store: MaterialStore, item: Material) {
    const conflicts: string[] = [];
    if (item.kind === 'RESOURCE') {
      for (const parent of await store.collections(item.id))
        if (!compatible(parent, item)) conflicts.push(parent.id);
    } else {
      for (const member of await store.members(item.id)) {
        const resource = await this.require(
          store,
          'RESOURCE',
          member.resourceId,
        );
        if (!compatible(item, resource)) conflicts.push(resource.id);
      }
    }
    if (conflicts.length)
      throw new ConflictException({
        message:
          'Incompatible memberships; remove them before changing policy.',
        conflictingIds: conflicts,
      });
  }
  async create(kind: Kind, actor: string, input: CreateMaterialInput) {
    if (kind === 'RESOURCE' && !['PDF', 'VIDEO'].includes(input.type ?? ''))
      throw new BadRequestException(
        'Only PDF and VIDEO uploads are supported.',
      );
    const pinHash = input.pin ? await this.hasher.hash(input.pin) : null;
    const now = new Date();
    const item: Material = {
      id: randomUUID(),
      kind,
      title: input.title,
      description: input.description ?? null,
      ownerUserId: actor,
      institutionId: input.institutionId ?? null,
      accessPolicy: input.accessPolicy,
      status: 'DRAFT',
      priceAmountMinor: input.priceAmountMinor ?? null,
      currency: input.currency ?? null,
      pinHash,
      unlockVersion: 1,
      version: 1,
      metadata: input.metadata ?? null,
      createdAt: now,
      updatedAt: now,
      publishedAt: null,
      archivedAt: null,
      deletedAt: null,
      ...(kind === 'RESOURCE'
        ? {
            type: input.type!,
            isStandalone: input.isStandalone ?? !input.collectionId,
          }
        : {}),
    };
    this.policy(item);
    return this.repository.transaction(async (store) => {
      if (item.institutionId && !(await store.admin(item.institutionId, actor)))
        throw new ForbiddenException(
          'Current administrator of an ACTIVE institution required.',
        );
      if (input.collectionId) {
        const parent = await this.manager(
          store,
          'COLLECTION',
          input.collectionId,
          actor,
        );
        this.version(parent, input.collectionVersion!);
        if (!compatible(parent, item))
          throw new ConflictException(
            'Collection and resource scope/policy must be compatible.',
          );
        if (parent.status === 'PUBLISHED')
          throw new ConflictException(
            'Create drafts in a draft collection; add to a published collection after resource publication.',
          );
        const members = await store.members(parent.id);
        if (members.length >= this.config.maxItems)
          throw new ConflictException('Collection length limit reached.');
        await store.insert(item, actor);
        members.push({
          collectionId: parent.id,
          resourceId: item.id,
          position: members.length,
          addedByUserId: actor,
          addedAt: now,
        });
        await store.replaceMembers(parent.id, members);
        await this.bump(store, parent);
      } else await store.insert(item, actor);
      return metadata(item);
    });
  }
  async update(
    kind: Kind,
    id: string,
    actor: string,
    input: UpdateMaterialInput,
  ) {
    const pinHash = input.pin ? await this.hasher.hash(input.pin) : undefined;
    return this.repository.transaction(async (store) => {
      const item = await this.manager(store, kind, id, actor);
      this.version(item, input.version);
      const previousPolicy = item.accessPolicy;
      if (input.title !== undefined) item.title = input.title;
      if (input.description !== undefined) item.description = input.description;
      if (input.metadata !== undefined) item.metadata = input.metadata;
      if (input.isStandalone !== undefined)
        item.isStandalone = input.isStandalone;
      if (input.accessPolicy !== undefined)
        item.accessPolicy = input.accessPolicy;
      if (input.priceAmountMinor !== undefined)
        item.priceAmountMinor = input.priceAmountMinor;
      if (input.currency !== undefined) item.currency = input.currency;
      if (pinHash !== undefined) item.pinHash = pinHash;
      if (previousPolicy !== item.accessPolicy) {
        if (item.accessPolicy === 'PURCHASE' && !pinHash)
          throw new BadRequestException(
            'Switching to PURCHASE requires a new PIN.',
          );
        if (item.accessPolicy !== 'PURCHASE') {
          if (
            input.pin ||
            input.priceAmountMinor != null ||
            input.currency != null
          )
            throw new BadRequestException(
              'New policy does not support a PIN or price.',
            );
          item.pinHash = null;
          item.priceAmountMinor = null;
          item.currency = null;
        }
        item.unlockVersion++;
      } else if (
        pinHash !== undefined ||
        (input.isStandalone !== undefined &&
          input.isStandalone !==
            (await this.require(store, kind, id)).isStandalone)
      )
        item.unlockVersion++;
      this.policy(item);
      await this.compatibility(store, item);
      return this.bump(store, item);
    });
  }
  private async ready(store: MaterialStore, item: Material) {
    if (item.kind !== 'RESOURCE') return;
    if (item.type === 'ARTICLE')
      throw new ConflictException('ARTICLE publication is not supported.');
    const files = await store.files(item);
    if (!files.some((file) => this.active(file, 'RESOURCE_CONTENT')))
      throw new ConflictException('A verified content upload is required.');
    if (
      item.type === 'VIDEO' &&
      !files.some((file) => this.active(file, 'RESOURCE_THUMBNAIL'))
    )
      throw new ConflictException(
        'Videos require a verified uploaded thumbnail.',
      );
  }
  private active(file: MaterialFile, purpose: Purpose) {
    return (
      file.purpose === purpose &&
      file.attached &&
      file.state === 'READY' &&
      file.cleanupState === 'NONE' &&
      !!file.verifiedReference
    );
  }
  async transition(
    kind: Kind,
    id: string,
    actor: string,
    expected: number,
    action: 'publish' | 'archive' | 'unarchive' | 'delete',
  ) {
    return this.repository.transaction(async (store) => {
      const item = await this.manager(
        store,
        kind,
        id,
        actor,
        action === 'delete',
      );
      if (action === 'delete' && item.status === 'DELETED')
        return metadata(item);
      this.version(item, expected);
      const target = {
        publish: 'PUBLISHED',
        archive: 'ARCHIVED',
        unarchive: 'DRAFT',
        delete: 'DELETED',
      } as const;
      const from = {
        publish: 'DRAFT',
        archive: 'PUBLISHED',
        unarchive: 'ARCHIVED',
      } as const;
      if (action !== 'delete' && item.status !== from[action])
        throw new ConflictException(
          `Cannot ${action} a ${item.status} material.`,
        );
      if (action === 'publish') {
        await this.compatibility(store, item);
        await this.ready(store, item);
        if (kind === 'COLLECTION') {
          const members = await store.members(id);
          if (!members.length)
            throw new ConflictException(
              'A collection needs at least one item.',
            );
          for (const member of members) {
            const child = await this.require(
              store,
              'RESOURCE',
              member.resourceId,
            );
            if (child.status !== 'PUBLISHED')
              throw new ConflictException({
                message: 'All collection items must be published.',
                resourceId: child.id,
              });
            await this.ready(store, child);
          }
        }
        item.publishedAt = new Date();
      }
      item.status = target[action];
      item.unlockVersion++;
      if (action === 'archive') item.archivedAt = new Date();
      if (action === 'unarchive') {
        item.archivedAt = null;
        item.publishedAt = null;
      }
      if (action === 'delete') {
        item.deletedAt = new Date();
        for (const file of await store.files(item))
          await this.queue(store, file);
      }
      return this.bump(store, item);
    });
  }
  async items(id: string, actor: string | undefined, query: CatalogQuery) {
    return this.repository.transaction(async (store) => {
      const parent = await this.require(store, 'COLLECTION', id);
      const facts = await store.facts(parent, actor);
      if (!visible(parent, facts))
        throw new NotFoundException('Collection not found.');
      const result = await store.memberPage(id, query, manages(parent, facts));
      return this.page(
        {
          total: result.total,
          list: result.list.map((row) => ({
            ...metadata(row.item),
            position: row.position,
          })),
        },
        query,
      );
    });
  }
  async changeItems(
    id: string,
    actor: string,
    expected: number,
    change:
      | { add: string; position?: number }
      | { remove: string }
      | { order: string[] },
  ) {
    return this.repository.transaction(async (store) => {
      const parent = await this.manager(store, 'COLLECTION', id, actor);
      this.version(parent, expected);
      let members = await store.members(id);
      if ('add' in change) {
        const child = await this.manager(store, 'RESOURCE', change.add, actor);
        if (
          (await store.collections(child.id)).length >=
          this.config.maxCollections
        )
          throw new ConflictException(
            'Resource collection membership limit reached.',
          );
        if (!compatible(parent, child))
          throw new ConflictException(
            'Resource policy/ownership/scope is incompatible.',
          );
        if (members.some((member) => member.resourceId === child.id))
          throw new ConflictException(
            'Resource is already in this collection.',
          );
        if (members.length >= this.config.maxItems)
          throw new ConflictException('Collection length limit reached.');
        if (parent.status === 'PUBLISHED') {
          if (child.status !== 'PUBLISHED')
            throw new ConflictException(
              'Published collections require published items.',
            );
          await this.ready(store, child);
        }
        const position = change.position ?? members.length;
        if (position > members.length)
          throw new BadRequestException(
            'Position is outside collection bounds.',
          );
        members.splice(position, 0, {
          collectionId: id,
          resourceId: child.id,
          position,
          addedByUserId: actor,
          addedAt: new Date(),
        });
      } else if ('remove' in change) {
        if (!members.some((member) => member.resourceId === change.remove))
          throw new NotFoundException('Collection item not found.');
        members = members.filter(
          (member) => member.resourceId !== change.remove,
        );
      } else {
        const ids = new Set(change.order);
        if (
          ids.size !== members.length ||
          change.order.length !== members.length ||
          members.some((member) => !ids.has(member.resourceId))
        )
          throw new ConflictException(
            'Reorder must contain each current resource ID exactly once.',
          );
        const byId = new Map(
          members.map((member) => [member.resourceId, member]),
        );
        members = change.order.map((resourceId) => byId.get(resourceId)!);
      }
      await store.replaceMembers(
        id,
        members.map((member, position) => ({ ...member, position })),
      );
      return this.bump(store, parent);
    });
  }
  private page<T>(result: { list: T[]; total: number }, query: CatalogQuery) {
    return {
      ...result,
      page: query.page,
      limit: query.limit,
      totalPages: Math.ceil(result.total / query.limit),
    };
  }
  async catalog(query: CatalogQuery, scope: CatalogScope, actor?: string) {
    return this.repository.transaction(async (store) => {
      if (
        scope.management &&
        scope.institutionId &&
        (!actor || !(await store.admin(scope.institutionId, actor)))
      )
        throw new ForbiddenException(
          'Current institution administrator required.',
        );
      const result = await store.catalog(query, scope);
      return this.page(
        { total: result.total, list: result.list.map(metadata) },
        query,
      );
    });
  }
  private async view(
    store: MaterialStore,
    kind: Kind,
    id: string,
    actor?: string,
    collectionId?: string,
  ) {
    const item = await this.require(store, kind, id);
    const facts = await store.facts(item, actor);
    if (collectionId) {
      const parent = await this.require(store, 'COLLECTION', collectionId);
      if (
        !visible(parent, await store.facts(parent, actor)) ||
        !(await store.members(parent.id)).some(
          (member) => member.resourceId === item.id,
        ) ||
        !compatible(parent, item)
      )
        throw new NotFoundException('Collection item not found.');
    }
    if (!visible(item, facts, !!collectionId))
      throw new NotFoundException('Material not found.');
    return { item, facts };
  }
  async detail(kind: Kind, id: string, actor?: string, collectionId?: string) {
    return this.repository.transaction(async (store) => {
      const { item, facts } = await this.view(
        store,
        kind,
        id,
        actor,
        collectionId,
      );
      let decision: AccessDecision = access(item, facts);
      if (collectionId) {
        const parent = await this.require(store, 'COLLECTION', collectionId);
        decision = access(parent, await store.facts(parent, actor));
        if (item.status !== 'PUBLISHED')
          decision = { canAccess: false, reason: 'UNAVAILABLE' };
      } else if (item.kind === 'RESOURCE' && !item.isStandalone) {
        decision = { canAccess: false, reason: 'UNAVAILABLE' };
      }
      if (
        item.kind === 'RESOURCE' &&
        !(await store.files(item)).some((file) =>
          this.active(file, 'RESOURCE_CONTENT'),
        )
      )
        decision = { canAccess: false, reason: 'UNAVAILABLE' };
      return { ...metadata(item), access: decision };
    });
  }
  private deny(decision: AccessDecision) {
    if (!decision.canAccess) {
      if (decision.reason === 'AUTH_REQUIRED')
        throw new UnauthorizedException('Authentication required.');
      throw new ForbiddenException(decision.reason);
    }
    return decision.source;
  }
  async deliver(
    id: string,
    actor?: string,
    options: { preview?: boolean; collectionId?: string } = {},
  ) {
    const authorized = await this.repository.transaction(async (store) => {
      const item = await this.require(store, 'RESOURCE', id);
      const facts = await store.facts(item, actor);
      let decision: AccessDecision;
      if (options.collectionId) {
        const parent = await this.require(
          store,
          'COLLECTION',
          options.collectionId,
        );
        const parentFacts = await store.facts(parent, actor);
        if (
          !visible(parent, parentFacts) ||
          !(await store.members(parent.id)).some(
            (member) => member.resourceId === id,
          ) ||
          !compatible(parent, item)
        )
          throw new NotFoundException('Collection item not found.');
        // A requested collection is the sole entitlement context; child grants never substitute.
        decision = access(parent, parentFacts);
        this.deny(decision);
        if (item.status !== 'PUBLISHED' || !visible(item, facts, true))
          throw new NotFoundException('Published collection item not found.');
      } else if (options.preview) {
        if (item.status === 'DELETED' || !manages(item, facts))
          throw new NotFoundException('Managed material not found.');
        decision = {
          canAccess: true,
          source: item.institutionId ? 'INSTITUTION_ADMIN' : 'OWNER',
        };
      } else {
        if (!visible(item, facts) || !item.isStandalone)
          throw new NotFoundException('Standalone material not found.');
        decision = access(item, facts);
      }
      if (item.institutionId && !facts.institutionActive)
        throw new ForbiddenException('UNAVAILABLE');
      const source = this.deny(decision);
      const file = (await store.files(item)).find((file) =>
        this.active(file, 'RESOURCE_CONTENT'),
      );
      if (!file) throw new ConflictException('Content is not ready.');
      return { item, file, source };
    });
    return this.storageCall(async () => ({
      resourceId: id,
      fileId: authorized.file.id,
      type: authorized.item.type,
      mimeType: authorized.file.fileType,
      ...(await this.storage.createReadAccessUrl(
        authorized.file.verifiedReference!,
      )),
      accessSource: authorized.source,
    }));
  }
  async image(kind: Kind, id: string, actor?: string, collectionId?: string) {
    const file = await this.repository.transaction(async (store) => {
      const { item } = await this.view(store, kind, id, actor, collectionId);
      const purpose =
        kind === 'RESOURCE' ? 'RESOURCE_THUMBNAIL' : 'COLLECTION_COVER';
      const file = (await store.files(item)).find((file) =>
        this.active(file, purpose),
      );
      if (!file) throw new NotFoundException('Image not found.');
      return file;
    });
    return this.storageCall(async () => ({
      fileId: file.id,
      mimeType: file.fileType,
      ...(await this.storage.createReadAccessUrl(file.verifiedReference!)),
    }));
  }
  async unlock(kind: Kind, id: string, actor: string, pin: string, ip: string) {
    await this.rateLimits.enforce(
      'material-pin-target',
      `${kind}:${id}:${actor}`,
      this.config.pinTargetAttempts,
      900000,
    );
    await this.rateLimits.enforce(
      'material-pin-ip',
      ip,
      this.config.pinIpAttempts,
      900000,
    );
    const snapshot = await this.repository.transaction(async (store) => {
      const { item } = await this.view(store, kind, id, actor);
      if (
        item.status !== 'PUBLISHED' ||
        item.accessPolicy !== 'PURCHASE' ||
        !item.pinHash
      )
        throw new ForbiddenException('PIN unlock unavailable.');
      return item;
    });
    if (!(await this.verifier.verify(pin, snapshot.pinHash!)))
      throw new ForbiddenException('Invalid PIN.');
    return this.repository.transaction(async (store) => {
      const { item } = await this.view(store, kind, id, actor);
      if (
        item.version !== snapshot.version ||
        item.pinHash !== snapshot.pinHash ||
        item.unlockVersion !== snapshot.unlockVersion ||
        item.status !== 'PUBLISHED' ||
        item.accessPolicy !== 'PURCHASE'
      )
        throw new ConflictException('Access changed; retry unlock.');
      await store.grant(item, actor, {
        userId: actor,
        unlockVersion: item.unlockVersion,
        expiresAt: null,
        revokedAt: null,
      });
      return { unlocked: true, expiresAt: null };
    });
  }
  async rotatePin(
    kind: Kind,
    id: string,
    actor: string,
    expected: number,
    pin: string,
  ) {
    const hash = await this.hasher.hash(pin);
    return this.repository.transaction(async (store) => {
      const item = await this.manager(store, kind, id, actor);
      this.version(item, expected);
      if (
        item.institutionId ||
        item.ownerUserId !== actor ||
        item.accessPolicy !== 'PURCHASE'
      )
        throw new ForbiddenException('Personal PURCHASE owner required.');
      item.pinHash = hash;
      item.unlockVersion++;
      return this.bump(store, item);
    });
  }
  async revoke(
    kind: Kind,
    id: string,
    actor: string,
    expected: number,
    userId: string,
  ) {
    return this.repository.transaction(async (store) => {
      const item = await this.manager(store, kind, id, actor);
      this.version(item, expected);
      if (
        item.institutionId ||
        item.ownerUserId !== actor ||
        item.accessPolicy !== 'PURCHASE'
      )
        throw new ForbiddenException('Personal PURCHASE owner required.');
      await store.revoke(item, userId);
      return this.bump(store, item);
    });
  }
  private limit(
    item: Material,
    purpose: Purpose,
    fileType: StorageFileType,
    sizeBytes: number,
  ) {
    const contentType =
      item.type === 'PDF'
        ? 'application/pdf'
        : item.type === 'VIDEO'
          ? 'video/mp4'
          : undefined;
    const content = purpose === 'RESOURCE_CONTENT';
    if (
      content
        ? fileType !== contentType
        : !['image/jpeg', 'image/png', 'image/webp'].includes(fileType)
    )
      throw new BadRequestException(
        'Attachment MIME type does not match purpose.',
      );
    if ((item.kind === 'COLLECTION') !== (purpose === 'COLLECTION_COVER'))
      throw new BadRequestException(
        'Attachment purpose does not match target.',
      );
    const max = content
      ? item.type === 'PDF'
        ? this.config.pdf
        : this.config.video
      : this.config.image;
    if (!Number.isSafeInteger(sizeBytes) || sizeBytes < 1 || sizeBytes > max)
      throw new BadRequestException(
        `Attachment exceeds the ${max} byte purpose limit.`,
      );
  }
  async upload(
    kind: Kind,
    id: string,
    actor: string,
    expected: number,
    purpose: Purpose,
    fileType: StorageFileType,
    sizeBytes: number,
  ) {
    await this.rateLimits.enforce(
      'material-upload',
      actor,
      this.config.uploadsPerHour,
      3600000,
    );
    await this.repository.transaction(async (store) => {
      const item = await this.manager(store, kind, id, actor);
      this.version(item, expected);
      this.limit(item, purpose, fileType, sizeBytes);
      if ((await store.pendingCount(actor)) >= this.config.maxPending)
        throw new ConflictException('Pending upload limit reached.');
    });
    const descriptor = await this.storageCall(() =>
      this.storage.createUploadUrl({ fileType, sizeBytes }),
    );
    const file: MaterialFile = {
      id: descriptor.fileId,
      resourceId: kind === 'RESOURCE' ? id : null,
      collectionId: kind === 'COLLECTION' ? id : null,
      uploaderUserId: actor,
      purpose,
      fileType,
      sizeBytes,
      reference: descriptor.reference,
      verifiedReference: null,
      verifiedSizeBytes: null,
      expiresAt: new Date(descriptor.expiresAt * 1000),
      state: 'PENDING',
      attached: false,
      completedAt: null,
      cleanupState: 'NONE',
    };
    try {
      await this.repository.transaction(async (store) => {
        const item = await this.manager(store, kind, id, actor);
        this.version(item, expected);
        if ((await store.pendingCount(actor)) >= this.config.maxPending)
          throw new ConflictException('Pending upload limit reached.');
        await store.saveFile(file);
      });
    } catch (error) {
      // Descriptor has not escaped to the client; persist compensation when DB is available.
      await this.repository
        .transaction(async (store) => {
          await store.saveFile(file);
          await this.queue(store, file);
        })
        .catch(() => undefined);
      throw error;
    }
    return toUploadUrlResponseDto(descriptor);
  }
  private scoped(
    file: MaterialFile | null,
    kind: Kind,
    id: string,
    actor: string,
  ): asserts file is MaterialFile {
    if (
      !file ||
      file.uploaderUserId !== actor ||
      (kind === 'RESOURCE'
        ? file.resourceId !== id || file.collectionId !== null
        : file.collectionId !== id || file.resourceId !== null)
    )
      throw new NotFoundException(
        'Upload not found for this actor and target.',
      );
  }
  private completed(file: MaterialFile) {
    if (file.state === 'READY') {
      if (file.attached && file.cleanupState === 'NONE') return true;
      throw new ConflictException('Upload has been replaced or detached.');
    }
    if (
      file.state !== 'PENDING' ||
      file.cleanupState !== 'NONE' ||
      file.expiresAt <= new Date()
    )
      throw new ConflictException('Upload is expired or unavailable.');
    return false;
  }
  async complete(
    kind: Kind,
    id: string,
    actor: string,
    fileId: string,
    expected: number,
  ) {
    const pending = await this.repository.transaction(async (store) => {
      const item = await this.manager(store, kind, id, actor);
      const file = await store.file(fileId);
      this.scoped(file, kind, id, actor);
      if (this.completed(file)) return { file, done: true };
      this.version(item, expected);
      return { file, done: false };
    });
    if (pending.done) return { fileId, completed: true };
    let verified: StorageObject;
    try {
      verified = await this.storage.inspect(pending.file.reference);
      if (verified.sizeBytes !== pending.file.sizeBytes)
        throw new BadRequestException(
          'Verified size differs from declared size.',
        );
    } catch (error) {
      if (
        error instanceof BadRequestException ||
        (error instanceof StorageError &&
          ['INVALID_INPUT', 'INVALID_OBJECT'].includes(error.code))
      ) {
        await this.repository.transaction(async (store) => {
          const file = await store.file(fileId);
          if (file && file.state === 'PENDING' && !file.attached)
            await this.queue(store, file);
        });
      }
      this.translate(error);
    }
    return this.repository.transaction(async (store) => {
      const item = await this.manager(store, kind, id, actor);
      const file = await store.file(fileId);
      this.scoped(file, kind, id, actor);
      if (this.completed(file)) return { fileId, completed: true };
      this.version(item, expected);
      this.limit(
        item,
        file.purpose,
        file.fileType as StorageFileType,
        verified.sizeBytes,
      );
      for (const previous of await store.files(item))
        if (previous.attached && previous.purpose === file.purpose)
          await this.queue(store, previous);
      file.verifiedReference = verified.reference;
      file.verifiedSizeBytes = verified.sizeBytes;
      file.state = 'READY';
      file.completedAt = new Date();
      file.attached = true;
      await store.saveFile(file);
      const result = await this.bump(store, item);
      return { fileId, completed: true, version: result.version };
    });
  }
  private async queue(store: MaterialStore, file: MaterialFile) {
    file.attached = false;
    file.cleanupState = 'QUEUED';
    if (file.state === 'PENDING') file.state = 'REJECTED';
    await store.saveFile(file);
    await store.enqueue(
      file,
      new Date(
        Math.max(
          Date.now(),
          file.expiresAt.getTime() + this.config.cleanupGraceMs,
        ),
      ),
    );
  }
  private translate(error: unknown): never {
    if (!(error instanceof StorageError)) throw error;
    if (error.code === 'NOT_FOUND')
      throw new NotFoundException(
        'Uploaded file not found; finish the direct upload first.',
      );
    if (['INVALID_INPUT', 'INVALID_OBJECT'].includes(error.code))
      throw new BadRequestException('Invalid storage upload.');
    if (error.code === 'RATE_LIMITED')
      throw new HttpException('Storage rate limit; retry later.', 429);
    throw new ServiceUnavailableException('Material storage unavailable.');
  }
  private async storageCall<T>(work: () => Promise<T>): Promise<T> {
    try {
      return await work();
    } catch (error) {
      this.translate(error);
    }
  }
}
