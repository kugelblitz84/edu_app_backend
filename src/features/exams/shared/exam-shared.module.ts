import { Module } from '@nestjs/common';
import { PrismaModule } from '../../../core/database/prisma.module';
import { AdminExamModule } from '../admin-exam/admin-exam.module';
import { PrismaExamAccessRepository } from './data/prisma-exam-access.repository';
import { ExamAccessRepository } from './domain/exam-access.repository';
import { ExamAccessService } from './domain/exam-access.service';

@Module({
  imports: [PrismaModule, AdminExamModule],
  providers: [
    ExamAccessService,
    { provide: ExamAccessRepository, useClass: PrismaExamAccessRepository },
  ],
  exports: [ExamAccessService, ExamAccessRepository],
})
export class ExamSharedModule {}
