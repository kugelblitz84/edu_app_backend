import {
  Body,
  Controller,
  ForbiddenException,
  Inject,
  Post,
  Req,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';
import { Public } from '../../../../core/auth/decorators/public.decorator';
import { APP_CONFIG, type AppConfig } from '../../../../core/config/app-config';
import { ZodValidationPipe } from '../../../../core/validator/zod-validation.pipe';
import {
  InvalidCredentialsError,
  LoginNotAllowedError,
} from '../domain/errors/login.error';
import { LoginUseCase } from '../domain/usecases/login.usecase';
import {
  loginRequestSchema,
  type LoginRequestDto,
  type LoginResponseDto,
  toLoginResponseDto,
} from './login.dto';

@Controller({ path: 'auth', version: '1' })
export class LoginController {
  constructor(
    private readonly loginUser: LoginUseCase,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  @Post('login')
  @Public()
  async login(
    @Body(new ZodValidationPipe(loginRequestSchema)) request: LoginRequestDto,
    @Req() httpRequest: Request,
  ): Promise<LoginResponseDto> {
    try {
      const region = httpRequest.get(this.config.auth.ipRegionHeader)?.trim();
      return toLoginResponseDto(
        await this.loginUser.execute(request, {
          ipAddress: httpRequest.ip,
          ipRegion: region ? region.toUpperCase() : undefined,
          userAgent: httpRequest.get('user-agent'),
        }),
      );
    } catch (error) {
      if (error instanceof InvalidCredentialsError) {
        throw new UnauthorizedException('Invalid username or password.');
      }

      if (error instanceof LoginNotAllowedError) {
        throw new ForbiddenException('This account is not active.');
      }

      throw error;
    }
  }
}
