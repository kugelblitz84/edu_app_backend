import { Module } from '@nestjs/common';
import { PaymentGateway } from './domain/payment.contracts';
import { PaymentUseCases } from './domain/payment.usecases';
import { SslCommerzPaymentGateway } from './data/sslcommerz-payment.gateway';
import { PaymentController } from './presentation/payment.controllers';

@Module({
  controllers: [PaymentController],
  providers: [
    PaymentUseCases,
    { provide: PaymentGateway, useClass: SslCommerzPaymentGateway },
  ],
  exports: [PaymentUseCases, PaymentGateway],
})
export class PaymentModule {}
