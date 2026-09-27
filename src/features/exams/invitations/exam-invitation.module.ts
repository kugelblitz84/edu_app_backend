import { Module } from '@nestjs/common';
import { ExamInvitationTokenService } from './exam-invitation-token.service';

@Module({
  providers: [ExamInvitationTokenService],
  exports: [ExamInvitationTokenService],
})
export class ExamInvitationModule {}
