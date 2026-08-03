import {
  Body,
  ConflictException,
  Controller,
  PipeTransform,
  Post,
  UnprocessableEntityException,
} from '@nestjs/common';
import {
  RegistrationConflictError,
  RegistrationValidationError,
} from '../../domain/errors/registration.error';
import { RegisterUserUseCase } from '../../domain/use-cases/register-user.use-case';
import {
  registerUserRequestSchema,
  type RegisterUserRequestDto,
} from '../dto/register-user-request.dto';
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

@Controller({ path: 'auth', version: '1' })
export class RegisterController {
  constructor(private readonly registerUser: RegisterUserUseCase) {}

  @Post('register')
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
}
