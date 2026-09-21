import {
  Body,
  ConflictException,
  Controller,
  Headers,
  PipeTransform,
  Post,
  UnauthorizedException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { TokenService } from '../../../../../core/token/token.service';
import {
  InstitutionRegistrationConflictError,
  RegistrationConflictError,
  RegistrationValidationError,
} from '../../domain/errors/registration.error';
import { RegisterInstitutionUseCase } from '../../domain/use-cases/register-institution.use-case';
import { RegisterUserUseCase } from '../../domain/use-cases/register-user.use-case';
import {
  registerUserRequestSchema,
  type RegisterUserRequestDto,
} from '../dto/register-user-request.dto';

import { registerInstitutionRequestSchema } from '../dto/register-institution-request.dto';
import type { RegisterInstitutionRequestDto } from '../dto/register-institution-request.dto';
import {
  toRegisterInstitutionResponseDto,
  type RegisterInstitutionResponseDto,
} from '../dto/register-institution-response.dto';
import {
  toRegisterUserResponseDto,
  type RegisterUserResponseDto,
} from '../dto/register-user-response.dto';

const UNSUPPORTED_FIELDS_MESSAGE =
  'Registration request contains unsupported fields.';

class RegisterUserRequestValidationPipe implements PipeTransform<
  unknown,
  RegisterUserRequestDto
> {
  transform(value: unknown): RegisterUserRequestDto {
    const result = registerUserRequestSchema.safeParse(value);

    if (result.success) {
      return result.data;
    }

    throw new UnprocessableEntityException({
      message: 'Registration request is invalid.',
      violations: [
        ...new Set(
          result.error.issues.map((issue) =>
            issue.code === 'unrecognized_keys'
              ? UNSUPPORTED_FIELDS_MESSAGE
              : issue.message,
          ),
        ),
      ],
    });
  }
}

class RegisterInstitutionRequestValidationPipe implements PipeTransform<
  unknown,
  RegisterInstitutionRequestDto
> {
  transform(value: unknown): RegisterInstitutionRequestDto {
    const result = registerInstitutionRequestSchema.safeParse(value);

    if (result.success) {
      return result.data;
    }

    throw new UnprocessableEntityException({
      message: 'Registration request is invalid.',
      violations: [
        ...new Set(
          result.error.issues.map((issue) =>
            issue.code === 'unrecognized_keys'
              ? UNSUPPORTED_FIELDS_MESSAGE
              : issue.message,
          ),
        ),
      ],
    });
  }
}

@Controller({ path: 'auth', version: '1' })
export class RegisterController {
  constructor(
    private readonly registerUser: RegisterUserUseCase,
    private readonly registerInstitutionUseCase: RegisterInstitutionUseCase,
    private readonly tokenService: TokenService,
  ) {}

  @Post('register/user')
  async register(
    @Body(new RegisterUserRequestValidationPipe())
    request: RegisterUserRequestDto,
  ): Promise<RegisterUserResponseDto> {
    try {
      const user = await this.registerUser.execute(request);

      return toRegisterUserResponseDto(user);
    } catch (error) {
      if (error instanceof RegistrationValidationError) {
        throw new UnprocessableEntityException({
          message: error.message,
          violations: error.violations,
        });
      }

      if (error instanceof RegistrationConflictError) {
        throw new ConflictException(error.message);
      }

      throw error;
    }
  }

  @Post('register/institution')
  async registerInstitution(
    @Body(new RegisterInstitutionRequestValidationPipe())
    request: RegisterInstitutionRequestDto,
    @Headers('authorization') authorization?: string,
  ): Promise<RegisterInstitutionResponseDto> {
    const accessToken = this.readBearerToken(authorization);
    let userId: string;

    try {
      userId = this.tokenService.verify(accessToken).userId;
    } catch {
      throw new UnauthorizedException('A valid access token is required.');
    }

    try {
      const institution = await this.registerInstitutionUseCase.execute(
        request,
        userId,
      );

      return toRegisterInstitutionResponseDto(institution);
    } catch (error) {
      if (error instanceof InstitutionRegistrationConflictError) {
        throw new ConflictException(error.message);
      }

      throw error;
    }
  }

  private readBearerToken(authorization?: string): string {
    const match = authorization?.match(/^Bearer ([^\s]+)$/i);
    if (!match || match[1].length > 4096) {
      throw new UnauthorizedException('A valid access token is required.');
    }

    return match[1];
  }
}
