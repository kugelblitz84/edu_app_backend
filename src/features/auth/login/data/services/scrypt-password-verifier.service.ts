import { Injectable } from '@nestjs/common';
import { ScryptSecretVerifier } from '../../../../../core/security/scrypt-secret-verifier.service';
@Injectable()
export class ScryptPasswordVerifier extends ScryptSecretVerifier {}
