import { Module } from '@nestjs/common';
import { MongooseModule } from '../../../core/database/mongoose.module';
import { PrismaModule } from '../../../core/database/prisma.module';
import { ExamSharedModule } from '../shared/exam-shared.module';
import { MongoExamContentReader } from './data/mongo-exam-content.reader';
import { PrismaLiveExamRepository } from './data/prisma-live-exam.repository';
import { ExamContentReader } from './domain/contracts/exam-content.reader';
import { LiveExamRealtimePublisher } from './domain/contracts/live-exam-realtime.publisher';
import { LiveExamRepository } from './domain/contracts/live-exam.repository';
import { GetAttemptResultUseCase } from './domain/usecases/get-attempt-result.usecase';
import { GradeAttemptUseCase } from './domain/usecases/grade-attempt.usecase';
import { RecoverAttemptUseCase } from './domain/usecases/recover-attempt.usecase';
import { SaveAnswerUseCase } from './domain/usecases/save-answer.usecase';
import { StartAttemptUseCase } from './domain/usecases/start-attempt.usecase';
import { SubmitAttemptUseCase } from './domain/usecases/submit-attempt.usecase';
import {
  LiveExamController,
  StartExamAttemptController,
} from './presentation/live-exam.controller';
import { LiveExamGateway } from './realtime/live-exam.gateway';
import { SocketAuthService } from './realtime/socket-auth.service';
import { SocketIoLiveExamRealtimePublisher } from './realtime/socket-io-realtime.publisher';
import { LiveExamSocketServerRef } from './realtime/socket-server.ref';
import { ExpiredAttemptsWorker } from './workers/expired-attempts.worker';

@Module({
  imports: [PrismaModule, MongooseModule, ExamSharedModule],
  controllers: [StartExamAttemptController, LiveExamController],
  providers: [
    StartAttemptUseCase,
    RecoverAttemptUseCase,
    SaveAnswerUseCase,
    SubmitAttemptUseCase,
    GradeAttemptUseCase,
    GetAttemptResultUseCase,
    ExpiredAttemptsWorker,
    SocketAuthService,
    LiveExamSocketServerRef,
    LiveExamGateway,
    { provide: LiveExamRepository, useClass: PrismaLiveExamRepository },
    { provide: ExamContentReader, useClass: MongoExamContentReader },
    {
      provide: LiveExamRealtimePublisher,
      useClass: SocketIoLiveExamRealtimePublisher,
    },
  ],
  exports: [LiveExamRepository],
})
export class LiveExamModule {}
