import { Module } from '@nestjs/common';
import { MongooseModule } from '../../../core/database/mongoose.module';
import { PrismaModule } from '../../../core/database/prisma.module';
import { PrismaMongoExamRepository } from './data/exam.repository';
import { ExamRepository } from './domain/exam.repository';
import { ExamUseCases } from './domain/exam.usecases';
import { AdminExamController } from './presentation/exam.controllers';
import { ExamInvitationModule } from '../invitations/exam-invitation.module';
import { ExamInvitationUseCases } from './domain/exam-invitation.usecases';

@Module({
  imports: [PrismaModule, MongooseModule, ExamInvitationModule],
  providers: [
    ExamUseCases,
    ExamInvitationUseCases,
    { provide: ExamRepository, useClass: PrismaMongoExamRepository },
  ],
  controllers: [AdminExamController],
})
export class AdminExamModule {}
