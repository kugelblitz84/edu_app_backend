import { Injectable } from '@nestjs/common';
import { scrypt, timingSafeEqual } from 'node:crypto';
import { PasswordVerifier } from '../../domain/contracts/password-verifier.service';

const KEY_LENGTH = 64;
const COST = 16_384;
const BLOCK_SIZE = 8;
const PARALLELIZATION = 1;

@Injectable()
export class ScryptPasswordVerifier implements PasswordVerifier {
  async verify(password: string, passwordHash: string): Promise<boolean> {
    const [algorithm, cost, blockSize, parallelization, salt, encodedKey] =
      passwordHash.split('$');

    if (
      algorithm !== 'scrypt' ||
      Number(cost) !== COST ||
      Number(blockSize) !== BLOCK_SIZE ||
      Number(parallelization) !== PARALLELIZATION ||
      !salt ||
      !encodedKey
    ) {
      return false;
    }

    try {
      const storedKey = Buffer.from(encodedKey, 'base64url');
      if (storedKey.length !== KEY_LENGTH) {
        return false;
      }

      const suppliedKey = await this.deriveKey(password, salt);
      return timingSafeEqual(storedKey, suppliedKey);
    } catch {
      return false;
    }
  }

  private deriveKey(password: string, salt: string): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      scrypt(
        password,
        salt,
        KEY_LENGTH,
        {
          N: COST,
          r: BLOCK_SIZE,
          p: PARALLELIZATION,
          maxmem: 32 * 1024 * 1024,
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
}
