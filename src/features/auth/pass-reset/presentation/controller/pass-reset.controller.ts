import { PassResetErrorType, PassResetErrors } from '../../domain/errors/pass-reset.errors';
import { PassResetRepository } from '../../domain/contracts/pass-reset.repository';
import { PinDigestService } from '../services/pin-digest.service';
import { PassResetMailerService } from '../services/pass-reset-mailer.service';

import { Controller } from '@nestjs/common';

@Controller({ path: 'auth', version: '1' })

export class PassResetController {
    constructor(
        private readonly passResetUseCase: PassResetUseCase,
    )
}