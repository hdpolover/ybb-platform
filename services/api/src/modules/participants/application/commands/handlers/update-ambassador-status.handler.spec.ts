
import { Test, TestingModule } from '@nestjs/testing';
import { UpdateAmbassadorStatusHandler } from './update-ambassador-status.handler';
import { PrismaService } from '../../../../../shared/infrastructure/prisma/prisma.service';
import { UpdateAmbassadorStatusCommand } from '../ambassador-admin.commands';
import { NotFoundException } from '@nestjs/common';

describe('UpdateAmbassadorStatusHandler', () => {
    let handler: UpdateAmbassadorStatusHandler;
    let prismaService: any;

    const mockPrismaService = {
        ambassador: {
            findUnique: jest.fn(),
            update: jest.fn(),
        },
    };

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [
                UpdateAmbassadorStatusHandler,
                { provide: PrismaService, useValue: mockPrismaService },
            ],
        }).compile();

        handler = module.get<UpdateAmbassadorStatusHandler>(UpdateAmbassadorStatusHandler);
        prismaService = module.get<PrismaService>(PrismaService);
        
        jest.clearAllMocks();
    });

    it('should be defined', () => {
        expect(handler).toBeDefined();
    });

    it('should update ambassador status successfully (activate)', async () => {
        const command = new UpdateAmbassadorStatusCommand('amb-1', true);
        
        mockPrismaService.ambassador.findUnique.mockResolvedValue({ id: 'amb-1' });
        mockPrismaService.ambassador.update.mockResolvedValue({ id: 'amb-1', isActive: true });

        await handler.execute(command);

        expect(mockPrismaService.ambassador.update).toHaveBeenCalledWith({
            where: { id: 'amb-1' },
            data: { 
                isActive: true,
                activatedAt: expect.any(Date),
                deactivatedAt: null 
            },
        });
    });

    it('should update ambassador status successfully (deactivate)', async () => {
        const command = new UpdateAmbassadorStatusCommand('amb-1', false);
        
        mockPrismaService.ambassador.findUnique.mockResolvedValue({ id: 'amb-1' });
        mockPrismaService.ambassador.update.mockResolvedValue({ id: 'amb-1', isActive: false });

        await handler.execute(command);

        expect(mockPrismaService.ambassador.update).toHaveBeenCalledWith({
            where: { id: 'amb-1' },
            data: { 
                isActive: false,
                deactivatedAt: expect.any(Date)
            },
        });
    });

    it('should throw NotFoundException if ambassador does not exist', async () => {
        const command = new UpdateAmbassadorStatusCommand('unknown', false);
        mockPrismaService.ambassador.findUnique.mockResolvedValue(null);

        await expect(handler.execute(command)).rejects.toThrow(NotFoundException);
    });
});
