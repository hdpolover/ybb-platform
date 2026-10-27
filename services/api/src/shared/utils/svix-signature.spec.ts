// src/shared/utils/svix-signature.spec.ts
import { createHmac } from 'crypto';
import { verifySvixSignature } from './svix-signature';

const SECRET_BYTES = Buffer.from('super-secret-signing-key-bytes!!');
const SECRET = `whsec_${SECRET_BYTES.toString('base64')}`;
const NOW_MS = 1_800_000_000_000;
const NOW_S = String(NOW_MS / 1000);
const BODY = '{"type":"email.delivered","data":{"email_id":"abc"}}';

const sign = (id: string, ts: string, body: string, key: Buffer = SECRET_BYTES) =>
  `v1,${createHmac('sha256', key).update(`${id}.${ts}.${body}`).digest('base64')}`;

const base = { secret: SECRET, id: 'msg_1', timestamp: NOW_S, rawBody: BODY, nowMs: NOW_MS };

describe('verifySvixSignature', () => {
  it('accepts a correctly signed payload', () => {
    expect(verifySvixSignature({ ...base, signature: sign('msg_1', NOW_S, BODY) })).toBe(true);
  });

  it('accepts when any one of several space-separated signatures matches', () => {
    const rotated = `v1,${Buffer.from('nope').toString('base64')} ${sign('msg_1', NOW_S, BODY)}`;
    expect(verifySvixSignature({ ...base, signature: rotated })).toBe(true);
  });

  it('rejects a signature made with a different key', () => {
    const forged = sign('msg_1', NOW_S, BODY, Buffer.from('another-key'));
    expect(verifySvixSignature({ ...base, signature: forged })).toBe(false);
  });

  it('rejects a tampered body', () => {
    const sig = sign('msg_1', NOW_S, BODY);
    expect(verifySvixSignature({ ...base, rawBody: BODY.replace('abc', 'xyz'), signature: sig })).toBe(false);
  });

  it('rejects a stale timestamp (older than 5 minutes)', () => {
    const stale = String(NOW_MS / 1000 - 301);
    expect(verifySvixSignature({ ...base, timestamp: stale, signature: sign('msg_1', stale, BODY) })).toBe(false);
  });

  it('rejects a timestamp too far in the future', () => {
    const future = String(NOW_MS / 1000 + 301);
    expect(verifySvixSignature({ ...base, timestamp: future, signature: sign('msg_1', future, BODY) })).toBe(false);
  });

  it.each([
    ['id', { id: undefined }],
    ['timestamp', { timestamp: undefined }],
    ['signature', { signature: undefined }],
    ['secret', { secret: '' }],
  ])('rejects when %s is missing', (_name, override) => {
    expect(verifySvixSignature({ ...base, signature: sign('msg_1', NOW_S, BODY), ...override })).toBe(false);
  });

  it('rejects non-v1 and malformed entries without throwing', () => {
    expect(verifySvixSignature({ ...base, signature: 'v2,abcd garbage v1,' })).toBe(false);
  });
});
