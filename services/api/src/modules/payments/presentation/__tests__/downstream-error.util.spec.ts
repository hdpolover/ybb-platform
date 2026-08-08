// src/modules/payments/presentation/__tests__/downstream-error.util.spec.ts

import { extractDownstreamMessage } from '../downstream-error.util';

describe('extractDownstreamMessage', () => {
  const FALLBACK = 'Payment request failed';

  it('reads the "error" key the Go payment service actually writes', () => {
    // gin.H{"error": ...} is the house style across every Go handler. The
    // controllers used to probe only for "message", so a duplicate-name 409
    // reached the admin dashboard with no reason attached.
    const body = { error: 'A payment method named "PayPal (Manual)" already exists.' };

    expect(extractDownstreamMessage(body, FALLBACK)).toBe(
      'A payment method named "PayPal (Manual)" already exists.',
    );
  });

  it('prefers "message" when both keys are present', () => {
    const body = { message: 'from nest', error: 'from go' };

    expect(extractDownstreamMessage(body, FALLBACK)).toBe('from nest');
  });

  it('joins a class-validator message array', () => {
    const body = { message: ['name should not be empty', 'type must be a string'] };

    expect(extractDownstreamMessage(body, FALLBACK)).toBe(
      'name should not be empty, type must be a string',
    );
  });

  it('accepts a bare string body', () => {
    expect(extractDownstreamMessage('Invalid program id', FALLBACK)).toBe('Invalid program id');
  });

  it.each([
    ['null', null],
    ['undefined', undefined],
    ['an empty object', {}],
    ['a blank message', { message: '   ' }],
    ['a blank error', { error: '' }],
    ['a non-string message', { message: 42 }],
    ['an array of non-strings', { message: [1, 2] }],
  ])('falls back for %s', (_label, body) => {
    expect(extractDownstreamMessage(body, FALLBACK)).toBe(FALLBACK);
  });
});
