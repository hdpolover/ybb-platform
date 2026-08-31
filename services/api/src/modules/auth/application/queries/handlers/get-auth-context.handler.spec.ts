// services/api/src/modules/auth/application/queries/handlers/get-auth-context.handler.spec.ts
//
// Guards the concurrent-active-programs regression: an admin publishes next
// year's program to prepare it, and every NEW registrant on that brand domain
// is silently sent to a program whose registration has not opened yet, while
// the program actually taking registrations becomes unreachable.
import { GetAuthContextHandler } from './get-auth-context.handler';
import { openRegistrationProgramQuery } from '../../../../../shared/utils/active-program-resolver';
import { PrismaService } from '../../../../../shared/infrastructure/prisma/prisma.service';

const MEYS_2026 = { id: 'p-2026', slug: 'middle-east-youth-summit-6th', requireEmailVerification: false };
const MEYS_2027 = { id: 'p-2027', slug: 'middle-east-youth-summit-7th', requireEmailVerification: false };

function mkPrisma(programFindFirst: jest.Mock): PrismaService {
    return {
        authProvider: { findMany: jest.fn().mockResolvedValue([{ id: 'local-1', name: 'local' }]) },
        brand: { findFirst: jest.fn().mockResolvedValue({ id: 'brand-meys', requireEmailVerification: true }) },
        program: { findFirst: programFindFirst },
    } as unknown as PrismaService;
}

describe('GetAuthContextHandler — concurrent active programs', () => {
    it('registers new participants into the program that is open now, not the newer future one', async () => {
        // Rule 0 matches MEYS 2026 (open until December). MEYS 2027 is also
        // published+active but does not open until September, so the old
        // `year desc` query would have returned it.
        const findFirst = jest.fn().mockResolvedValueOnce(MEYS_2026);
        const handler = new GetAuthContextHandler(mkPrisma(findFirst));

        const result = await handler.execute({ brandDomain: 'meys.com' } as any);

        expect(result.programId).toBe('p-2026');
        expect(result.programSlug).toBe('middle-east-youth-summit-6th');
        expect(findFirst).toHaveBeenCalledTimes(1);
        expect(findFirst.mock.calls[0][0].where).toEqual(
            openRegistrationProgramQuery('brand-meys', expect.any(Date) as any).where,
        );
    });

    it('falls back to the newest published+active program when no window is open', async () => {
        const findFirst = jest.fn().mockResolvedValueOnce(null).mockResolvedValueOnce(MEYS_2027);
        const handler = new GetAuthContextHandler(mkPrisma(findFirst));

        const result = await handler.execute({ brandDomain: 'meys.com' } as any);

        expect(result.programId).toBe('p-2027');
        expect(findFirst).toHaveBeenNthCalledWith(2, {
            where: {
                        brandId: 'brand-meys',
                        deletedAt: null,
                        isPublished: true,
                        isActive: true,
                        status: { not: 'draft' },
                    },
            orderBy: [{ year: 'desc' }, { createdAt: 'desc' }, { id: 'asc' }],
            select: { id: true, slug: true, requireEmailVerification: true },
        });
    });

    it('still resolves to a null program — never a rule-2 fallback — when the brand has none published+active', async () => {
        // resolveActiveProgram's rule 2 would hand back an unpublished or
        // inactive program here; that must NOT happen at the registration
        // entry point.
        const findFirst = jest.fn().mockResolvedValue(null);
        const handler = new GetAuthContextHandler(mkPrisma(findFirst));

        const result = await handler.execute({ brandDomain: 'meys.com' } as any);

        expect(result.programId).toBeNull();
        expect(result.programSlug).toBeNull();
        expect(result.requireEmailVerification).toBe(true); // brand-level fallback
        expect(findFirst).toHaveBeenCalledTimes(2);
    });
});
