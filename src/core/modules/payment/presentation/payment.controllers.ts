import { Body, Controller, Post } from '@nestjs/common';
import { Public } from '../../../auth/decorators/public.decorator';
import { ZodValidationPipe } from '../../../validator/zod-validation.pipe';
import { PaymentUseCases } from '../domain/payment.usecases';
import { createPaymentSchema, type CreatePaymentDto } from './payment.dto';

@Controller({ path: 'payments', version: '1' })
export class PaymentController {
  constructor(private readonly useCases: PaymentUseCases) {}

  @Post()
  async create(
    @Body(new ZodValidationPipe(createPaymentSchema)) body: CreatePaymentDto,
  ) {
    return this.useCases.createSession(body);
  }

  /** Server-to-server callback. Always validate with SSLCommerz before accepting status. */
  @Public()
  @Post('ipn')
  async ipn(@Body() payload: Record<string, unknown>) {
    return this.useCases.verifyNotification(payload);
  }

  /** Browser return handlers are also validated and can be used by the client to refresh UI. */
  @Public()
  @Post('success')
  async success(@Body() payload: Record<string, unknown>) {
    return this.useCases.verifyNotification(payload);
  }

  @Public()
  @Post('failure')
  async failure(@Body() payload: Record<string, unknown>) {
    return this.useCases.verifyNotification(payload);
  }

  @Public()
  @Post('cancelled')
  async cancelled(@Body() payload: Record<string, unknown>) {
    return this.useCases.verifyNotification(payload);
  }
}
