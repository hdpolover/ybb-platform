import * as crypto from 'crypto';

// Shared by MetaCapiService and TikTokEventsService — both platforms require
// SHA-256 of the lowercased, trimmed value for PII match keys (email, phone,
// external_id). Absent values are omitted entirely (never hashed-empty).
export function normalizeAndHash(value: string | undefined): string | null {
    if (!value) return null;
    const normalized = value.trim().toLowerCase();
    if (!normalized) return null;
    return crypto.createHash('sha256').update(normalized).digest('hex');
}
