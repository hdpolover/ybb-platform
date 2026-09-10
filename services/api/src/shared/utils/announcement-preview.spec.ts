// src/shared/utils/announcement-preview.spec.ts
import {
    ANNOUNCEMENT_CONTENT_PREFIX_CHARS,
    fetchProgramAnnouncementPreviews,
} from './announcement-preview';
import { buildRichTextPreview } from './rich-text';
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service';

function makePrisma(rows: unknown[], fullRows: { id: string; content: string }[] = []) {
    const $queryRaw = jest.fn().mockResolvedValue(rows);
    const findMany = jest.fn().mockResolvedValue(fullRows);
    return {
        prisma: { $queryRaw, programAnnouncement: { findMany } } as unknown as PrismaService,
        $queryRaw,
        findMany,
    };
}

const PROGRAM_ID = '11111111-1111-1111-1111-111111111111';
const USER_ID = '22222222-2222-2222-2222-222222222222';

describe('fetchProgramAnnouncementPreviews', () => {
    it('builds the preview from the prefix alone when the prefix yields more than 100 plain-text characters', async () => {
        const body = `<p>${'word '.repeat(400)}</p>`;
        const prefix = [...body].slice(0, ANNOUNCEMENT_CONTENT_PREFIX_CHARS).join('');
        const { prisma, findMany } = makePrisma([
            {
                id: 'a1',
                title: 'Long body',
                createdAt: new Date('2026-01-01T00:00:00Z'),
                contentPrefix: prefix,
                contentLength: body.length,
                isRead: false,
            },
        ]);

        const result = await fetchProgramAnnouncementPreviews(prisma, PROGRAM_ID, USER_ID);

        // The whole point of M55: identical output, without reading the full body.
        expect(result[0].preview).toBe(buildRichTextPreview(body));
        expect(findMany).not.toHaveBeenCalled();
    });

    it('re-reads the full body when the prefix is markup-heavy enough to strip below the preview length', async () => {
        // A body whose first 2000 characters are almost entirely tags: the prefix
        // cannot decide the preview, so guessing would change user-visible text.
        const filler = '<span class="x" style="color:#000000;font-size:12px"></span>';
        const body = filler.repeat(60) + '<p>' + 'real text '.repeat(40) + '</p>';
        const prefix = [...body].slice(0, ANNOUNCEMENT_CONTENT_PREFIX_CHARS).join('');
        expect(body.length).toBeGreaterThan(ANNOUNCEMENT_CONTENT_PREFIX_CHARS);

        const { prisma, findMany } = makePrisma(
            [
                {
                    id: 'a2',
                    title: 'Markup heavy',
                    createdAt: new Date('2026-01-02T00:00:00Z'),
                    contentPrefix: prefix,
                    contentLength: body.length,
                    isRead: true,
                },
            ],
            [{ id: 'a2', content: body }],
        );

        const result = await fetchProgramAnnouncementPreviews(prisma, PROGRAM_ID, USER_ID);

        expect(findMany).toHaveBeenCalledWith({
            where: { id: { in: ['a2'] } },
            select: { id: true, content: true },
        });
        expect(result[0].preview).toBe(buildRichTextPreview(body));
        expect(result[0].isRead).toBe(true);
    });

    it('does not re-read a short body that was never truncated', async () => {
        const body = '<p>Short notice</p>';
        const { prisma, findMany } = makePrisma([
            {
                id: 'a3',
                title: 'Short',
                createdAt: new Date('2026-01-03T00:00:00Z'),
                contentPrefix: body,
                contentLength: body.length,
                isRead: false,
            },
        ]);

        const result = await fetchProgramAnnouncementPreviews(prisma, PROGRAM_ID, USER_ID);

        expect(findMany).not.toHaveBeenCalled();
        expect(result[0].preview).toBe('Short notice');
    });

    it('scopes the read to active, non-deleted announcements of the program', async () => {
        const { prisma, $queryRaw } = makePrisma([]);

        await fetchProgramAnnouncementPreviews(prisma, PROGRAM_ID, USER_ID);

        const sql = ($queryRaw.mock.calls[0][0] as string[]).join(' ');
        // Raw SQL bypasses the soft-delete client extension, so these predicates
        // have to be spelled out or deleted announcements resurface.
        expect(sql).toContain('is_active = true');
        expect(sql).toContain('deleted_at IS NULL');
        expect($queryRaw.mock.calls[0]).toContain(PROGRAM_ID);
        expect($queryRaw.mock.calls[0]).toContain(USER_ID);
    });
});
