export const APP_CONFIG = Symbol('APP_CONFIG');

export type NodeEnvironment = 'development' | 'test' | 'production';

export interface AppConfig {
  nodeEnv: NodeEnvironment;
  port: number;
  corsOrigins: string[];
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
  return {
    nodeEnv: parseNodeEnvironment(process.env.NODE_ENV),
    port: parsePort(process.env.PORT),
    corsOrigins: parseCorsOrigins(process.env.CORS_ORIGINS),
  };
}

export const appConfigProvider = {
  provide: APP_CONFIG,
  useFactory: loadAppConfig,
};
