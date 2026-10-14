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
  imports: [PrismaModule],
  providers: [
    UserProfileUseCases,
    { provide: UserProfileRepository, useClass: PrismaUserProfileRepository },
  ],
  controllers: [MeProfileController, PublicProfileController],
})
export class UserProfileModule {}
