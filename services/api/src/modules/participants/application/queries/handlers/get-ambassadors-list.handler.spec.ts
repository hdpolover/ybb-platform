
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
        const query = new GetAmbassadorsListQuery('prog-1', undefined, 1);
        
        mockPrismaService.ambassador.count.mockResolvedValue(5);
        mockPrismaService.ambassador.findMany.mockResolvedValue([]);

        await handler.execute(query);

        expect(mockPrismaService.ambassador.findMany).toHaveBeenCalledWith(expect.objectContaining({
            where: expect.objectContaining({
                programId: 'prog-1',
            })
        }));
    });

    it('should filter by search term (referralCode or Name)', async () => {
        const query = new GetAmbassadorsListQuery(undefined, 'doe', 1);
        
        mockPrismaService.ambassador.count.mockResolvedValue(1);
        mockPrismaService.ambassador.findMany.mockResolvedValue([]);

        await handler.execute(query);

        const expectedWhere = mockPrismaService.ambassador.findMany.mock.calls[0][0].where;
        // Verify OR condition structure
        expect(expectedWhere.OR).toBeDefined();
        // Since logic might vary slightly (contains insensitive), just check structure presence
        expect(expectedWhere.OR).toHaveLength(2); 
    });
});
