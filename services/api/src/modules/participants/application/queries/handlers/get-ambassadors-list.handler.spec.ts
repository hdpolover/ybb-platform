
import { Test, TestingModule } from '@nestjs/testing';
import { GetAmbassadorsListHandler } from './get-ambassadors-list.handler';
import { PrismaService } from '../../../../../shared/infrastructure/prisma/prisma.service';
import { GetAmbassadorsListQuery } from '../../commands/ambassador-admin.commands';

describe('GetAmbassadorsListHandler', () => {
    let handler: GetAmbassadorsListHandler;
    let prismaService: any;

    const mockPrismaService = {
        ambassador: {
            findMany: jest.fn(),
            count: jest.fn(),
        },
        program: {
            findFirst: jest.fn(),
        },
    };

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [
                GetAmbassadorsListHandler,
                { provide: PrismaService, useValue: mockPrismaService },
            ],
        }).compile();

        handler = module.get<GetAmbassadorsListHandler>(GetAmbassadorsListHandler);
        prismaService = module.get<PrismaService>(PrismaService);
        
        jest.clearAllMocks();
    });

    it('should be defined', () => {
        expect(handler).toBeDefined();
    });

    it('should return paginated list of ambassadors', async () => {
        const query = new GetAmbassadorsListQuery(undefined, undefined, 1);
        
        // Mock Count
        mockPrismaService.ambassador.count.mockResolvedValue(10);
        
        // Mock Data
        const mockAmbassadors = [
            { id: '1', referralCode: 'ABC', user: { fullName: 'User 1' }, program: { name: 'Prog 1' } },
            { id: '2', referralCode: 'DEF', user: { fullName: 'User 2' }, program: { name: 'Prog 1' } },
        ];
        mockPrismaService.ambassador.findMany.mockResolvedValue(mockAmbassadors);

        const result = await handler.execute(query);

        expect(result.data).toHaveLength(2);
        expect(result.meta.total).toBe(10);
        expect(result.meta.page).toBe(1);
        expect(mockPrismaService.ambassador.findMany).toHaveBeenCalledWith(expect.objectContaining({
            skip: 0,
            take: 20,
        }));
    });

    it('should filter by programId', async () => {
        // Use a UUID-style id so the handler short-circuits the slug lookup branch
        const programUuid = '11111111-1111-1111-1111-111111111111';
        const query = new GetAmbassadorsListQuery(programUuid, undefined, 1);

        mockPrismaService.ambassador.count.mockResolvedValue(5);
        mockPrismaService.ambassador.findMany.mockResolvedValue([]);

        await handler.execute(query);

        expect(mockPrismaService.ambassador.findMany).toHaveBeenCalledWith(expect.objectContaining({
            where: expect.objectContaining({
                programId: programUuid,
            })
        }));
    });

    it('should filter by search term (referralCode or Name)', async () => {
        const query = new GetAmbassadorsListQuery(undefined, 'doe', 1);

        mockPrismaService.ambassador.count.mockResolvedValue(1);
        mockPrismaService.ambassador.findMany.mockResolvedValue([]);

        await handler.execute(query);

        const expectedWhere = mockPrismaService.ambassador.findMany.mock.calls[0][0].where;
        // Verify OR condition structure (handler searches fullName, referralCode, and user email)
        expect(expectedWhere.OR).toBeDefined();
        expect(expectedWhere.OR.length).toBeGreaterThanOrEqual(2);
    });

    // The two traps the pre-implementation map identified for this route.
    describe('programme scoping', () => {
        beforeEach(() => {
            mockPrismaService.ambassador.findMany.mockResolvedValue([]);
            mockPrismaService.ambassador.count.mockResolvedValue(0);
        });

        // THE hole. An omitted programId used to leave where.programId undefined,
        // which Prisma treats as no condition, so the DEFAULT call listed every
        // ambassador in every brand. A scoped caller must always be narrowed.
        it('narrows to the caller programmes when no programId is supplied', async () => {
            await handler.execute(new GetAmbassadorsListQuery(undefined, undefined, 1, 20, undefined, undefined, ['p1', 'p2']));

            const where = mockPrismaService.ambassador.findMany.mock.calls[0][0].where;
            expect(where.programId).toEqual({ in: ['p1', 'p2'] });
        });

        it('narrows to NOTHING, not everything, for an admin scoped to no programmes', async () => {
            await handler.execute(new GetAmbassadorsListQuery(undefined, undefined, 1, 20, undefined, undefined, []));

            const where = mockPrismaService.ambassador.findMany.mock.calls[0][0].where;
            expect(where.programId).toEqual({ in: [] });
        });

        it('leaves a platform admin unrestricted', async () => {
            await handler.execute(new GetAmbassadorsListQuery(undefined, undefined, 1, 20, undefined, undefined, null));

            const where = mockPrismaService.ambassador.findMany.mock.calls[0][0].where;
            expect(where.programId).toBeUndefined();
        });

        // The second trap: this route accepts a SLUG. Checking the raw value in
        // the controller would have rejected a legitimate slug, so the check
        // happens here, after resolution.
        it('resolves a SLUG before checking it against the caller scope', async () => {
            mockPrismaService.program.findFirst.mockResolvedValue({ id: 'prog-real' });

            await handler.execute(new GetAmbassadorsListQuery('my-program-slug', undefined, 1, 20, undefined, undefined, ['prog-real']));

            const where = mockPrismaService.ambassador.findMany.mock.calls[0][0].where;
            expect(where.programId).toBe('prog-real');
        });

        it('refuses an explicit programme outside the caller scope', async () => {
            await expect(
                handler.execute(new GetAmbassadorsListQuery('prog-other', undefined, 1, 20, undefined, undefined, ['p1'])),
            ).rejects.toThrow();
        });

        it('refuses a SLUG that resolves outside the caller scope', async () => {
            mockPrismaService.program.findFirst.mockResolvedValue({ id: 'prog-other' });

            await expect(
                handler.execute(new GetAmbassadorsListQuery('someone-elses-slug', undefined, 1, 20, undefined, undefined, ['p1'])),
            ).rejects.toThrow();
        });
    });
});

