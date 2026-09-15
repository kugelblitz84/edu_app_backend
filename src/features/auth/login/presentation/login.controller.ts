import {
  Body,
  Controller,
  ForbiddenException,
  Inject,
  PipeTransform,
  Post,
  Req,
  UnauthorizedException,
  UnprocessableEntityException,
} from '@nestjs/common';
import type { Request } from 'express';
import { APP_CONFIG, type AppConfig } from '../../../../core/config/app-config';
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

class LoginRequestValidationPipe implements PipeTransform<
  unknown,
  LoginRequestDto
> {
  transform(value: unknown): LoginRequestDto {
    const result = loginRequestSchema.safeParse(value);

    if (result.success) {
      return result.data;
    }

    throw new UnprocessableEntityException({
      message: 'Login request is invalid.',
      violations: [
        ...new Set(result.error.issues.map((issue) => issue.message)),
      ],
    });
  }
}

@Controller({ path: 'auth', version: '1' })
export class LoginController {
  constructor(
    private readonly loginUser: LoginUseCase,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  @Post('login')
  async login(
    @Body(new LoginRequestValidationPipe()) request: LoginRequestDto,
    @Req() httpRequest: Request,
  ): Promise<LoginResponseDto> {
    try {
      const region = httpRequest.get(this.config.auth.ipRegionHeader)?.trim();
      return toLoginResponseDto(
        await this.loginUser.execute(request, {
          ipAddress: httpRequest.ip,
          ipRegion: region ? region.toUpperCase() : undefined,
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
