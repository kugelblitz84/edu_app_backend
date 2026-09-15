import { Inject, Injectable } from '@nestjs/common';
import {
  APP_CONFIG,
  type AppConfig,
} from '../../../../../core/config/app-config';
import { MailerService } from '../../../../../core/mail/mailer.service';
import { PassResetMailerService as PassResetMailerContract } from '../../domain/contracts/pass-reset-mailer.service';

@Injectable()
export class PassResetMailerService implements PassResetMailerContract {
  constructor(
    private readonly mailer: MailerService,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  async sendResetLink(email: string, token: string): Promise<void> {
    const link = new URL(this.config.auth.passwordResetUrl);
    link.searchParams.set('token', token);
    if (link.protocol !== 'https:') throw new Error('Reset URL must use HTTPS');

    await this.mailer.send({
      to: email,
      subject: 'Reset your password',
      text:
        `Use this secure link to reset your password: ${link.toString()}\n\n` +
        'If you did not request this, you can ignore this email.',
      html:
        '<p>Use the secure link below to reset your password:</p>' +
        `<p><a href="${link.toString()}">Reset password</a></p>` +
        '<p>If you did not request this, you can ignore this email.</p>',
    });
  }

  async sendPasswordChangedNotice(email: string): Promise<void> {
    await this.mailer.send({
      to: email,
      subject: 'Your password was changed',
      text: 'Your password was changed successfully. If you did not make this change, contact support immediately.',
      html:
        '<p>Your password was changed successfully.</p>' +
        '<p>If you did not make this change, contact support immediately.</p>',
    });
  }
}
