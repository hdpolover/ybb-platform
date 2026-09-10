// src/shared/utils/hash-token.util.ts
import { createHash } from 'crypto';

// Audit M144: shared sha256-hex hashing for any credential-bearing token that
// is stored at rest and later looked up by exact match (password reset,
// email verification, refresh tokens). Extracted from
// support-access.service.ts's private hashToken() so every write/lookup site
// uses the exact same hash, rather than each handler growing its own
// (potentially divergent) implementation. Not for password hashing - those
// stay on bcrypt; this is for high-entropy random tokens where a fast hash
// is fine because there is no brute-forceable keyspace to slow down.
export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}
