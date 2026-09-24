import { Module } from '@nestjs/common';
import { MongooseModule } from '../../core/database/mongoose.module';
import { PrismaModule } from '../../core/database/prisma.module';
import { PrismaMongoExamRepository } from './data/exam.repository';
import { ExamRepository } from './domain/exam.repository';
import { ExamUseCases } from './domain/exam.usecases';
import { ExamController } from './presentation/exam.controllers';

@Module({
  imports: [PrismaModule, MongooseModule],
  providers: [
    ExamUseCases,
    { provide: ExamRepository, useClass: PrismaMongoExamRepository },
  ],
  controllers: [ExamController],
})
export class ExamModule {}
