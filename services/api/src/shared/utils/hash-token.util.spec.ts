// src/shared/utils/hash-token.util.spec.ts
import { createHash } from 'crypto';
import { hashToken } from './hash-token.util';

describe('hashToken', () => {
  it('returns the sha256 hex digest of the input', () => {
    const token = 'a'.repeat(64);
    expect(hashToken(token)).toBe(createHash('sha256').update(token).digest('hex'));
  });

  it('is deterministic for the same input', () => {
    const token = 'some-random-token-value';
    expect(hashToken(token)).toBe(hashToken(token));
  });

  it('produces different digests for different inputs', () => {
    expect(hashToken('token-a')).not.toBe(hashToken('token-b'));
  });
});
