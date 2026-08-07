import {Module} from '@nestjs/common';
import {PrismaModule} from '../../../core/database/prisma.module';
import {PrismaPassResetRepository} from './data/repositories/pass-reset.repository';
import {PassResetUseCase} from './domain/use-cases/pass-reset.use-case';
import {PassResetController} from './presentation/controllers/pass-reset.controller';
import {PassResetRepository} from './domain/contracts/pass-reset.repository';
import {PinDigestService} from './data/services/pin-digest.service';
import {PassResetMailerService} from './data/services/pass-reset-mailer.service';

@Module({
    imports: [PrismaModule],
    controllers: [PassResetController],
    providers: [
        {
            provide: PassResetRepository,
            useClass: PrismaPassResetRepository,
        },
        {
            provide: PinDigestService,
            useClass: PinDigestService,
        },
        {
            provide: PassResetMailerService,
            useClass: PassResetMailerService,
        },
        {
            provide: PassResetUseCase,
            useFactory: (repository: PassResetRepository, pinDigestService: PinDigestService, mailerService: PassResetMailerService) => new PassResetUseCase(repository, pinDigestService, mailerService),
            inject: [PassResetRepository, PinDigestService, PassResetMailerService],
        },
    ],
})

export class PassResetModule {}