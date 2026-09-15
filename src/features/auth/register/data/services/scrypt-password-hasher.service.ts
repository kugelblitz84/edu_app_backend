import { Inject, Injectable } from '@nestjs/common';
import { randomBytes, scrypt } from 'node:crypto';
import {
  APP_CONFIG,
  type AppConfig,
} from '../../../../../core/config/app-config';
import { PasswordHasher } from '../../domain/contracts/password-hasher.service';

@Injectable()
export class ScryptPasswordHasher implements PasswordHasher {
  constructor(@Inject(APP_CONFIG) private readonly config: AppConfig) {}

  async hash(password: string): Promise<string> {
    const salt = randomBytes(16).toString('base64url');
    const derivedKey = await this.deriveKey(password, salt);
    const { cost, blockSize, parallelization } = this.config.passwordHashing;

    return [
      'scrypt',
      cost,
      blockSize,
      parallelization,
      salt,
      derivedKey.toString('base64url'),
    ].join('$');
  }

  private deriveKey(password: string, salt: string): Promise<Buffer> {
    const { keyLength, cost, blockSize, parallelization } =
      this.config.passwordHashing;
    return new Promise((resolve, reject) => {
      scrypt(
        password,
        salt,
        keyLength,
        {
          N: cost,
          r: blockSize,
          p: parallelization,
          maxmem: this.calculateMaxMemory(
            cost,
            blockSize,
            parallelization,
            keyLength,
          ),
        },
        (error, derivedKey) => {
          if (error) {
            reject(error);
            return;
          }

          resolve(derivedKey);
        },
      );
    });
  }

  private calculateMaxMemory(
    cost: number,
    blockSize: number,
    parallelization: number,
    keyLength: number,
  ): number {
    return (
      128 * cost * blockSize +
      128 * blockSize * parallelization +
      keyLength +
      1024 * 1024
    );
  }
}
