import { NormalizeAndValidateServiceImpl } from '../../data/services/normalize-and-validate.service';
import { PasswordHasher } from '../contracts/password-hasher.service';
import { RegisterUserRepository } from '../contracts/register-user.repository';
import type { CreateUserRecord } from '../contracts/types';
import { RegistrationValidationError } from '../errors/registration.error';
import { RegisterUserUseCase } from './register-user.use-case';

class FakePasswordHasher implements PasswordHasher {
  hash(password: string): Promise<string> {
    return Promise.resolve(`hashed:${password}`);
  }
}

class FakeRegisterUserRepository implements RegisterUserRepository {
  public createdUser?: CreateUserRecord;

  createGuestUser(user: CreateUserRecord) {
    this.createdUser = user;

    return Promise.resolve({
      id: '5cae6d1a-930c-45a2-8408-8fb1be8446af',
      email: user.email,
      username: user.username,
      platformRole: 'PLATFORM_USER' as const,
      status: 'ACTIVE' as const,
      createdAt: new Date('2026-08-03T00:00:00.000Z'),
    });
  }
}

describe(RegisterUserUseCase.name, () => {
  it('normalizes email and creates a guest user with a password hash', async () => {
    const repository = new FakeRegisterUserRepository();
    const useCase = new RegisterUserUseCase(
      repository,
      new FakePasswordHasher(),
      new NormalizeAndValidateServiceImpl(),
    );

    const user = await useCase.execute({
      email: '  USER@Example.COM ',
      username: 'learner_01',
      password: 'StrongPassword123',
    });

    expect(repository.createdUser).toEqual({
      email: 'user@example.com',
      username: 'learner_01',
      passwordHash: 'hashed:StrongPassword123',
      fullName: 'learner_01',
    });
    expect(user.platformRole).toBe('PLATFORM_USER');
    expect(user.status).toBe('ACTIVE');
  });

  it('rejects weak or malformed registration input', async () => {
    const useCase = new RegisterUserUseCase(
      new FakeRegisterUserRepository(),
      new FakePasswordHasher(),
      new NormalizeAndValidateServiceImpl(),
    );

    await expect(
      useCase.execute({
        email: 'not-an-email',
        username: 'no spaces',
        password: 'password',
      }),
    ).rejects.toBeInstanceOf(RegistrationValidationError);
  });
});
