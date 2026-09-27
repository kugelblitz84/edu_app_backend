import { Module } from '@nestjs/common';
import { AdminExamModule } from './admin-exam/admin-exam.module';
import { UserExamModule } from './user-exam/user-exam.module';

@Module({
  imports: [AdminExamModule, UserExamModule],
})
export class ExamModule {}
