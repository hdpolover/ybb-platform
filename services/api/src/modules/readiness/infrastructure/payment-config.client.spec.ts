import { Test, TestingModule } from '@nestjs/testing';
import { PaymentConfigClient } from './payment-config.client';
import { PaymentServiceHttpClient } from '@modules/payments/infrastructure/services/payment-service-http.client';

const mockHttp = { get: jest.fn() };

describe('PaymentConfigClient', () => {
  let client: PaymentConfigClient;

  beforeEach(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      providers: [
        PaymentConfigClient,
        { provide: PaymentServiceHttpClient, useValue: mockHttp },
      ],
    }).compile();
    client = moduleRef.get(PaymentConfigClient);
    jest.clearAllMocks();
  });

  it('requests the admin view so disabled methods are still visible', async () => {
    mockHttp.get.mockResolvedValue({ data: { data: [] } });
    await client.getProgramMethodSummary('p1');
    expect(mockHttp.get).toHaveBeenCalledWith(
      '/programs/p1/payment-methods?include_disabled=true',
      expect.objectContaining({ timeout: 3000 }),
    );
  });

  it('counts enabled methods and reports the overlay as configured', async () => {
    mockHttp.get.mockResolvedValue({
      data: { data: [
        { id: 'm1', is_enabled: true, is_configured: true },
        { id: 'm2', is_enabled: false, is_configured: true },
      ] },
    });
    const summary = await client.getProgramMethodSummary('p1');
    expect(summary).toEqual({ enabledCount: 1, isConfigured: true });
  });

  it('reports isConfigured false when the program has no overlay rows', async () => {
    mockHttp.get.mockResolvedValue({
      data: { data: [{ id: 'm1', is_enabled: true, is_configured: false }] },
    });
    const summary = await client.getProgramMethodSummary('p1');
    expect(summary).toEqual({ enabledCount: 1, isConfigured: false });
  });

  it('returns null when the payment service is unreachable, never a fabricated zero', async () => {
    mockHttp.get.mockRejectedValue(new Error('ECONNREFUSED'));
    expect(await client.getProgramMethodSummary('p1')).toBeNull();
  });

  it('returns null on a malformed body rather than guessing', async () => {
    mockHttp.get.mockResolvedValue({ data: { data: 'not an array' } });
    expect(await client.getProgramMethodSummary('p1')).toBeNull();
  });
});
