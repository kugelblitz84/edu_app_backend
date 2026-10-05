import { Module } from '@nestjs/common';
import { PrismaModule } from '../../../core/database/prisma.module';
import { ExamSharedModule } from '../shared/exam-shared.module';
import { PrismaUserExamRepository } from './data/user-exam.repository';
import { UserExamRepository } from './domain/user-exam.contracts';
import { UserExamUseCases } from './domain/user-exam.usecases';
import { UserExamController } from './presentation/exam.controller';

@Module({
  imports: [PrismaModule, ExamSharedModule],
  providers: [
    UserExamUseCases,
    { provide: UserExamRepository, useClass: PrismaUserExamRepository },
  ],
  controllers: [UserExamController],
})
export class UserExamModule {}
