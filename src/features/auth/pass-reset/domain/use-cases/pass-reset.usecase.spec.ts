import { createHash } from 'node:crypto';
import {
  TokenService,
  type VerifiedAccessToken,
} from '../../../../../core/token/token.service';
import type { PasswordVerifier } from '../../../login/domain/contracts/password-verifier.service';
import type { PasswordHasher } from '../../../register/domain/contracts/password-hasher.service';
import type { PassResetMailerService } from '../contracts/pass-reset-mailer.service';
import {
  PassResetRepository,
  type PasswordResetRecord,
  type PasswordResetUser,
} from '../contracts/pass-reset.repository';
import {
  InvalidCurrentPasswordError,
  InvalidResetTokenError,
} from '../errors/pass-reset.errors';
import { PassResetUseCase } from './pass-reset.usecase';

const USER: PasswordResetUser = {
  id: 'd92d5f34-8851-41fd-9cfc-f5a4901ad0a5',
  email: 'learner@example.com',
  passwordHash: 'hash:CurrentPassword123',
  status: 'ACTIVE',
  lastLoginIp: '203.0.113.10',
  lastLoginRegion: 'BD',
  passwordChangedAt: null,
};

class FakeRepository extends PassResetRepository {
  user: PasswordResetUser | null = { ...USER };
  reset: (PasswordResetRecord & { digest: string }) | null = null;

  findUserByEmail(email: string): Promise<PasswordResetUser | null> {
    return Promise.resolve(this.user?.email === email ? this.user : null);
  }

  findUserById(userId: string): Promise<PasswordResetUser | null> {
    return Promise.resolve(this.user?.id === userId ? this.user : null);
  }

  replaceActiveReset(
    userId: string,
    tokenDigest: string,
    expiresAt: Date,
  ): Promise<void> {
    this.reset = {
      id: 'reset-id',
      userId,
      digest: tokenDigest,
      expiresAt,
      consumedAt: null,
    };
    return Promise.resolve();
  }

  findResetByDigest(digest: string): Promise<PasswordResetRecord | null> {
    return Promise.resolve(this.reset?.digest === digest ? this.reset : null);
  }

  consumeResetAndChangePassword(
    resetId: string,
    userId: string,
    passwordHash: string,
    changedAt: Date,
  ): Promise<boolean> {
    if (
      !this.reset ||
      this.reset.id !== resetId ||
      this.reset.userId !== userId ||
      this.reset.consumedAt ||
      this.reset.expiresAt <= changedAt ||
      !this.user
    ) {
      return Promise.resolve(false);
    }
    this.reset.consumedAt = changedAt;
    this.user.passwordHash = passwordHash;
    this.user.passwordChangedAt = changedAt;
    return Promise.resolve(true);
  }

  changePassword(
    userId: string,
    passwordHash: string,
    changedAt: Date,
  ): Promise<void> {
    if (this.user?.id === userId) {
      this.user.passwordHash = passwordHash;
      this.user.passwordChangedAt = changedAt;
    }
    return Promise.resolve();
  }
}

class FakeMailer implements PassResetMailerService {
  sent: { email: string; token: string }[] = [];
  changedNotices: string[] = [];
  sendResetLink(email: string, token: string): Promise<void> {
    this.sent.push({ email, token });
    return Promise.resolve();
  }

  sendPasswordChangedNotice(email: string): Promise<void> {
    this.changedNotices.push(email);
    return Promise.resolve();
  }
}

class FakeTokenVerifier implements Pick<TokenService, 'verify'> {
  subject: VerifiedAccessToken = {
    userId: USER.id,
    issuedAt: new Date(),
  };
  verify(): VerifiedAccessToken {
    return this.subject;
  }
}

const hasher: PasswordHasher = {
  hash: (password) => Promise.resolve(`hash:${password}`),
};
const verifier: PasswordVerifier = {
  verify: (password, hash) => Promise.resolve(hash === `hash:${password}`),
};

function setup() {
  const repository = new FakeRepository();
  const mailer = new FakeMailer();
  const tokenVerifier = new FakeTokenVerifier();
  const useCase = new PassResetUseCase(
    repository,
    hasher,
    verifier,
    tokenVerifier,
    mailer,
    3600,
  );
  return { repository, mailer, tokenVerifier, useCase };
}

describe(PassResetUseCase.name, () => {
  it('issues a 256-bit URL-safe token and stores only its digest', async () => {
    const { repository, mailer, useCase } = setup();
    await useCase.requestByEmail(USER.email);

    expect(mailer.sent).toHaveLength(1);
    const token = mailer.sent[0].token;
    expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(repository.reset?.digest).toBe(
      createHash('sha256').update(token).digest('hex'),
    );
    expect(repository.reset?.digest).not.toContain(token);
  });

  it('does nothing observable through mail for an unknown email', async () => {
    const { mailer, useCase } = setup();
    await useCase.requestByEmail('missing@example.com');
    expect(mailer.sent).toHaveLength(0);
  });

  it('consumes a valid token once and rejects reuse', async () => {
    const { repository, mailer, useCase } = setup();
    await useCase.requestByEmail(USER.email);
    const token = mailer.sent[0].token;

    await useCase.confirm(token, 'A completely new password');
    expect(repository.user?.passwordHash).toBe(
      'hash:A completely new password',
    );
    expect(mailer.changedNotices).toEqual([USER.email]);
    await expect(
      useCase.confirm(token, 'Another secure password'),
    ).rejects.toBeInstanceOf(InvalidResetTokenError);
  });

  it('rejects an expired token', async () => {
    const { repository, mailer, useCase } = setup();
    await useCase.requestByEmail(USER.email);
    const token = mailer.sent[0].token;
    if (repository.reset) repository.reset.expiresAt = new Date(Date.now() - 1);

    await expect(
      useCase.confirm(token, 'A completely new password'),
    ).rejects.toBeInstanceOf(InvalidResetTokenError);
  });

  it('changes the password only when token, IP, region, and current password match', async () => {
    const { repository, mailer, useCase } = setup();
    const changed = await useCase.changeAuthenticated({
      accessToken: 'valid',
      currentPassword: 'CurrentPassword123',
      newPassword: 'A completely new password',
      ipAddress: USER.lastLoginIp ?? undefined,
      ipRegion: USER.lastLoginRegion ?? undefined,
    });

    expect(changed).toBe('password_changed');
    expect(repository.user?.passwordHash).toBe(
      'hash:A completely new password',
    );
    expect(repository.user?.passwordChangedAt).toBeInstanceOf(Date);
    expect(mailer.sent).toHaveLength(0);
    expect(mailer.changedNotices).toEqual([USER.email]);
  });

  it('uses email verification on a changed network without checking the supplied current password', async () => {
    const { mailer, useCase } = setup();
    const result = await useCase.changeAuthenticated({
      accessToken: 'valid',
      currentPassword: 'wrong',
      newPassword: 'A completely new password',
      ipAddress: USER.lastLoginIp ?? undefined,
      ipRegion: 'US',
    });

    expect(result).toBe('verification_required');
    expect(mailer.sent).toHaveLength(1);
  });

  it('rejects a bad current password in a trusted network context', async () => {
    const { useCase } = setup();
    await expect(
      useCase.changeAuthenticated({
        accessToken: 'valid',
        currentPassword: 'wrong',
        newPassword: 'A completely new password',
        ipAddress: USER.lastLoginIp ?? undefined,
        ipRegion: USER.lastLoginRegion ?? undefined,
      }),
    ).rejects.toBeInstanceOf(InvalidCurrentPasswordError);
  });
});
