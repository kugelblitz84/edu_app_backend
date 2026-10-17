import { Module } from '@nestjs/common';
import { CloudinaryStorageProviderService } from './data/cloudinary/cloudinary-storage-provider.service';
import {
  CLOUDINARY_CONFIG,
  loadCloudinaryConfig,
} from './config/cloudinary.config';
import { StorageProvider } from './domain/contracts';

@Module({
  providers: [
    { provide: CLOUDINARY_CONFIG, useFactory: loadCloudinaryConfig },
    { provide: StorageProvider, useClass: CloudinaryStorageProviderService },
  ],
  exports: [StorageProvider],
})
export class StorageModule {}
