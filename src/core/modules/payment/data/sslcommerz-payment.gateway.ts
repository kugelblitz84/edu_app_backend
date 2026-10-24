import {
  BadGatewayException,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { APP_CONFIG, type AppConfig } from '../../../config/app-config';
import { Inject } from '@nestjs/common';
import {
  PaymentGateway,
} from '../domain/payment.contracts';
import type {
  CreatePaymentInput,
  PaymentNotification,
  PaymentStatus,
  PaymentSession,
} from '../domain/payment.types';

const API_ROOT = 'https://sandbox.sslcommerz.com';
const LIVE_API_ROOT = 'https://securepay.sslcommerz.com';

@Injectable()
export class SslCommerzPaymentGateway extends PaymentGateway {
  constructor(@Inject(APP_CONFIG) private readonly config: AppConfig) {
    super();
  }

  async createSession(input: CreatePaymentInput): Promise<PaymentSession> {
    const credentials = this.credentials();
    const root = this.rootUrl();
    const data = new URLSearchParams({
      store_id: credentials.storeId,
      store_passwd: credentials.password,
      total_amount: input.amount.toFixed(2),
      currency: input.currency,
      tran_id: input.transactionId,
      success_url: this.requiredUrl('successUrl'),
      fail_url: this.requiredUrl('failureUrl'),
      cancel_url: this.requiredUrl('cancelledUrl'),
      ipn_url: this.requiredUrl('ipnUrl'),
      product_name: input.productName,
      product_category: input.productCategory,
      product_profile: 'general',
      cus_name: input.customer.name,
      cus_email: input.customer.email,
      cus_add1: input.customer.address,
      cus_city: input.customer.city,
      cus_postcode: input.customer.postalCode,
      cus_country: input.customer.country,
      cus_phone: input.customer.phone,
      shipping_method: 'NO',
    });
    for (const [key, value] of Object.entries(input.metadata ?? {})) {
      if (/^[A-Za-z0-9_]{1,32}$/.test(key)) data.set(`value_a${key}`, value);
    }

    const body = await this.post(`${root}/gwprocess/v4/api.php`, data);
    const response = await body.json() as Record<string, unknown>;
    if (
      typeof response.GatewayPageURL !== 'string' ||
      typeof response.sessionkey !== 'string' ||
      typeof response.status !== 'string' || response.status !== 'SUCCESS'
    ) {
      throw new BadGatewayException('SSLCommerz did not create a checkout session.');
    }
    return {
      transactionId: input.transactionId,
      sessionKey: response.sessionkey,
      checkoutUrl: response.GatewayPageURL,
    };
  }

  async verifyNotification(
    payload: Record<string, unknown>,
  ): Promise<PaymentNotification> {
    const transactionId = String(payload.tran_id ?? '');
    const validationId = String(payload.val_id ?? '');
    if (!transactionId || !validationId) {
      throw new BadGatewayException('SSLCommerz notification is missing transaction validation data.');
    }
    const credentials = this.credentials();
    const query = new URLSearchParams({
      val_id: validationId,
      store_id: credentials.storeId,
      store_passwd: credentials.password,
      format: 'json',
    });
    const response = await this.get(`${this.rootUrl()}/validator/api/validationserverAPI.php?${query}`);
    const verified = await response.json() as Record<string, unknown>;
    if (String(verified.tran_id ?? '') !== transactionId) {
      throw new BadGatewayException('SSLCommerz transaction ID validation failed.');
    }
    const statusText = String(verified.status ?? '').toUpperCase();
    const status: PaymentStatus = statusText === 'VALID' || statusText === 'VALIDATED'
      ? 'VALID'
      : statusText === 'CANCELLED'
        ? 'CANCELLED'
        : statusText === 'FAILED'
          ? 'FAILED'
          : 'PENDING';
    return {
      transactionId,
      status,
      amount: Number(verified.amount) || undefined,
      currency: typeof verified.currency === 'string' ? verified.currency : undefined,
      bankTransactionId: typeof verified.bank_tran_id === 'string'
        ? verified.bank_tran_id : undefined,
      raw: verified,
    };
  }

  private credentials(): { storeId: string; password: string } {
    const storeId = this.config.payment.sslCommerzStoreId;
    const password = this.config.payment.sslCommerzStorePassword;
    if (!storeId || !password) {
      throw new ServiceUnavailableException('SSLCommerz credentials are not configured.');
    }
    return { storeId, password };
  }

  private requiredUrl(key: 'successUrl' | 'failureUrl' | 'cancelledUrl' | 'ipnUrl'): string {
    const value = this.config.payment[key];
    if (!value) throw new ServiceUnavailableException(`Payment ${key} is not configured.`);
    try {
      const url = new URL(value);
      if (url.protocol !== 'https:' && this.config.nodeEnv === 'production') throw new Error();
      return url.toString();
    } catch {
      throw new ServiceUnavailableException(`Payment ${key} must be a valid HTTPS URL in production.`);
    }
  }

  private rootUrl(): string {
    return this.config.payment.sslCommerzIsLive ? LIVE_API_ROOT : API_ROOT;
  }

  private async post(url: string, body: URLSearchParams): Promise<Response> {
    return this.checkResponse(await fetch(url, { method: 'POST', body }));
  }

  private async get(url: string): Promise<Response> {
    return this.checkResponse(await fetch(url));
  }

  private checkResponse(response: Response): Response {
    if (!response.ok) throw new BadGatewayException('SSLCommerz request failed.');
    return response;
  }
}
