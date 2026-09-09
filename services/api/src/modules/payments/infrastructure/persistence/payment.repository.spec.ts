// src/modules/payments/infrastructure/persistence/payment.repository.spec.ts

import { PaymentRepository } from './payment.repository';

// Audit M148: id used to be interpolated into the Go payment service's
// internal GET path with no encoding, so a path-separator character in id
// changed which upstream path segment was actually requested. On the pre-fix
// repository, `findById('foo/../methods')` called
// `/api/v1/payments/foo/../methods` verbatim; post-fix it must call the
// encodeURIComponent'd form, where every '/' becomes '%2F'.
describe('PaymentRepository.findById - M148 URL interpolation', () => {
  const buildRepository = () => {
    const get = jest.fn().mockResolvedValue({
      data: {
        id: 'payment-1',
        user_id: 'user-1',
        amount: 100,
        status: 'SUCCEEDED',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    });
    const paymentServiceClient = { get } as unknown as import('../services/payment-service-http.client').PaymentServiceHttpClient;
    const configService = { get: jest.fn().mockReturnValue('') } as unknown as import('@nestjs/config').ConfigService;

    const repository = new PaymentRepository(paymentServiceClient, configService);
    return { repository, get };
  };

  it('encodeURIComponent-escapes a traversal/path-separator id before interpolating it into the upstream URL', async () => {
    const { repository, get } = buildRepository();

    await repository.findById('foo/../methods');

    // This is the load-bearing assertion: on the pre-fix code, `get` was
    // called with the literal `/api/v1/payments/foo/../methods` (a different
    // upstream path once Node's URL/axios resolves the dot segments), not the
    // encoded form below.
    expect(get).toHaveBeenCalledWith(
      '/api/v1/payments/foo%2F..%2Fmethods',
      expect.anything(),
    );
  });

  it('leaves a well-formed UUID unchanged (no encoding needed, same behavior as before)', async () => {
    const { repository, get } = buildRepository();
    const uuid = '4202cef4-9e6d-4772-bea7-e01a719138fe';

    await repository.findById(uuid);

    expect(get).toHaveBeenCalledWith(`/api/v1/payments/${uuid}`, expect.anything());
  });
});
