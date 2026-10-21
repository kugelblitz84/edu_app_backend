import { BadRequestException, Injectable } from '@nestjs/common';
import {
  PaymentGateway,
  type CreatePaymentInput,
  type PaymentNotification,
  type PaymentSession,
} from './payment.contracts';

@Injectable()
export class PaymentUseCases {
  constructor(private readonly gateway: PaymentGateway) {}

  createSession(input: CreatePaymentInput): Promise<PaymentSession> {
    if (!Number.isFinite(input.amount) || input.amount <= 0) {
      throw new BadRequestException('Payment amount must be greater than zero.');
    }
    if (!/^[A-Za-z0-9_-]{1,64}$/.test(input.transactionId)) {
      throw new BadRequestException('Invalid transaction ID.');
    }
    return this.gateway.createSession(input);
  }

  verifyNotification(
    payload: Record<string, unknown>,
  ): Promise<PaymentNotification> {
    return this.gateway.verifyNotification(payload);
  }
}
