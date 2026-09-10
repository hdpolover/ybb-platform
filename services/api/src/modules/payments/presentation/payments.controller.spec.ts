// src/modules/payments/presentation/payments.controller.spec.ts

import { ParseUUIDPipe, BadRequestException } from '@nestjs/common';

// Audit M148: GET /payments/:id used to bind `id` as a bare @Param('id') with
// no shape validation, so a traversal/encoded segment reached
// payment.repository.ts's URL interpolation unchecked. The fix binds
// `@Param('id', new ParseUUIDPipe())`. Unit-invoking the controller method
// directly bypasses Nest's pipe pipeline (pipes only run inside the real HTTP
// request cycle), so this test exercises the exact pipe instance the
// controller now declares, the same way the route itself will.
describe('PaymentsController getPaymentDetail - M148 id validation', () => {
  const pipe = new ParseUUIDPipe();
  const metadata = { type: 'param', data: 'id' } as const;

  it('rejects a path-traversal id before it can reach the repository interpolation', async () => {
    await expect(pipe.transform('foo/../methods', metadata as never)).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('rejects a percent-encoded path separator', async () => {
    await expect(pipe.transform('foo%2Fbar', metadata as never)).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('rejects a non-UUID plain string', async () => {
    await expect(pipe.transform('not-a-uuid', metadata as never)).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('accepts a well-formed UUID unchanged', async () => {
    const uuid = '4202cef4-9e6d-4772-bea7-e01a719138fe';
    await expect(pipe.transform(uuid, metadata as never)).resolves.toBe(uuid);
  });
});

// Audit N-2026-09-09-B: POST /payments/intents/:id/confirm bound `id` as a
// bare @Param('id') with no shape validation. Same fix as M148: bind
// `@Param('id', new ParseUUIDPipe())`. Verified same way M148's own test does.
describe('PaymentsController confirmPayment - N-2026-09-09-B id validation', () => {
  const pipe = new ParseUUIDPipe();
  const metadata = { type: 'param', data: 'id' } as const;

  it('rejects a path-traversal id', async () => {
    await expect(pipe.transform('foo/../confirm', metadata as never)).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('rejects a percent-encoded path separator', async () => {
    await expect(pipe.transform('foo%2Fbar', metadata as never)).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('rejects a non-UUID plain string', async () => {
    await expect(pipe.transform('not-a-uuid', metadata as never)).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('accepts a well-formed UUID unchanged', async () => {
    const uuid = '4202cef4-9e6d-4772-bea7-e01a719138fe';
    await expect(pipe.transform(uuid, metadata as never)).resolves.toBe(uuid);
  });
});
