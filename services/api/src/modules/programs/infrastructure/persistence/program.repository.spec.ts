// services/api/src/modules/programs/infrastructure/persistence/program.repository.spec.ts
import { ProgramRepository } from './program.repository';

describe('ProgramRepository', () => {
    let repository: ProgramRepository;
    let prisma: { program: { count: jest.Mock; findMany: jest.Mock } };

    beforeEach(() => {
        prisma = {
            program: {
                count: jest.fn().mockResolvedValue(0),
                findMany: jest.fn().mockResolvedValue([]),
            },
        };
        // Audit M34: findAll's `url` filter now resolves via a cached brand-id
        // lookup. No existing test here exercises `url`, so a stub is enough.
        const cacheService = { get: jest.fn().mockResolvedValue(null), set: jest.fn().mockResolvedValue(undefined) };
        repository = new ProgramRepository(prisma as any, cacheService as any);
    });

    // Audit M13: findAll applied whatever isPublished/isActive/isVisibleToUsers/status
    // the caller passed straight into the `where` clause, so an anonymous caller
    // could pass ?isPublished=false and list every draft program.
    describe('M13: non-admin caller (isAdmin falsy)', () => {
        it('ignores a caller-supplied isPublished=false and forces isPublished/isVisibleToUsers to true', async () => {
            await repository.findAll({ isPublished: false, isActive: false, status: 'draft', isVisibleToUsers: false });

            const where = prisma.program.count.mock.calls[0][0].where;
            expect(where.isPublished).toBe(true);
            expect(where.isVisibleToUsers).toBe(true);
            // isActive/status are simply not applied for a non-admin caller — not
            // forced to a value, just not taken from client input.
            expect(where.isActive).toBeUndefined();
            expect(where.status).toBeUndefined();
        });

        it('forces the same public-safe where when isAdmin is explicitly false', async () => {
            await repository.findAll({ isPublished: false, isAdmin: false });

            const where = prisma.program.count.mock.calls[0][0].where;
            expect(where.isPublished).toBe(true);
            expect(where.isVisibleToUsers).toBe(true);
        });

        it('the findMany call for the actual page uses the same forced where as count', async () => {
            await repository.findAll({ isPublished: false });

            const countWhere = prisma.program.count.mock.calls[0][0].where;
            const findManyWhere = prisma.program.findMany.mock.calls[0][0].where;
            expect(findManyWhere).toEqual(countWhere);
        });
    });

    // Regression guard: the admin dashboard's programs list (services/admin-dashboard/
    // app/platform/api.ts listPlatformPrograms) calls this same public route and relies
    // on isPublished/isActive/isVisibleToUsers/status being honoured to show drafts.
    describe('M13: admin caller (isAdmin: true) keeps full filter control', () => {
        it('honours all four caller-supplied filters, including requesting drafts', async () => {
            await repository.findAll({
                isAdmin: true,
                isPublished: false,
                isActive: false,
                isVisibleToUsers: false,
                status: 'draft',
            });

            const where = prisma.program.count.mock.calls[0][0].where;
            expect(where.isPublished).toBe(false);
            expect(where.isActive).toBe(false);
            expect(where.isVisibleToUsers).toBe(false);
            expect(where.status).toBe('draft');
        });

        it('leaves the filters unset when the admin passes none, rather than forcing published/visible', async () => {
            await repository.findAll({ isAdmin: true });

            const where = prisma.program.count.mock.calls[0][0].where;
            expect(where.isPublished).toBeUndefined();
            expect(where.isVisibleToUsers).toBeUndefined();
        });
    });
});
