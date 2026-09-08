// services/api/src/modules/programs/application/queries/handlers/get-program-detail.handler.spec.ts
import { GetProgramDetailHandler } from './get-program-detail.handler';
import { GetProgramDetailQuery } from '../get-program-detail.query';

// Categories as they exist in the DB: one live, one soft-deleted (deleteParticipationCategory
// no longer hard-deletes, so a row like `deletedCategory` now persists indefinitely).
const liveCategory = {
    id: 'cat-live',
    name: 'Future Innovators',
    order: 0,
    isActive: true,
    deletedAt: null,
};
const deletedCategory = {
    id: 'cat-deleted',
    name: 'Retired Category',
    order: 1,
    isActive: false,
    deletedAt: new Date('2026-08-01'),
};

describe('GetProgramDetailHandler', () => {
    let handler: GetProgramDetailHandler;
    let prisma: { program: { findFirst: jest.Mock } };
    let cacheManager: { get: jest.Mock; set: jest.Mock };

    beforeEach(() => {
        prisma = { program: { findFirst: jest.fn() } };
        cacheManager = { get: jest.fn().mockResolvedValue(undefined), set: jest.fn() };
        handler = new GetProgramDetailHandler(prisma as any, cacheManager as any);
    });

    it("filters participationCategories on isActive + deletedAt so a soft-deleted category never leaks into the public program-detail response", async () => {
        // Emulate Prisma's own `where` filtering for the participationCategories relation
        // include, the way the real database would apply it, so this test fails if the
        // handler's include ever drops (or weakens) that where clause.
        prisma.program.findFirst.mockImplementation(({ include }: any) => {
            const categoryFilter = include.participationCategories.where;
            const allCategories = [liveCategory, deletedCategory];
            const filtered = allCategories.filter((c) =>
                Object.entries(categoryFilter).every(([key, value]) => (c as any)[key] === value),
            );
            return Promise.resolve({
                id: 'prog-1',
                name: 'Test Program',
                slug: 'test-program',
                participationCategories: filtered,
            });
        });

        const result = (await handler.execute(
            new GetProgramDetailQuery('test-program', 'all'),
        )) as { participationCategories: Array<{ id: string }> };

        expect(result.participationCategories).toHaveLength(1);
        expect(result.participationCategories[0].id).toBe('cat-live');
        expect(result.participationCategories.some((c) => c.id === 'cat-deleted')).toBe(false);
    });

    it('passes deletedAt: null (not just isActive) in the participationCategories where clause', async () => {
        prisma.program.findFirst.mockResolvedValue({
            id: 'prog-1',
            name: 'Test Program',
            slug: 'test-program',
            participationCategories: [],
        });

        await handler.execute(new GetProgramDetailQuery('test-program', 'requirements'));

        const callArgs = prisma.program.findFirst.mock.calls[0][0];
        expect(callArgs.include.participationCategories.where).toEqual({
            isActive: true,
            deletedAt: null,
        });
    });

    // Audit M13: public program detail returned draft/unpublished programs and
    // non-public resources to anonymous callers. Coverage below simulates real
    // Prisma `where` filtering (like the participationCategories test above) so
    // these tests fail if the forced conditions are ever dropped or weakened,
    // not just if the object shape passed to findFirst changes.
    describe('M13: non-admin (isAdmin falsy, i.e. anonymous or non-admin caller) filtering', () => {
        const DRAFT_PROGRAM_ID = '11111111-1111-1111-1111-111111111111';
        const draftProgram = { id: DRAFT_PROGRAM_ID, slug: 'draft-program', isPublished: false, isVisibleToUsers: true, deletedAt: null };

        // Emulates Prisma applying the handler's top-level `where` to a single
        // candidate row, the way the real database would for a findFirst.
        const mockFindFirstAgainst = (row: Record<string, unknown>) => {
            prisma.program.findFirst.mockImplementation(({ where }: any) => {
                const matches = Object.entries(where).every(([key, value]) => {
                    if (value === null) return row[key] == null;
                    return row[key] === value;
                });
                return Promise.resolve(matches ? row : null);
            });
        };

        it('404s an anonymous caller on an unpublished program looked up by id, identically to a non-existent id', async () => {
            mockFindFirstAgainst(draftProgram);

            await expect(
                handler.execute(new GetProgramDetailQuery(DRAFT_PROGRAM_ID, 'basic')),
            ).rejects.toThrow(`Program with ID "${DRAFT_PROGRAM_ID}" not found`);
        });

        it('404s an anonymous caller on an unpublished program looked up by slug, identically to a non-existent slug', async () => {
            mockFindFirstAgainst(draftProgram);

            await expect(
                handler.execute(new GetProgramDetailQuery('draft-program', 'basic')),
            ).rejects.toThrow('Program with slug "draft-program" not found');
        });

        it('scopes the resources include to isPublic: true for a non-admin caller', async () => {
            prisma.program.findFirst.mockResolvedValue({
                id: 'prog-1',
                slug: 'test-program',
                isPublished: true,
                isVisibleToUsers: true,
            });

            await handler.execute(new GetProgramDetailQuery('test-program', 'all'));

            const callArgs = prisma.program.findFirst.mock.calls[0][0];
            expect(callArgs.include.resources.where).toEqual({ isActive: true, isPublic: true });
            // And the forced public/visible gate is on the top-level where too.
            expect(callArgs.where.isPublished).toBe(true);
            expect(callArgs.where.isVisibleToUsers).toBe(true);
        });
    });

    // Regression guard for the admin dashboard (services/admin-dashboard), which
    // legitimately previews draft programs and their full resource list before
    // publishing. isAdmin:true must NOT be affected by any of the M13 filtering.
    describe('M13: admin caller (isAdmin: true) keeps full access', () => {
        it('does not force isPublished/isVisibleToUsers into the where clause, so a draft is still reachable', async () => {
            prisma.program.findFirst.mockResolvedValue({
                id: 'prog-draft',
                slug: 'draft-program',
                isPublished: false,
            });

            await handler.execute(new GetProgramDetailQuery('draft-program', 'basic', undefined, undefined, undefined, true));

            const callArgs = prisma.program.findFirst.mock.calls[0][0];
            expect(callArgs.where.isPublished).toBeUndefined();
            expect(callArgs.where.isVisibleToUsers).toBeUndefined();
        });

        it('includes both public and non-public resources', async () => {
            prisma.program.findFirst.mockResolvedValue({ id: 'prog-1', slug: 'test-program' });

            await handler.execute(new GetProgramDetailQuery('test-program', 'all', undefined, undefined, undefined, true));

            const callArgs = prisma.program.findFirst.mock.calls[0][0];
            expect(callArgs.include.resources.where).toEqual({ isActive: true });
        });
    });
});
