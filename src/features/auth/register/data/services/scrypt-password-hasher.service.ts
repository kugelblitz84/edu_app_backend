import { Injectable } from '@nestjs/common';
import { ScryptSecretHasher } from '../../../../../core/security/scrypt-secret-hasher.service';
@Injectable()
export class ScryptPasswordHasher extends ScryptSecretHasher {}
