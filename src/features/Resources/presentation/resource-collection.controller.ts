import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  Query,
  Req,
  UseInterceptors,
} from '@nestjs/common';
import type { Request } from 'express';
import type { AuthenticatedUser } from '../../../core/auth/auth.types';
import { CurrentUser } from '../../../core/auth/decorators/current-user.decorator';
import { OptionalAuth } from '../../../core/auth/decorators/optional-auth.decorator';
import { ZodValidationPipe } from '../../../core/validator/zod-validation.pipe';
import { MaterialService } from '../application/material.service';
import { MaterialCacheInterceptor } from './material-cache.interceptor';
import type {
  AddItemInput,
  CoverUploadRequest,
  CreateMaterialInput,
  ItemQuery,
  OrderInput,
  PinInput,
  PublicQuery,
  RotatePinInput,
  UpdateMaterialInput,
  VersionInput,
} from './material.dto';
import {
  addItemSchema,
  coverUploadSchema,
  createCollectionSchema,
  itemQuerySchema,
  orderSchema,
  publicQuerySchema,
  rotatePinSchema,
  unlockSchema,
  updateCollectionSchema,
  versionSchema,
} from './material.dto';
const Id = (name = 'id') => Param(name, new ParseUUIDPipe());

@UseInterceptors(MaterialCacheInterceptor)
@Controller({ path: 'resource-collections', version: '1' })
export class ResourceCollectionController {
  constructor(private readonly service: MaterialService) {}

  // Create a draft with an explicit access policy.
  @Post()
  create(
    @CurrentUser() actor: AuthenticatedUser,
    @Body(new ZodValidationPipe(createCollectionSchema))
    input: CreateMaterialInput,
  ) {
    return this.service.create('COLLECTION', actor.userId, input);
  }

  // List published public metadata with stable pagination.
  @OptionalAuth()
  @Get()
  list(@Query(new ZodValidationPipe(publicQuerySchema)) query: PublicQuery) {
    return this.service.catalog(query, { kind: 'COLLECTION' });
  }

  // Read safe metadata; managers may also inspect drafts and archives.
  @OptionalAuth()
  @Get(':id')
  detail(
    @Id() id: string,
    @CurrentUser() actor: AuthenticatedUser | undefined,
  ) {
    return this.service.detail('COLLECTION', id, actor?.userId);
  }

  // Edit metadata or policy using the current version.
  @Patch(':id')
  update(
    @Id() id: string,
    @CurrentUser() actor: AuthenticatedUser,
    @Body(new ZodValidationPipe(updateCollectionSchema))
    input: UpdateMaterialInput,
  ) {
    return this.service.update(
      'COLLECTION',
      id,
      actor.userId,
      input,
      actor.platformRole === 'GLOBAL_ADMIN',
    );
  }

  // Create a signed upload intent for an uploaded collection cover.
  @Post(':id/cover-uploads')
  upload(
    @Id() id: string,
    @CurrentUser() actor: AuthenticatedUser,
    @Body(new ZodValidationPipe(coverUploadSchema)) input: CoverUploadRequest,
  ) {
    return this.service.upload(
      'COLLECTION',
      id,
      actor.userId,
      input.version,
      'COLLECTION_COVER',
      input.fileType,
      input.sizeBytes,
    );
  }

  // Inspect the stored upload and atomically activate the verified file.
  @Post(':id/cover-uploads/:fileId/complete')
  complete(
    @Id() id: string,
    @Id('fileId') fileId: string,
    @CurrentUser() actor: AuthenticatedUser,
    @Body(new ZodValidationPipe(versionSchema)) input: VersionInput,
  ) {
    return this.service.complete(
      'COLLECTION',
      id,
      actor.userId,
      fileId,
      input.version,
    );
  }

  // Validate required files and policy invariants, then publish.
  @Post(':id/publish')
  publish(
    @Id() id: string,
    @CurrentUser() actor: AuthenticatedUser,
    @Body(new ZodValidationPipe(versionSchema)) input: VersionInput,
  ) {
    return this.service.transition(
      'COLLECTION',
      id,
      actor.userId,
      input.version,
      'publish',
    );
  }

  // Archive and stop new public delivery.
  @Post(':id/archive')
  archive(
    @Id() id: string,
    @CurrentUser() actor: AuthenticatedUser,
    @Body(new ZodValidationPipe(versionSchema)) input: VersionInput,
  ) {
    return this.service.transition(
      'COLLECTION',
      id,
      actor.userId,
      input.version,
      'archive',
    );
  }

  // Return archived content to draft for explicit republication.
  @Post(':id/unarchive')
  unarchive(
    @Id() id: string,
    @CurrentUser() actor: AuthenticatedUser,
    @Body(new ZodValidationPipe(versionSchema)) input: VersionInput,
  ) {
    return this.service.transition(
      'COLLECTION',
      id,
      actor.userId,
      input.version,
      'unarchive',
    );
  }

  // Soft-delete and schedule attachment cleanup.
  @Delete(':id')
  remove(
    @Id() id: string,
    @CurrentUser() actor: AuthenticatedUser,
    @Body(new ZodValidationPipe(versionSchema)) input: VersionInput,
  ) {
    return this.service.transition(
      'COLLECTION',
      id,
      actor.userId,
      input.version,
      'delete',
    );
  }

  // Verify a PIN and create a user-bound, target-specific unlock grant.
  @Post(':id/unlock')
  unlock(
    @Id() id: string,
    @CurrentUser() actor: AuthenticatedUser,
    @Body(new ZodValidationPipe(unlockSchema)) input: PinInput,
    @Req() request: Request,
  ) {
    return this.service.unlock(
      'COLLECTION',
      id,
      actor.userId,
      input.pin,
      request.ip ?? request.socket.remoteAddress ?? 'unknown',
    );
  }

  // Replace the PIN and invalidate all previous unlock versions.
  @Put(':id/unlock-pin')
  rotatePin(
    @Id() id: string,
    @CurrentUser() actor: AuthenticatedUser,
    @Body(new ZodValidationPipe(rotatePinSchema)) input: RotatePinInput,
  ) {
    return this.service.rotatePin(
      'COLLECTION',
      id,
      actor.userId,
      input.version,
      input.pin,
    );
  }

  // Revoke one user?s PIN grant without deleting their account.
  @Delete(':id/unlocks/:userId')
  revoke(
    @Id() id: string,
    @Id('userId') userId: string,
    @CurrentUser() actor: AuthenticatedUser,
    @Body(new ZodValidationPipe(versionSchema)) input: VersionInput,
  ) {
    return this.service.revoke(
      'COLLECTION',
      id,
      actor.userId,
      input.version,
      userId,
    );
  }

  // Return a short-lived cover link when metadata is visible.
  @OptionalAuth()
  @Get(':id/cover')
  image(@Id() id: string, @CurrentUser() actor: AuthenticatedUser | undefined) {
    return this.service.image('COLLECTION', id, actor?.userId);
  }

  // List ordered safe item metadata; managers can inspect unfinished items.
  @OptionalAuth()
  @Get(':id/items')
  items(
    @Id() id: string,
    @CurrentUser() actor: AuthenticatedUser | undefined,
    @Query(new ZodValidationPipe(itemQuerySchema)) query: ItemQuery,
  ) {
    return this.service.items(id, actor?.userId, { ...query, sort: 'newest' });
  }

  // Add an existing eligible upload without copying its file.
  @Post(':id/items')
  addItem(
    @Id() id: string,
    @CurrentUser() actor: AuthenticatedUser,
    @Body(new ZodValidationPipe(addItemSchema)) input: AddItemInput,
  ) {
    return this.service.changeItems(id, actor.userId, input.version, {
      add: input.resourceId,
      position: input.position,
    });
  }

  // Remove membership while retaining the child resource and file.
  @Delete(':id/items/:resourceId')
  removeItem(
    @Id() id: string,
    @Id('resourceId') resourceId: string,
    @CurrentUser() actor: AuthenticatedUser,
    @Body(new ZodValidationPipe(versionSchema)) input: VersionInput,
  ) {
    return this.service.changeItems(id, actor.userId, input.version, {
      remove: resourceId,
    });
  }

  // Atomically reorder exactly the current resource IDs.
  @Put(':id/items/order')
  order(
    @Id() id: string,
    @CurrentUser() actor: AuthenticatedUser,
    @Body(new ZodValidationPipe(orderSchema)) input: OrderInput,
  ) {
    return this.service.changeItems(id, actor.userId, input.version, {
      order: input.resourceIds,
    });
  }

  // Authorize this collection and current membership before issuing item media.
  @OptionalAuth()
  @Post(':id/items/:resourceId/access')
  access(
    @Id() id: string,
    @Id('resourceId') resourceId: string,
    @CurrentUser() actor: AuthenticatedUser | undefined,
  ) {
    return this.service.deliver(resourceId, actor?.userId, {
      collectionId: id,
    });
  }

  // Read a child?s safe metadata through this visible collection.
  @OptionalAuth()
  @Get(':id/items/:resourceId')
  itemDetail(
    @Id() id: string,
    @Id('resourceId') resourceId: string,
    @CurrentUser() actor: AuthenticatedUser | undefined,
  ) {
    return this.service.detail('RESOURCE', resourceId, actor?.userId, id);
  }
}
