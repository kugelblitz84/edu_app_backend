import { ProfilePictureUseCases } from './profile-picture.usecases';
import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  UsernameConflictError,
  UserProfileRepository,
  type OwnUserProfile,
  type PublicUserProfile,
  type UpdateUserProfile,
} from './user-profile.contracts';

@Injectable()
export class UserProfileUseCases {
  constructor(
    private readonly repository: UserProfileRepository,
    private readonly pictures: ProfilePictureUseCases,
  ) {}

  async getOwnProfile(userId: string): Promise<OwnUserProfile> {
    const profile = await this.repository.findById(userId);
    if (!profile) throw new NotFoundException('User profile not found.');
    return {
      ...profile,
      avatarUrl: await this.pictures.resolveAvatarUrl(
        { userId },
        profile.avatarUrl,
      ),
    };
  }

  async getPublicProfile(username: string): Promise<PublicUserProfile> {
    const profile = await this.repository.findByUsername(username);
    if (!profile) throw new NotFoundException('User profile not found.');
    return {
      ...profile,
      avatarUrl: await this.pictures.resolveAvatarUrl(
        { username },
        profile.avatarUrl,
      ),
    };
  }

  async updateOwnProfile(
    userId: string,
    update: UpdateUserProfile,
  ): Promise<OwnUserProfile> {
    try {
      const profile = await this.repository.update(userId, update);
      if (!profile) throw new NotFoundException('User profile not found.');
      return {
        ...profile,
        avatarUrl: await this.pictures.resolveAvatarUrl(
          { userId },
          profile.avatarUrl,
        ),
      };
    } catch (error) {
      if (error instanceof UsernameConflictError) {
        throw new ConflictException(error.message);
      }
      throw error;
    }
  }
}
