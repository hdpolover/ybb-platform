import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'crypto';

const TOKEN_VERSION = 1;
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;

function getSecret(): string {
    const secret = process.env.AMBASSADOR_SHARE_TOKEN_SECRET || process.env.JWT_SECRET;
    if (!secret) {
        throw new Error('Missing ambassador share token secret');
    }
    return secret;
}

function deriveKey(secret: string): Buffer {
    return createHash('sha256').update(secret).digest();
}

function uuidToBytes(uuid: string): Buffer {
    const normalized = uuid.replace(/-/g, '');
    if (!/^[0-9a-fA-F]{32}$/.test(normalized)) {
        throw new Error('Invalid ambassador share token payload');
    }
    return Buffer.from(normalized, 'hex');
}

function bytesToUuid(bytes: Buffer): string {
    if (bytes.length !== 16) {
        throw new Error('Invalid ambassador share token payload');
    }

    const hex = bytes.toString('hex');
    return [
        hex.slice(0, 8),
        hex.slice(8, 12),
        hex.slice(12, 16),
        hex.slice(16, 20),
        hex.slice(20),
    ].join('-');
}

export function createAmbassadorShareToken(ambassadorId: string): string {
    const key = deriveKey(getSecret());
    const iv = randomBytes(IV_LENGTH);
    const cipher = createCipheriv('aes-256-gcm', key, iv);
    const payload = uuidToBytes(ambassadorId);
    const encrypted = Buffer.concat([cipher.update(payload), cipher.final()]);
    const tag = cipher.getAuthTag();

    return Buffer.concat([
        Buffer.from([TOKEN_VERSION]),
        iv,
        encrypted,
        tag,
    ]).toString('base64url');
}

export function parseAmbassadorShareToken(token: string): string {
    const raw = Buffer.from(token, 'base64url');
    const minLength = 1 + IV_LENGTH + 16 + AUTH_TAG_LENGTH;

    if (raw.length < minLength) {
        throw new Error('Invalid ambassador share token');
    }

    const version = raw.readUInt8(0);
    if (version !== TOKEN_VERSION) {
        throw new Error('Unsupported ambassador share token version');
    }

    const iv = raw.subarray(1, 1 + IV_LENGTH);
    const tag = raw.subarray(raw.length - AUTH_TAG_LENGTH);
    const encrypted = raw.subarray(1 + IV_LENGTH, raw.length - AUTH_TAG_LENGTH);
    const decipher = createDecipheriv('aes-256-gcm', deriveKey(getSecret()), iv);
    decipher.setAuthTag(tag);

    const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
    return bytesToUuid(decrypted);
}
