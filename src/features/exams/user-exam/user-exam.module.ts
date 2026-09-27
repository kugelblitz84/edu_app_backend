import { Module } from '@nestjs/common';
import { PrismaModule } from '../../../core/database/prisma.module';
import { ExamInvitationModule } from '../invitations/exam-invitation.module';
import { PrismaUserExamRepository } from './data/user-exam.repository';
import { UserExamRepository } from './domain/user-exam.contracts';
import { UserExamUseCases } from './domain/user-exam.usecases';
import { UserExamController } from './presentation/exam.controller';

@Module({
  imports: [PrismaModule, ExamInvitationModule],
  providers: [
    UserExamUseCases,
    { provide: UserExamRepository, useClass: PrismaUserExamRepository },
  ],
  controllers: [UserExamController],
})
export class UserExamModule {}
