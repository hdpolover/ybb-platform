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
});
