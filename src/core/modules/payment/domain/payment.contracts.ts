export interface CreatePaymentInput {
  transactionId: string;
  amount: number;
  currency: string;
  productName: string;
  productCategory: string;
  customer: {
    name: string;
    email: string;
    address: string;
    city: string;
    postalCode: string;
    country: string;
    phone: string;
  };
  metadata?: Record<string, string>;
}

export interface PaymentSession {
  transactionId: string;
  sessionKey: string;
  checkoutUrl: string;
}

export type PaymentStatus = 'VALID' | 'FAILED' | 'CANCELLED' | 'PENDING';

export interface PaymentNotification {
  transactionId: string;
  status: PaymentStatus;
  amount?: number;
  currency?: string;
  bankTransactionId?: string;
  raw: Record<string, unknown>;
}

/** Provider boundary kept independent of HTTP and transport details. */
export abstract class PaymentGateway {
  abstract createSession(input: CreatePaymentInput): Promise<PaymentSession>;
  abstract verifyNotification(
    payload: Record<string, unknown>,
  ): Promise<PaymentNotification>;
}
