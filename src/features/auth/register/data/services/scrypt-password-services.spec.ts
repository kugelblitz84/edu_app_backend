import type { AppConfig } from '../../../../../core/config/app-config';
import { ScryptPasswordVerifier } from '../../../login/data/services/scrypt-password-verifier.service';
import { ScryptPasswordHasher } from './scrypt-password-hasher.service';

const config: AppConfig = {
  nodeEnv: 'test',
  port: 3000,
  corsOrigins: [],
  databaseUrl: 'postgres://unused',
  auth: {
    accessTokenSecret: 'a'.repeat(32),
    accessTokenTtlSeconds: 900,
    refreshTokenTtlSeconds: 2_592_000,
    issuer: 'edu-app-api',
    passwordResetUrl: 'https://example.com/reset-password',
    passwordResetTtlSeconds: 3600,
    ipRegionHeader: 'cf-ipcountry',
  },
  mail: {
    port: 587,
    secure: false,
    from: 'no-reply@example.com',
  },
  passwordHashing: {
    keyLength: 32,
    cost: 16_384,
    blockSize: 8,
    parallelization: 1,
  },
};

describe('configurable scrypt password services', () => {
  it('hashes and verifies with the parameters supplied by AppConfig', async () => {
    const hasher = new ScryptPasswordHasher(config);
    const verifier = new ScryptPasswordVerifier(config);
    const password = 'A sufficiently long password';

    const hash = await hasher.hash(password);
    const [algorithm, cost, blockSize, parallelization, , encodedKey] =
      hash.split('$');

    expect({ algorithm, cost, blockSize, parallelization }).toEqual({
      algorithm: 'scrypt',
      cost: '16384',
      blockSize: '8',
      parallelization: '1',
    });
    expect(Buffer.from(encodedKey, 'base64url')).toHaveLength(32);
    await expect(verifier.verify(password, hash)).resolves.toBe(true);
    await expect(verifier.verify('wrong password', hash)).resolves.toBe(false);
  });
});
