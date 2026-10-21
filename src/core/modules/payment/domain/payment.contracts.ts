import type {
  CreatePaymentInput,
  PaymentNotification,
  PaymentSession,
} from './payment.types';

/** Provider boundary kept independent of HTTP and transport details. */
export abstract class PaymentGateway {
  abstract createSession(input: CreatePaymentInput): Promise<PaymentSession>;
  abstract verifyNotification(
    payload: Record<string, unknown>,
  ): Promise<PaymentNotification>;
}
