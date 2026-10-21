import { StorageModule } from '../../core/modules/storage/storage.module';
import { ProfilePictureUseCases } from './domain/profile-picture.usecases';
import { ProfilePictureRepository } from './domain/profile-picture.contracts';
import { PrismaProfilePictureRepository } from './data/profile-picture.repository';
import { Module } from '@nestjs/common';
import { PrismaModule } from '../../core/database/prisma.module';
import { PrismaUserProfileRepository } from './data/user-profile.repository';
import { UserProfileRepository } from './domain/user-profile.contracts';
import { UserProfileUseCases } from './domain/user-profile.usecases';
import {
  MeProfileController,
  PublicProfileController,
} from './presentation/profile.controller';

@Module({
  imports: [PrismaModule, StorageModule],
  providers: [
    UserProfileUseCases,
    ProfilePictureUseCases,
    {
      provide: ProfilePictureRepository,
      useClass: PrismaProfilePictureRepository,
    },
    { provide: UserProfileRepository, useClass: PrismaUserProfileRepository },
  ],
  controllers: [MeProfileController, PublicProfileController],
})
export class UserProfileModule {}
