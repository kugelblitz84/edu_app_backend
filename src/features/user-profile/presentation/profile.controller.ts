import { Body, Controller, Get, Param, Patch } from '@nestjs/common';
import type { AuthenticatedUser } from '../../../core/auth/auth.types';
import { CurrentUser } from '../../../core/auth/decorators/current-user.decorator';
import { Public } from '../../../core/auth/decorators/public.decorator';
import { ZodValidationPipe } from '../../../core/validator/zod-validation.pipe';
import { UserProfileUseCases } from '../domain/user-profile.usecases';
import {
  profileUsernameSchema,
  updateProfileSchema,
  type OwnProfileResponseDto,
  type PublicProfileResponseDto,
  type UpdateProfileRequestDto,
} from './profile.dto';

@Controller({ path: 'me', version: '1' })
export class MeProfileController {
  constructor(private readonly useCases: UserProfileUseCases) {}

  @Get()
  getMe(
    @CurrentUser() currentUser: AuthenticatedUser,
  ): Promise<OwnProfileResponseDto> {
    return this.useCases.getOwnProfile(currentUser.userId);
  }

  @Patch('update')
  updateMe(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Body(new ZodValidationPipe(updateProfileSchema))
    update: UpdateProfileRequestDto,
  ): Promise<OwnProfileResponseDto> {
    return this.useCases.updateOwnProfile(currentUser.userId, update);
  }
}

@Controller({ path: 'profile', version: '1' })
export class PublicProfileController {
  constructor(private readonly useCases: UserProfileUseCases) {}

  @Public()
  @Get(':username')
  getProfile(
    @Param('username', new ZodValidationPipe(profileUsernameSchema))
    username: string,
  ): Promise<PublicProfileResponseDto> {
    return this.useCases.getPublicProfile(username);
  }
}
