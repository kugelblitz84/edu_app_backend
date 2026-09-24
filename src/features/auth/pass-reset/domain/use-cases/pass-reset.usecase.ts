import { createHash, randomBytes } from 'node:crypto';
import { PasswordVerifier } from '../../../login/domain/contracts/password-verifier.service';
import { PasswordHasher } from '../../../register/domain/contracts/password-hasher.service';
import { PassResetMailerService } from '../contracts/pass-reset-mailer.service';
import { PassResetRepository } from '../contracts/pass-reset.repository';
import {
  InvalidAccessTokenError,
  InvalidCurrentPasswordError,
  InvalidResetTokenError,
} from '../errors/pass-reset.errors';

export const RESET_REQUEST_MESSAGE =
  'If an account exists for that email, a password reset link will be sent.';

export type AuthenticatedResetResult =
  'password_changed' | 'verification_required';

export class PassResetUseCase {
  constructor(
    private readonly repository: PassResetRepository,
    private readonly passwordHasher: PasswordHasher,
    private readonly passwordVerifier: PasswordVerifier,
    private readonly mailer: PassResetMailerService,
    private readonly resetTtlSeconds: number,
  ) {}

  async requestByEmail(email: string): Promise<void> {
    const user = await this.repository.findUserByEmail(email);
    if (!user || user.status !== 'ACTIVE') return;
    await this.issueEmailReset(user.id, user.email);
  }

  async confirm(token: string, newPassword: string): Promise<string> {
    const reset = await this.repository.findResetByDigest(this.digest(token));
    const now = new Date();
    if (!reset || reset.consumedAt || reset.expiresAt <= now) {
      throw new InvalidResetTokenError();
    }
    const user = await this.repository.findUserById(reset.userId);
    if (!user || user.status !== 'ACTIVE') {
      throw new InvalidResetTokenError();
    }

    const passwordHash = await this.passwordHasher.hash(newPassword);
    const consumed = await this.repository.consumeResetAndChangePassword(
      reset.id,
      reset.userId,
      passwordHash,
      now,
    );
    if (!consumed) throw new InvalidResetTokenError();
    await this.sendChangedNotice(user.email);
    return user.id;
  }

  async changeAuthenticated(input: {
    userId: string;
    accessTokenIssuedAt: Date;
    currentPassword: string;
    newPassword: string;
    ipAddress?: string;
    ipRegion?: string;
  }): Promise<AuthenticatedResetResult> {
    const user = await this.repository.findUserById(input.userId);
    if (
      !user ||
      user.status !== 'ACTIVE' ||
      (user.passwordChangedAt &&
        input.accessTokenIssuedAt.getTime() <
          Math.floor(user.passwordChangedAt.getTime() / 1000) * 1000)
    ) {
      throw new InvalidAccessTokenError();
    }

    const trustedContext =
      !!input.ipAddress &&
      !!input.ipRegion &&
      input.ipAddress === user.lastLoginIp &&
      input.ipRegion === user.lastLoginRegion;

    if (!trustedContext) {
      await this.issueEmailReset(user.id, user.email);
      return 'verification_required';
    }

    const matches = await this.passwordVerifier.verify(
      input.currentPassword,
      user.passwordHash,
    );
    if (!matches) throw new InvalidCurrentPasswordError();

    const passwordHash = await this.passwordHasher.hash(input.newPassword);
    await this.repository.changePassword(user.id, passwordHash, new Date());
    await this.sendChangedNotice(user.email);
    return 'password_changed';
  }

  private async issueEmailReset(userId: string, email: string): Promise<void> {
    const token = randomBytes(32).toString('base64url');
    const expiresAt = new Date(Date.now() + this.resetTtlSeconds * 1000);
    await this.repository.replaceActiveReset(
      userId,
      this.digest(token),
      expiresAt,
    );
    await this.mailer.sendResetLink(email, token);
  }

  private digest(token: string): string {
    return createHash('sha256').update(token, 'utf8').digest('hex');
  }

  private async sendChangedNotice(email: string): Promise<void> {
    try {
      await this.mailer.sendPasswordChangedNotice(email);
    } catch {
      // The password change is already committed; notification is best-effort.
    }
  }
}
