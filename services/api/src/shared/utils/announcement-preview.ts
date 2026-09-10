// src/shared/utils/announcement-preview.ts
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service';
import { buildRichTextPreview, richTextToPlainText } from './rich-text';

/** Plain-text characters a dashboard announcement preview is cut to. */
export const ANNOUNCEMENT_PREVIEW_LENGTH = 100;

/**
 * Characters of raw `content` fetched to build a 100-character preview.
 *
 * Audit M55: the dashboards pulled whole announcement bodies just to slice a
 * preview off the front. Live measurement (2026-09-10, 405 rows): avg 5,650
 * bytes, max 16,706, and the worst program's top-3 came to 42,798 bytes per
 * dashboard cache miss - roughly 50x everything else in that query.
 *
 * The prefix is safe because the preview only depends on the first
 * ANNOUNCEMENT_PREVIEW_LENGTH characters of the STRIPPED text, and stripping
 * is prefix-stable: truncating the tail cannot change how the head renders.
 * So whenever the prefix yields more than that many plain-text characters, the
 * preview is byte-identical to the one the full body would have produced.
 *
 * Measured against all 405 live rows: the audit entry's prescribed 300 breaks
 * 54 of them (13%) and 500 still breaks one; 600 is the first clean value.
 * 2000 is that with headroom, and `fetchProgramAnnouncementPreviews` re-reads
 * the full body for any row the prefix cannot decide - so markup-heavy bodies
 * (an inline base64 image, say) stay correct rather than merely unlikely.
 */
export const ANNOUNCEMENT_CONTENT_PREFIX_CHARS = 2000;

export interface AnnouncementPreview {
    id: string;
    title: string;
    date: Date;
    preview: string;
    isRead: boolean;
}

interface AnnouncementPrefixRow {
    id: string;
    title: string;
    createdAt: Date;
    contentPrefix: string;
    contentLength: number;
    isRead: boolean;
}

/**
 * Top `take` active announcements of a program, as previews.
 *
 * Raw SQL because Prisma has no `LEFT()` / prefix projection. That also means
 * the soft-delete client extension does NOT apply here, so `deleted_at IS NULL`
 * is spelled out - it is injected automatically on the Prisma path this
 * replaces (applyDeletedAtToIncludes) and dropping it would surface deleted
 * announcements.
 */
export async function fetchProgramAnnouncementPreviews(
    prisma: PrismaService,
    programId: string,
    userId: string,
    take = 3,
): Promise<AnnouncementPreview[]> {
    const rows = await prisma.$queryRaw<AnnouncementPrefixRow[]>`
        SELECT a.id,
               a.title,
               a.created_at AS "createdAt",
               left(a.content, ${ANNOUNCEMENT_CONTENT_PREFIX_CHARS}) AS "contentPrefix",
               length(a.content) AS "contentLength",
               EXISTS (
                   SELECT 1 FROM program_announcement_reads r
                   WHERE r.announcement_id = a.id AND r.user_id = ${userId}::uuid
               ) AS "isRead"
        FROM program_announcements a
        WHERE a.program_id = ${programId}::uuid
          AND a.is_active = true
          AND a.deleted_at IS NULL
        ORDER BY a.created_at DESC
        LIMIT ${take}
    `;

    // A truncated body whose prefix strips down to <= the preview length is the
    // only case the prefix cannot answer: the real preview may continue past
    // the cut. Re-read just those bodies rather than guess at user-visible text.
    const undecided = rows.filter(
        (row) =>
            row.contentLength > ANNOUNCEMENT_CONTENT_PREFIX_CHARS &&
            richTextToPlainText(row.contentPrefix).length <= ANNOUNCEMENT_PREVIEW_LENGTH,
    );

    const fullContentById = new Map<string, string>();
    if (undecided.length > 0) {
        const full = await prisma.programAnnouncement.findMany({
            where: { id: { in: undecided.map((row) => row.id) } },
            select: { id: true, content: true },
        });
        for (const row of full) {
            fullContentById.set(row.id, row.content);
        }
    }

    return rows.map((row) => ({
        id: row.id,
        title: row.title,
        date: row.createdAt,
        preview: buildRichTextPreview(
            fullContentById.get(row.id) ?? row.contentPrefix,
            ANNOUNCEMENT_PREVIEW_LENGTH,
        ),
        isRead: row.isRead,
    }));
}
