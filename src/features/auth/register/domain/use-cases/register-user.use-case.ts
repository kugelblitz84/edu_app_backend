import { PasswordHasher } from '../contracts/password-hasher.service';
import { normalizer, RegisterUserInput } from '../contracts/normalizer.service';
import { RegisterUserRepository } from '../contracts/register-user.repository';
import type { RegisteredUser } from '../entities/registered-user.entity';





export class RegisterUserUseCase {
  constructor(
    private readonly repository: RegisterUserRepository,
    private readonly passwordHasher: PasswordHasher,
    private readonly normalizer: normalizer
  ) {}

  async execute(input: RegisterUserInput): Promise<RegisteredUser> {
    const normalized = this.normalizer.normalizeAndValidate(input);
    const passwordHash = await this.passwordHasher.hash(normalized.password);

    return this.repository.createGuestUser({
      email: normalized.email,
      username: normalized.username,
      passwordHash,
      fullName: normalized.username,
    });
  }

  
}
