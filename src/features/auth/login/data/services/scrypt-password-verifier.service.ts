import { Inject, Injectable } from '@nestjs/common';
import { scrypt, timingSafeEqual } from 'node:crypto';
import {
  APP_CONFIG,
  type AppConfig,
} from '../../../../../core/config/app-config';
import { PasswordVerifier } from '../../domain/contracts/password-verifier.service';

const LEGACY_PARAMETERS = { cost: 16_384, blockSize: 8, parallelization: 1 };

@Injectable()
export class ScryptPasswordVerifier implements PasswordVerifier {
  constructor(@Inject(APP_CONFIG) private readonly config: AppConfig) {}

  async verify(password: string, passwordHash: string): Promise<boolean> {
    const [algorithm, cost, blockSize, parallelization, salt, encodedKey] =
      passwordHash.split('$');

    if (algorithm !== 'scrypt' || !salt || !encodedKey) {
      return false;
    }

    try {
      const storedKey = Buffer.from(encodedKey, 'base64url');
      const parameters = {
        cost: Number(cost),
        blockSize: Number(blockSize),
        parallelization: Number(parallelization),
      };
      const currentParameters = this.config.passwordHashing;
      const isCurrent =
        storedKey.length === currentParameters.keyLength &&
        currentParameters.cost === parameters.cost &&
        currentParameters.blockSize === parameters.blockSize &&
        currentParameters.parallelization === parameters.parallelization;
      const isLegacy =
        storedKey.length === 64 &&
        [LEGACY_PARAMETERS].some(
          (supported) =>
            supported.cost === parameters.cost &&
            supported.blockSize === parameters.blockSize &&
            supported.parallelization === parameters.parallelization,
        );
      if (!isCurrent && !isLegacy) return false;

      const suppliedKey = await this.deriveKey(
        password,
        salt,
        storedKey.length,
        parameters,
      );
      return timingSafeEqual(storedKey, suppliedKey);
    } catch {
      return false;
    }
  }

  private deriveKey(
    password: string,
    salt: string,
    keyLength: number,
    parameters: {
      cost: number;
      blockSize: number;
      parallelization: number;
    },
  ): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      scrypt(
        password,
        salt,
        keyLength,
        {
          N: parameters.cost,
          r: parameters.blockSize,
          p: parameters.parallelization,
          maxmem: this.calculateMaxMemory(
            parameters.cost,
            parameters.blockSize,
            parameters.parallelization,
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
