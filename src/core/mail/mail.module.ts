import { Module } from '@nestjs/common';
import { MailerService } from './mailer.service';
import { NodemailerMailerService } from './nodemailer-mailer.service';

@Module({
  providers: [
    {
      provide: MailerService,
      useClass: NodemailerMailerService,
      // useFactory: (config: AppConfig) => {
      //   return config.mail.host == "dev" ? new NodemailerMailerService(config) : new MailServerMailerService(config);
      // }
    },
  ],
  exports: [MailerService],
})
export class MailModule {}
