import type { NormalizedRegisterUser, RegisterUserInput } from './types';

export abstract class normalizer {
  abstract normalizeAndValidate(
    input: RegisterUserInput,
  ): NormalizedRegisterUser;
}
