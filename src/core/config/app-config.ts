export const APP_CONFIG = Symbol('APP_CONFIG');

export type NodeEnvironment = 'development' | 'test' | 'production';

export interface AppConfig {
  nodeEnv: NodeEnvironment;
  port: number;
  corsOrigins: string[];
  databaseUrl: string;
  auth: {
    accessTokenSecret: string;
    refreshTokenSecret: string;
    accessTokenTtlSeconds: number;
    refreshTokenTtlSeconds: number;
    issuer: string;
  };
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

export function loadAppConfig(): AppConfig {
  const nodeEnv = parseNodeEnvironment(process.env.NODE_ENV);
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

  return {
    nodeEnv,
    port: parsePort(process.env.PORT),
    corsOrigins: parseCorsOrigins(process.env.CORS_ORIGINS),
    databaseUrl:
      process.env.DATABASE_URL ??
      'postgres://postgres:postgres@localhost:5432/edu_app_sadi',
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
    },
  };
}

export const appConfigProvider = { 
  provide: APP_CONFIG,
  useFactory: loadAppConfig,
};
