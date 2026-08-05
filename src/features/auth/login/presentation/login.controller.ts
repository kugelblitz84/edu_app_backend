import {
  Body,
  Controller,
  ForbiddenException,
  PipeTransform,
  Post,
  UnauthorizedException,
  UnprocessableEntityException,
} from '@nestjs/common';
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
  constructor(private readonly loginUser: LoginUseCase) {}

  @Post('login')
  async login(
    @Body(new LoginRequestValidationPipe()) request: LoginRequestDto,
  ): Promise<LoginResponseDto> {
    try {
      return toLoginResponseDto(await this.loginUser.execute(request));
    } catch (error) {
      if (error instanceof InvalidCredentialsError) {
        throw new UnauthorizedException(error.message);
      }

      if (error instanceof LoginNotAllowedError) {
        throw new ForbiddenException(error.message);
      }

      throw error;
    }
  }
}
