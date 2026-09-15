import { Module } from '@nestjs/common';
import { MailerService } from './mailer.service';
import { NodemailerMailerService } from './nodemailer-mailer.service';

@Module({
  providers: [
    {
      provide: MailerService,
      useClass: NodemailerMailerService,
    },
  ],
  exports: [MailerService],
})
export class MailModule {}
