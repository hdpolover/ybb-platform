// src/shared/utils/svix-signature.ts
import { createHmac, timingSafeEqual } from 'crypto';

// Svix's own default tolerance; also bounds replay of a captured request.
export const SVIX_TIMESTAMP_TOLERANCE_SECONDS = 5 * 60;

export interface SvixVerifyInput {
  /** The webhook signing secret as shown in the dashboard (`whsec_...`). */
  secret: string;
  id: string | undefined;
  timestamp: string | undefined;
  /** Space-separated `v1,<base64>` entries (several during secret rotation). */
  signature: string | undefined;
  /** The exact bytes received. A re-serialised JSON body will not verify. */
  rawBody: Buffer | string;
  nowMs?: number;
}

/**
 * Verifies a Svix-signed webhook (what Resend uses) with node:crypto only.
 * Returns false on any problem instead of throwing, so callers cannot leak
 * which check failed.
 */
export function verifySvixSignature(input: SvixVerifyInput): boolean {
  const { secret, id, timestamp, signature, rawBody } = input;
  if (!secret || !id || !timestamp || !signature) return false;

  const timestampSeconds = Number(timestamp);
  if (!Number.isInteger(timestampSeconds)) return false;
  const nowSeconds = Math.floor((input.nowMs ?? Date.now()) / 1000);
  if (Math.abs(nowSeconds - timestampSeconds) > SVIX_TIMESTAMP_TOLERANCE_SECONDS) return false;

  const key = Buffer.from(secret.replace(/^whsec_/, ''), 'base64');
  const body = typeof rawBody === 'string' ? rawBody : rawBody.toString('utf8');
  const expected = createHmac('sha256', key).update(`${id}.${timestamp}.${body}`).digest();

  return signature.split(' ').some((entry) => {
    const [version, value] = entry.split(',');
    if (version !== 'v1' || !value) return false;
    const candidate = Buffer.from(value, 'base64');
    return candidate.length === expected.length && timingSafeEqual(candidate, expected);
  });
}
