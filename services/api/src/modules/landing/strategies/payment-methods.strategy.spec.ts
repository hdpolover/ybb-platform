// services/api/src/modules/landing/strategies/payment-methods.strategy.spec.ts
import { ConfigService } from '@nestjs/config';
import type { Brand } from '@prisma/client';
import { PaymentMethodsStrategy, toPublicPaymentMethod } from './payment-methods.strategy';
import { fetchOpenRegistrationPrograms } from './registration-editions.util';
import { CACHE_KEYS, CACHE_TTL } from '../../../shared/constants/cache-keys';

jest.mock('./registration-editions.util', () => ({
  fetchOpenRegistrationPrograms: jest.fn(),
}));

const SENSITIVE_VALUES = ['9876543210', 'PT Secret Holder', 'Transfer to BCA then upload proof', 'admin-only note', 'server-key-xyz', 'BCA Bank'];
const SENSITIVE_KEYS = [
  'id', 'code', 'account_number', 'account_name', 'bank_name', 'instructions', 'admin_instructions',
  'description', 'gateway_name', 'config', 'requires_proof', 'program_id_internal',
];

// A deliberately toxic Go view: every secret-ish field populated.
const manualView = {
  id: 'm-1',
  name: 'bca-master',
  display_name: 'Bank Transfer (BCA)',
  type: 'manual',
  code: 'manual_bca',
  icon: 'https://cdn.example.com/bca.png',
  is_active: true,
  is_enabled: true,
  bank_name: 'BCA Bank',
  account_number: '9876543210',
  account_name: 'PT Secret Holder',
  instructions: 'Transfer to BCA then upload proof',
  admin_instructions: 'admin-only note',
  requires_proof: true,
  gateway_name: '',
  gateway_type: '',
  config: { fixed_fee: 1, secret: 'server-key-xyz' },
  description: 'Transfer to BCA then upload proof',
};
const cardView = {
  ...manualView,
  id: 'm-2',
  display_name: 'Credit / Debit Card',
  type: 'automatic',
  code: 'midtrans_cc',
  icon: 'not-a-url-just-an-identifier',
  gateway_name: 'midtrans',
  gateway_type: 'credit_card',
};

describe('PaymentMethodsStrategy', () => {
  const brand = { id: 'brand-1' } as Brand;
  const cache = { get: jest.fn(), set: jest.fn() };
  const http = { get: jest.fn() };
  const config = { get: jest.fn() } as unknown as ConfigService;
  let strategy: PaymentMethodsStrategy;

  beforeEach(() => {
    jest.clearAllMocks();
    cache.get.mockResolvedValue(undefined);
    cache.set.mockResolvedValue(undefined);
    (config.get as jest.Mock).mockReturnValue('internal-key');
    (fetchOpenRegistrationPrograms as jest.Mock).mockResolvedValue([
      { id: 'prog-1', slug: 'meys-6th' },
    ]);
    strategy = new PaymentMethodsStrategy({} as never, cache as never, http as never, config);
  });

  it('returns per-program name/type/logo only', async () => {
    http.get.mockResolvedValue({ data: { data: [manualView, cardView] } });

    const result = await strategy.getData(brand);

    expect(result).toEqual({
      programs: [
        {
          program_id: 'prog-1',
          program_slug: 'meys-6th',
          methods: [
            { name: 'Bank Transfer (BCA)', type: 'manual', logo_url: 'https://cdn.example.com/bca.png' },
            { name: 'Credit / Debit Card', type: 'credit_card', logo_url: null },
          ],
        },
      ],
    });
  });

  it('never leaks account details, instructions, credentials or gateway config', async () => {
    http.get.mockResolvedValue({ data: { data: [manualView, cardView] } });

    const result = await strategy.getData(brand);
    const json = JSON.stringify(result);

    for (const value of SENSITIVE_VALUES) expect(json).not.toContain(value);
    for (const method of result.programs[0].methods) {
      expect(Object.keys(method).sort()).toEqual(['logo_url', 'name', 'type']);
      for (const key of SENSITIVE_KEYS) expect(method).not.toHaveProperty(key);
    }
    // Also guards the cached copy, which is what the next request is served.
    expect(JSON.stringify(cache.set.mock.calls)).not.toContain('9876543210');
  });

  it('asks the payment service for the per-program merged list with gateway-liveness filter', async () => {
    http.get.mockResolvedValue({ data: { data: [] } });

    await strategy.getData(brand);

    expect(http.get).toHaveBeenCalledWith('/api/v1/programs/prog-1/payment-methods', {
      params: { available_only: true },
      headers: { 'X-Internal-Service-Key': 'internal-key' },
    });
  });

  it('drops disabled and inactive methods and ones without a name', () => {
    expect(toPublicPaymentMethod({ ...manualView, is_enabled: false })).toBeNull();
    expect(toPublicPaymentMethod({ ...manualView, is_active: false })).toBeNull();
    expect(toPublicPaymentMethod({ ...manualView, display_name: ' ', name: '' })).toBeNull();
  });

  it('accepts root-relative logo paths and rejects other icon strings', () => {
    expect(toPublicPaymentMethod({ ...manualView, icon: '/img/pay/bca.svg' })?.logo_url).toBe('/img/pay/bca.svg');
    expect(toPublicPaymentMethod({ ...manualView, icon: 'javascript:alert(1)' })?.logo_url).toBeNull();
  });

  it('serves from cache without calling the payment service', async () => {
    const cached = [{ name: 'Cached', type: 'manual', logo_url: null }];
    cache.get.mockResolvedValue(cached);

    const result = await strategy.getData(brand);

    expect(http.get).not.toHaveBeenCalled();
    expect(result.programs[0].methods).toEqual(cached);
    expect(cache.get).toHaveBeenCalledWith(CACHE_KEYS.LANDING_PAYMENT_METHODS('prog-1'));
  });

  it('caches the sanitized list for the medium TTL', async () => {
    http.get.mockResolvedValue({ data: { data: [manualView] } });

    await strategy.getData(brand);

    expect(cache.set).toHaveBeenCalledWith(
      CACHE_KEYS.LANDING_PAYMENT_METHODS('prog-1'),
      [{ name: 'Bank Transfer (BCA)', type: 'manual', logo_url: 'https://cdn.example.com/bca.png' }],
      CACHE_TTL.MEDIUM,
    );
  });

  it('returns an empty list (uncached) when the payment service fails', async () => {
    http.get.mockRejectedValue(new Error('ECONNREFUSED'));

    const result = await strategy.getData(brand);

    expect(result.programs[0].methods).toEqual([]);
    expect(cache.set).not.toHaveBeenCalled();
  });

  it('returns no programs when there is no brand', async () => {
    expect(await strategy.getData(null)).toEqual({ programs: [] });
    expect(http.get).not.toHaveBeenCalled();
  });
});
