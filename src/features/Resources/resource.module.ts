import { Module } from '@nestjs/common';
import { PrismaModule } from '../../core/database/prisma.module';
import { ScryptSecretHasher } from '../../core/security/scrypt-secret-hasher.service';
import { ScryptSecretVerifier } from '../../core/security/scrypt-secret-verifier.service';
import { StorageModule } from '../../core/modules/storage/storage.module';
import {
  MATERIAL_CONFIG,
  loadMaterialConfig,
} from './application/material.config';
import { MaterialService } from './application/material.service';
import { MaterialCleanupWorker } from './data/material-cleanup.worker';
import { PrismaMaterialRepository } from './data/material.repository';
import { MaterialRepository } from './domain/material.repository';
import { MaterialCacheInterceptor } from './presentation/material-cache.interceptor';
import { MaterialLibraryController } from './presentation/material-library.controller';
import { ResourceCollectionController } from './presentation/resource-collection.controller';
import { ResourceController } from './presentation/resource.controller';

@Module({
  imports: [PrismaModule, StorageModule],
  controllers: [
    ResourceController,
    ResourceCollectionController,
    MaterialLibraryController,
  ],
  providers: [
    MaterialService,
    MaterialCleanupWorker,
    MaterialCacheInterceptor,
    ScryptSecretHasher,
    ScryptSecretVerifier,
    { provide: MaterialRepository, useClass: PrismaMaterialRepository },
    { provide: MATERIAL_CONFIG, useFactory: loadMaterialConfig },
  ],
})
export class ResourceModule {}
