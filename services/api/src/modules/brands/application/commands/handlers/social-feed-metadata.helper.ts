import { randomUUID } from 'crypto';

export type SocialFeedMetadata = {
    imageUrl: string | null;
    caption: string | null;
    postedAt: Date | null;
};

function normalizeOptionalString(value?: string | null): string | null {
    if (value === undefined || value === null) {
        return null;
    }

    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
}

function decodeHtmlEntities(value: string): string {
    return value
        .replace(/&amp;/g, '&')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, '\'')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&#x2F;/gi, '/');
}

function extractMetaContent(html: string, key: string): string | null {
    const patterns = [
        new RegExp(`<meta[^>]+property=["']${key}["'][^>]+content=["']([^"']+)["'][^>]*>`, 'i'),
        new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+property=["']${key}["'][^>]*>`, 'i'),
        new RegExp(`<meta[^>]+name=["']${key}["'][^>]+content=["']([^"']+)["'][^>]*>`, 'i'),
        new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+name=["']${key}["'][^>]*>`, 'i'),
    ];

    for (const pattern of patterns) {
        const match = html.match(pattern);
        const content = normalizeOptionalString(match?.[1]);
        if (content) {
            return decodeHtmlEntities(content);
        }
    }

    return null;
}

function extractJsonBlockCandidates(html: string): string[] {
    const matches = html.matchAll(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi);
    return [...matches]
        .map((match) => normalizeOptionalString(match[1]))
        .filter((value): value is string => value !== null);
}

function findStringValue(value: unknown, keys: string[]): string | null {
    if (!value || typeof value !== 'object') {
        return null;
    }

    if (Array.isArray(value)) {
        for (const item of value) {
            const nested = findStringValue(item, keys);
            if (nested) return nested;
        }
        return null;
    }

    const record = value as Record<string, unknown>;
    for (const key of keys) {
        const direct = normalizeOptionalString(typeof record[key] === 'string' ? record[key] : null);
        if (direct) return direct;
    }

    for (const nested of Object.values(record)) {
        const resolved = findStringValue(nested, keys);
        if (resolved) return resolved;
    }

    return null;
}

function extractLdJsonMetadata(html: string): SocialFeedMetadata {
    for (const block of extractJsonBlockCandidates(html)) {
        try {
            const parsed = JSON.parse(block) as unknown;
            const imageUrl = findStringValue(parsed, ['thumbnailUrl', 'contentUrl', 'image', 'thumbnail']);
            const caption = findStringValue(parsed, ['caption', 'headline', 'description', 'name']);
            const uploadDate = findStringValue(parsed, ['uploadDate', 'datePublished', 'dateCreated']);
            const postedAt = uploadDate ? new Date(uploadDate) : null;

            return {
                imageUrl,
                caption,
                postedAt: postedAt && !Number.isNaN(postedAt.getTime()) ? postedAt : null,
            };
        } catch {
            // Ignore malformed JSON blocks and continue scanning.
        }
    }

    return {
        imageUrl: null,
        caption: null,
        postedAt: null,
    };
}

function extractPostedAtFromRawPayload(html: string): Date | null {
    const match = html.match(/"taken_at_timestamp"\s*:\s*(\d{10,})/i) ?? html.match(/"taken_at"\s*:\s*(\d{10,})/i);
    if (!match?.[1]) {
        return null;
    }

    const timestamp = Number(match[1]);
    if (!Number.isFinite(timestamp)) {
        return null;
    }

    const milliseconds = timestamp > 9_999_999_999 ? timestamp : timestamp * 1000;
    const date = new Date(milliseconds);
    return Number.isNaN(date.getTime()) ? null : date;
}

export function derivePostId(postId: string | undefined, permalink: string): string {
    const normalizedPostId = normalizeOptionalString(postId);
    if (normalizedPostId) {
        return normalizedPostId;
    }

    try {
        const pathnameParts = new URL(permalink).pathname.split('/').filter(Boolean);
        const derived = pathnameParts[pathnameParts.length - 1];
        if (derived) {
            return derived;
        }
    } catch {
        const fallbackParts = permalink.split('/').filter(Boolean);
        const derived = fallbackParts[fallbackParts.length - 1];
        if (derived) {
            return derived;
        }
    }

    return `instagram-${randomUUID()}`;
}

export async function resolveSocialFeedMetadata(permalink: string): Promise<SocialFeedMetadata> {
    const response = await fetch(permalink, {
        method: 'GET',
        headers: {
            Accept: 'text/html,application/xhtml+xml',
            'Accept-Language': 'en-US,en;q=0.9',
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36',
        },
        redirect: 'follow',
    });

    if (!response.ok) {
        throw new Error(`Failed to fetch social metadata: ${response.status}`);
    }

    const html = await response.text();
    const ldJsonMetadata = extractLdJsonMetadata(html);
    const ogImage = extractMetaContent(html, 'og:image') ?? extractMetaContent(html, 'twitter:image');
    const ogCaption = extractMetaContent(html, 'og:title') ?? extractMetaContent(html, 'og:description');
    const postedAt = ldJsonMetadata.postedAt ?? extractPostedAtFromRawPayload(html);

    return {
        imageUrl: ldJsonMetadata.imageUrl ?? ogImage,
        caption: ldJsonMetadata.caption ?? ogCaption,
        postedAt,
    };
}
