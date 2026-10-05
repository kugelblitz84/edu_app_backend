import { Module } from '@nestjs/common';
import { MongooseModule } from '../../../core/database/mongoose.module';
import { PrismaModule } from '../../../core/database/prisma.module';
import { JwtExamInvitationTokenService } from './data/exam-invitation-token.service';
import { PrismaMongoExamRepository } from './data/exam.repository';
import { MockExamInvitationBulkMailService } from './data/mock-exam-invitation-bulk-mail.service';
import {
  ExamInvitationBulkMailService,
  ExamInvitationTokenService,
} from './domain/exam-invitation.services';
import { ExamRepository } from './domain/exam.repository';
import { ExamUseCases } from './domain/exam.usecases';
import { AdminExamController } from './presentation/exam.controllers';
import { ExamInvitationUseCases } from './domain/exam-invitation.usecases';

@Module({
  imports: [PrismaModule, MongooseModule],
  providers: [
    ExamUseCases,
    ExamInvitationUseCases,
    { provide: ExamRepository, useClass: PrismaMongoExamRepository },
    {
      provide: ExamInvitationTokenService,
      useClass: JwtExamInvitationTokenService,
    },
    {
      provide: ExamInvitationBulkMailService,
      useClass: MockExamInvitationBulkMailService,
    },
  ],
  controllers: [AdminExamController],
  exports: [ExamInvitationTokenService],
})
export class AdminExamModule {}
