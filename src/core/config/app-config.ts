import 'dotenv/config';

export const APP_CONFIG = Symbol('APP_CONFIG');

export type NodeEnvironment = 'development' | 'test' | 'production';

export interface AppConfig {
  nodeEnv: NodeEnvironment;
  port: number;
  corsOrigins: string[];
  databaseUrl: string;
  mongodbUrl: string;
  auth: {
    accessTokenSecret: string;
    refreshTokenSecret: string;
    accessTokenTtlSeconds: number;
    refreshTokenTtlSeconds: number;
    issuer: string;
    passwordResetUrl: string;
    passwordResetTtlSeconds: number;
    ipRegionHeader: string;
  };
  mail: {
    host?: string;
    port: number;
    secure: boolean;
    user?: string;
    password?: string;
    from: string;
  };
  passwordHashing: {
    keyLength: number;
    cost: number;
    blockSize: number;
    parallelization: number;
  };
}

function loadHttpsUrl(name: string, value: string | undefined): string {
  const parsed = new URL(value ?? 'https://localhost:3000/reset-password');
  if (parsed.protocol !== 'https:') {
    throw new Error(`${name} must use HTTPS.`);
  }
  return parsed.toString();
}

function parsePositiveInteger(
  name: string,
  value: string | undefined,
  fallback: number,
): number {
  const parsed = Number(value ?? fallback);

  if (!Number.isSafeInteger(parsed) || parsed < 1) {
    throw new Error(`${name} must be a positive integer.`);
  }

  return parsed;
}

function parseIntegerInRange(
  name: string,
  value: string | undefined,
  fallback: number,
  minimum: number,
  maximum: number,
): number {
  const parsed = parsePositiveInteger(name, value, fallback);
  if (parsed < minimum || parsed > maximum) {
    throw new Error(`${name} must be between ${minimum} and ${maximum}.`);
  }
  return parsed;
}

function parseScryptCost(value: string | undefined): number {
  const cost = parseIntegerInRange(
    'SCRYPT_COST',
    value,
    131_072,
    16_384,
    262_144,
  );
  if ((cost & (cost - 1)) !== 0) {
    throw new Error('SCRYPT_COST must be a power of two.');
  }
  return cost;
}

function loadTokenSecret(
  name: string,
  value: string | undefined,
  nodeEnv: NodeEnvironment,
  developmentFallback: string,
): string {
  const secret = value ?? (nodeEnv === 'production' ? '' : developmentFallback);

  if (secret.length < 32) {
    throw new Error(`${name} must contain at least 32 characters.`);
  }

  return secret;
}

function parseNodeEnvironment(value: string | undefined): NodeEnvironment {
  if (value === 'production' || value === 'test') {
    return value;
  }

  return 'development';
}

function parsePort(value: string | undefined): number {
  const port = Number(value ?? 3000);

  if (!Number.isInteger(port) || port < 1 || port > 65_535) {
    throw new Error('PORT must be an integer between 1 and 65535.');
  }

  return port;
}

function parseCorsOrigins(value: string | undefined): string[] {
  if (!value) {
    return ['http://localhost:3000'];
  }

  return value
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
}

function loadDatabaseUrl(value: string | undefined): string {
  const databaseUrl = value?.trim();

  if (!databaseUrl) {
    throw new Error(
      'DATABASE_URL is required. Copy .env.example to .env and set the PostgreSQL connection string.',
    );
  }

  return databaseUrl;
}

function loadMongodbUrl(value: string | undefined): string {
  const mongodbUrl = value?.trim();

  if (!mongodbUrl) {
    throw new Error(
      'MONGODB_URL is required. Copy .env.example to .env and set the MongoDB connection string.',
    );
  }

  if (
    !mongodbUrl.startsWith('mongodb://') &&
    !mongodbUrl.startsWith('mongodb+srv://')
  ) {
    throw new Error(
      'MONGODB_URL must use the mongodb or mongodb+srv protocol.',
    );
  }

  return mongodbUrl;
}

export function loadAppConfig(): AppConfig {
  const nodeEnv = parseNodeEnvironment(process.env.NODE_ENV);
  const smtpHost = process.env.SMTP_HOST?.trim() || undefined;
  const accessTokenSecret = loadTokenSecret(
    'JWT_ACCESS_SECRET',
    process.env.JWT_ACCESS_SECRET,
    nodeEnv,
    'development-access-token-secret-change-me',
  );
  const refreshTokenSecret = loadTokenSecret(
    'JWT_REFRESH_SECRET',
    process.env.JWT_REFRESH_SECRET,
    nodeEnv,
    'development-refresh-token-secret-change-me',
  );

  if (accessTokenSecret === refreshTokenSecret) {
    throw new Error(
      'JWT_ACCESS_SECRET and JWT_REFRESH_SECRET must be different.',
    );
  }

  if (nodeEnv === 'production' && !smtpHost) {
    throw new Error('SMTP_HOST is required in production.');
  }
  if (nodeEnv === 'production' && !process.env.PASSWORD_RESET_URL?.trim()) {
    throw new Error('PASSWORD_RESET_URL is required in production.');
  }
  if (nodeEnv === 'production' && !process.env.MAIL_FROM?.trim()) {
    throw new Error('MAIL_FROM is required in production.');
  }

  if (!!process.env.SMTP_USER !== !!process.env.SMTP_PASSWORD) {
    throw new Error('SMTP_USER and SMTP_PASSWORD must be configured together.');
  }

  return {
    nodeEnv,
    port: parsePort(process.env.PORT),
    corsOrigins: parseCorsOrigins(process.env.CORS_ORIGINS),
    databaseUrl: loadDatabaseUrl(process.env.DATABASE_URL),
    mongodbUrl: loadMongodbUrl(process.env.MONGODB_URL),
    auth: {
      accessTokenSecret,
      refreshTokenSecret,
      accessTokenTtlSeconds: parsePositiveInteger(
        'JWT_ACCESS_TTL_SECONDS',
        process.env.JWT_ACCESS_TTL_SECONDS,
        15 * 60,
      ),
      refreshTokenTtlSeconds: parsePositiveInteger(
        'JWT_REFRESH_TTL_SECONDS',
        process.env.JWT_REFRESH_TTL_SECONDS,
        30 * 24 * 60 * 60,
      ),
      issuer: process.env.JWT_ISSUER?.trim() || 'edu-app-api',
      passwordResetUrl: loadHttpsUrl(
        'PASSWORD_RESET_URL',
        process.env.PASSWORD_RESET_URL,
      ),
      passwordResetTtlSeconds: parsePositiveInteger(
        'PASSWORD_RESET_TTL_SECONDS',
        process.env.PASSWORD_RESET_TTL_SECONDS,
        60 * 60,
      ),
      ipRegionHeader:
        process.env.IP_REGION_HEADER?.trim().toLowerCase() || 'cf-ipcountry',
    },
    mail: {
      host: smtpHost,
      port: parsePositiveInteger('SMTP_PORT', process.env.SMTP_PORT, 587),
      secure: process.env.SMTP_SECURE === 'true',
      user: process.env.SMTP_USER?.trim() || undefined,
      password: process.env.SMTP_PASSWORD,
      from: process.env.MAIL_FROM?.trim() || 'no-reply@edu-app.local',
    },
    passwordHashing: {
      keyLength: parseIntegerInRange(
        'SCRYPT_KEY_LENGTH',
        process.env.SCRYPT_KEY_LENGTH,
        64,
        32,
        128,
      ),
      cost: parseScryptCost(process.env.SCRYPT_COST),
      blockSize: parseIntegerInRange(
        'SCRYPT_BLOCK_SIZE',
        process.env.SCRYPT_BLOCK_SIZE,
        8,
        8,
        32,
      ),
      parallelization: parseIntegerInRange(
        'SCRYPT_PARALLELIZATION',
        process.env.SCRYPT_PARALLELIZATION,
        1,
        1,
        16,
      ),
    },
  };
}

export const appConfigProvider = {
  provide: APP_CONFIG,
  useFactory: loadAppConfig,
};
