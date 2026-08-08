// src/modules/payments/presentation/downstream-error.util.ts

/**
 * Pull a user-facing message out of a payment-service error body.
 *
 * The Go payment service answers every non-2xx with `{"error": "..."}` (gin's
 * `gin.H{"error": ...}` house style), while these controllers used to probe
 * only for a `message` key. The result was that every 4xx the Go service
 * bothered to write a real explanation for — validation failures, and now the
 * duplicate-payment-method 409 — arrived at the admin dashboard as the
 * contentless fallback string. Accept both shapes.
 *
 * NestJS itself emits `message`, so `message` wins when both are present.
 */
export function extractDownstreamMessage(data: unknown, fallback: string): string {
  if (typeof data === 'string' && data.trim()) return data;
  if (typeof data !== 'object' || data === null) return fallback;

  const body = data as { message?: unknown; error?: unknown };

  for (const candidate of [body.message, body.error]) {
    if (typeof candidate === 'string' && candidate.trim()) return candidate;
    if (Array.isArray(candidate)) {
      const joined = candidate.filter((p): p is string => typeof p === 'string').join(', ');
      if (joined.trim()) return joined;
    }
  }

  return fallback;
}
