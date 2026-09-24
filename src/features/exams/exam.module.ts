import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { MongooseModule } from '../../core/database/mongoose.module';
import { PrismaModule } from '../../core/database/prisma.module';
import { TokenModule } from '../../core/token/token.module';
import { PrismaMongoExamRepository } from './data/exam.repository';
import { ExamRepository } from './domain/exam.repository';
import { ExamUseCases } from './domain/exam.usecases';
import { ExamAuthMiddleware } from './presentation/exam-auth.middleware';
import { ExamController } from './presentation/exam.controllers';

@Module({
  imports: [PrismaModule, MongooseModule, TokenModule],
  providers: [
    ExamAuthMiddleware,
    ExamUseCases,
    { provide: ExamRepository, useClass: PrismaMongoExamRepository },
  ],
  controllers: [ExamController],
})
export class ExamModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(ExamAuthMiddleware).forRoutes(ExamController);
  }
}
