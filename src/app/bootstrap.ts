import { VersioningType, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';
import { APP_CONFIG, AppConfig } from '../core/config/app-config';
import helmet from 'helmet';
export async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bufferLogs: true,
  });

  const config = app.get<AppConfig>(APP_CONFIG);

  const isProduction = config.nodeEnv === 'production';
  const isTest = config.nodeEnv === 'test';

  if (isProduction) {
    app.set('trust proxy', 1);
  }

  app.use(
    helmet({
      strictTransportSecurity: isProduction
        ? {
            maxAge: 31_536_000,
            includeSubDomains: true,
            preload: false,
          }
        : false,
    }),
  );

  app.setGlobalPrefix('api');

  app.enableVersioning({
    type: VersioningType.URI,
    defaultVersion: '1',
  });

  app.enableCors({
    origin: config.corsOrigins,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-CSRF-Token'],
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      disableErrorMessages: isProduction,
    }),
  );

  app.enableShutdownHooks();

  if (!isTest) {
    await app.listen(config.port, '0.0.0.0');
  }
}
