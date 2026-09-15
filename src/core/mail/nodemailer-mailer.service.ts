import { Inject, Injectable } from '@nestjs/common';
import nodemailer, { type Transporter } from 'nodemailer';
import { APP_CONFIG, type AppConfig } from '../config/app-config';
import { MailerService, type MailMessage } from './mailer.service';

@Injectable()
export class NodemailerMailerService implements MailerService {
  private readonly transporter: Transporter;

  constructor(@Inject(APP_CONFIG) private readonly config: AppConfig) {
    this.transporter = config.mail.host
      ? nodemailer.createTransport({
          host: config.mail.host,
          port: config.mail.port,
          secure: config.mail.secure,
          requireTLS: !config.mail.secure,
          tls: { rejectUnauthorized: true },
          auth:
            config.mail.user && config.mail.password
              ? { user: config.mail.user, pass: config.mail.password }
              : undefined,
        })
      : nodemailer.createTransport({ jsonTransport: true });
  }

  async send(message: MailMessage): Promise<void> {
    await this.transporter.sendMail({
      from: this.config.mail.from,
      to: message.to,
      subject: message.subject,
      text: message.text,
      html: message.html,
    });
  }
}
