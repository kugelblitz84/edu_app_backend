import { Body, Controller, Param, ParseUUIDPipe, Patch } from '@nestjs/common';
import type { AuthenticatedUser } from '../../../core/auth/auth.types';
import { CurrentUser } from '../../../core/auth/decorators/current-user.decorator';
import { Roles } from '../../../core/auth/decorators/roles.decorator';
import { ZodValidationPipe } from '../../../core/validator/zod-validation.pipe';
import { MaterialService } from '../../Resources/application/material.service';
import type { FeaturedStatusInput } from '../../Resources/presentation/material.dto';
import { featuredStatusSchema } from '../../Resources/presentation/material.dto';

@Controller({ path: 'global-admin', version: '1' })
@Roles('GLOBAL_ADMIN')
export class GlobalAdminMaterialController {
  constructor(private readonly materials: MaterialService) {}

  @Patch('resources/:id/featured')
  updateResourceFeaturedStatus(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body(new ZodValidationPipe(featuredStatusSchema))
    input: FeaturedStatusInput,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.materials.update('RESOURCE', id, actor.userId, input, true);
  }

  @Patch('resource-collections/:id/featured')
  updateCollectionFeaturedStatus(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body(new ZodValidationPipe(featuredStatusSchema))
    input: FeaturedStatusInput,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.materials.update('COLLECTION', id, actor.userId, input, true);
  }
}
