import { Module } from '@nestjs/common';
import { CloudinaryStorageProviderService } from './data/storage_provider_service.cloudinary.impl';
import {
  CLOUDINARY_CONFIG,
  loadCloudinaryConfig,
} from './domain/storage_provider.config';
import { StorageProvider } from './domain/contracts';

@Module({
  providers: [
    { provide: CLOUDINARY_CONFIG, useFactory: loadCloudinaryConfig },
    {
      provide: StorageProvider,
      useClass: CloudinaryStorageProviderService,
    },
  ],
  exports: [StorageProvider],
})
export class StorageProviderModule {}
