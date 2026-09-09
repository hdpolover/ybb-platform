import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { ConfirmPortalPaymentDto } from './portal-payment.dto';

const basePayload = {
  payment_type: 'gateway' as const,
  payment_method_id: 'credit_card',
};

// Regression for M46: application_invoices.payment_method is
// @db.VarChar(50) (see prisma/schema/applications.prisma), and this handler
// writes it AFTER a payment-service side effect (createIntent /
// processPayment / submitManualPayment) has already run — money can already
// have moved by the time an over-length value used to fail the DB write.
// This DTO guard rejects it at the door (400) before the handler executes,
// i.e. before any side effect can occur.
describe('ConfirmPortalPaymentDto.payment_method_id MaxLength(50)', () => {
  it('accepts a payment_method_id exactly at the 50-char limit', async () => {
    const dto = plainToInstance(ConfirmPortalPaymentDto, {
      ...basePayload,
      payment_method_id: 'a'.repeat(50),
    });
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === 'payment_method_id')).toBe(false);
  });

  it('rejects a payment_method_id over the 50-char limit', async () => {
    const dto = plainToInstance(ConfirmPortalPaymentDto, {
      ...basePayload,
      payment_method_id: 'a'.repeat(51),
    });
    const errors = await validate(dto);
    const fieldError = errors.find((e) => e.property === 'payment_method_id');
    expect(fieldError).toBeDefined();
    expect(fieldError?.constraints).toHaveProperty('maxLength');
  });

  it('still rejects an empty payment_method_id (unrelated existing @IsNotEmpty guard is untouched)', async () => {
    const dto = plainToInstance(ConfirmPortalPaymentDto, { ...basePayload, payment_method_id: '' });
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === 'payment_method_id')).toBe(true);
  });
});
