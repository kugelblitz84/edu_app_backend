import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Query,
  UseInterceptors,
} from '@nestjs/common';
import type { AuthenticatedUser } from '../../../core/auth/auth.types';
import { CurrentUser } from '../../../core/auth/decorators/current-user.decorator';
import { OptionalAuth } from '../../../core/auth/decorators/optional-auth.decorator';
import { ZodValidationPipe } from '../../../core/validator/zod-validation.pipe';
import { MaterialService } from '../application/material.service';
import { MaterialCacheInterceptor } from './material-cache.interceptor';
import type { ManagementQuery, PublicQuery } from './material.dto';
import { managementQuerySchema, publicQuerySchema } from './material.dto';
const Id = (name = 'id') => Param(name, new ParseUUIDPipe());

@UseInterceptors(MaterialCacheInterceptor)
@Controller({ version: '1' })
export class MaterialLibraryController {
  constructor(private readonly service: MaterialService) {}

  // List the authenticated owner?s personal library, including drafts and private records.
  @Get('me/resources')
  resources(
    @CurrentUser() actor: AuthenticatedUser,
    @Query(new ZodValidationPipe(managementQuerySchema)) query: ManagementQuery,
  ) {
    return this.service.catalog(
      query,
      { kind: 'RESOURCE', ownerUserId: actor.userId, management: true },
      actor.userId,
    );
  }

  // List the authenticated owner?s personal library, including drafts and private records.
  @Get('me/resource-collections')
  collections(
    @CurrentUser() actor: AuthenticatedUser,
    @Query(new ZodValidationPipe(managementQuerySchema)) query: ManagementQuery,
  ) {
    return this.service.catalog(
      query,
      { kind: 'COLLECTION', ownerUserId: actor.userId, management: true },
      actor.userId,
    );
  }

  // List and count the combined published institution resource and collection feed.
  @OptionalAuth()
  @Get('institutions/:institutionId/resources')
  institution(
    @Id('institutionId') institutionId: string,
    @Query(new ZodValidationPipe(publicQuerySchema)) query: PublicQuery,
  ) {
    return this.service.catalog(query, { institutionId });
  }

  // List institution drafts and published materials for its current administrators.
  @Get('institutions/:institutionId/resources/manage')
  manageInstitution(
    @Id('institutionId') institutionId: string,
    @CurrentUser() actor: AuthenticatedUser,
    @Query(new ZodValidationPipe(managementQuerySchema)) query: ManagementQuery,
  ) {
    return this.service.catalog(
      query,
      { institutionId, management: true },
      actor.userId,
    );
  }
}
