import { Module } from '@nestjs/common';
import { AdminExamModule } from './admin-exam/admin-exam.module';
import { UserExamModule } from './user-exam/user-exam.module';
import { LiveExamModule } from './exam-live/live-exam.module';

@Module({
  imports: [AdminExamModule, UserExamModule, LiveExamModule],
})
export class ExamModule {}
