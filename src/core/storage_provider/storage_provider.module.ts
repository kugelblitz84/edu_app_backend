import { Module } from '@nestjs/common';
import { CloudinaryStorageProviderService } from './data/storage_provider_service.cloudinary.impl';
import {
  CLOUDINARY_CONFIG,
  loadCloudinaryConfig,
} from './domain/storage_provider.config';
import { StorageProviderService } from './domain/contracts';

@Module({
  providers: [
    { provide: CLOUDINARY_CONFIG, useFactory: loadCloudinaryConfig },
    {
      provide: StorageProviderService,
      useClass: CloudinaryStorageProviderService,
    },
  ],
  exports: [StorageProviderService],
})
export class StorageProviderModule {}
