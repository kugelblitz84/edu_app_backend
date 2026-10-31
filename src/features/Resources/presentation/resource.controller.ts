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
  ContextQuery,
  CreateMaterialInput,
  PinInput,
  PublicQuery,
  RotatePinInput,
  UpdateMaterialInput,
  UploadRequest,
  VersionInput,
} from './material.dto';
import {
  contextQuerySchema,
  createResourceSchema,
  publicQuerySchema,
  rotatePinSchema,
  unlockSchema,
  updateResourceSchema,
  uploadSchema,
  versionSchema,
} from './material.dto';
const Id = (name = 'id') => Param(name, new ParseUUIDPipe());

@UseInterceptors(MaterialCacheInterceptor)
@Controller({ path: 'resources', version: '1' })
export class ResourceController {
  constructor(private readonly service: MaterialService) {}

  // Create a draft with an explicit access policy.
  @Post()
  create(
    @CurrentUser() actor: AuthenticatedUser,
    @Body(new ZodValidationPipe(createResourceSchema))
    input: CreateMaterialInput,
  ) {
    return this.service.create('RESOURCE', actor.userId, input);
  }

  // List published public metadata with stable pagination.
  @OptionalAuth()
  @Get()
  list(@Query(new ZodValidationPipe(publicQuerySchema)) query: PublicQuery) {
    return this.service.catalog(query, { kind: 'RESOURCE' });
  }

  // Read safe metadata; managers may also inspect drafts and archives.
  @OptionalAuth()
  @Get(':id')
  detail(
    @Id() id: string,
    @CurrentUser() actor: AuthenticatedUser | undefined,
    @Query(new ZodValidationPipe(contextQuerySchema)) query: ContextQuery,
  ) {
    return this.service.detail(
      'RESOURCE',
      id,
      actor?.userId,
      query.collectionId,
    );
  }

  // Edit metadata or policy using the current version.
  @Patch(':id')
  update(
    @Id() id: string,
    @CurrentUser() actor: AuthenticatedUser,
    @Body(new ZodValidationPipe(updateResourceSchema))
    input: UpdateMaterialInput,
  ) {
    return this.service.update(
      'RESOURCE',
      id,
      actor.userId,
      input,
      actor.platformRole === 'GLOBAL_ADMIN',
    );
  }

  // Create a purpose-bound content or thumbnail upload intent.
  @Post(':id/uploads')
  upload(
    @Id() id: string,
    @CurrentUser() actor: AuthenticatedUser,
    @Body(new ZodValidationPipe(uploadSchema)) input: UploadRequest,
  ) {
    return this.service.upload(
      'RESOURCE',
      id,
      actor.userId,
      input.version,
      input.purpose,
      input.fileType,
      input.sizeBytes,
    );
  }

  // Inspect the stored upload and atomically activate the verified file.
  @Post(':id/uploads/:fileId/complete')
  complete(
    @Id() id: string,
    @Id('fileId') fileId: string,
    @CurrentUser() actor: AuthenticatedUser,
    @Body(new ZodValidationPipe(versionSchema)) input: VersionInput,
  ) {
    return this.service.complete(
      'RESOURCE',
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
      'RESOURCE',
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
      'RESOURCE',
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
      'RESOURCE',
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
      'RESOURCE',
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
      'RESOURCE',
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
      'RESOURCE',
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
      'RESOURCE',
      id,
      actor.userId,
      input.version,
      userId,
    );
  }

  // Return a short-lived thumbnail link in the exact metadata context.
  @OptionalAuth()
  @Get(':id/thumbnail')
  image(
    @Id() id: string,
    @CurrentUser() actor: AuthenticatedUser | undefined,
    @Query(new ZodValidationPipe(contextQuerySchema)) query: ContextQuery,
  ) {
    return this.service.image(
      'RESOURCE',
      id,
      actor?.userId,
      query.collectionId,
    );
  }

  // Authorize standalone content and issue a short-lived inline media link.
  @OptionalAuth()
  @Post(':id/access')
  access(
    @Id() id: string,
    @CurrentUser() actor: AuthenticatedUser | undefined,
  ) {
    return this.service.deliver(id, actor?.userId);
  }

  // Preview a ready file while currently authorized to manage the resource.
  @Post(':id/preview')
  preview(@Id() id: string, @CurrentUser() actor: AuthenticatedUser) {
    return this.service.deliver(id, actor.userId, { preview: true });
  }
}
