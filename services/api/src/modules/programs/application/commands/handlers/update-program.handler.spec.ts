import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { UpdateProgramHandler } from './update-program.handler';
import { UpdateProgramCommand } from '../update-program.command';
import { IProgramRepository } from '@core/interfaces/repositories/program.repository.interface';
import { IUserActivityLogRepository } from '@core/interfaces/repositories/user-activity-log.repository.interface';
import { CacheService } from '../../../../../shared/infrastructure/cache/cache.service';
import { PrismaService } from '../../../../../shared/infrastructure/prisma/prisma.service';
import { LandingRevalidationService } from '../../../../brands/application/services/landing-revalidation.service';

const makeProgram = (overrides: Record<string, unknown> = {}) => ({
    id: 'prog-1',
    name: 'Test Program',
    brandId: 'brand-1',
    slug: 'test-program',
    ...overrides,
});

describe('UpdateProgramHandler', () => {
    let handler: UpdateProgramHandler;
    let programRepository: jest.Mocked<IProgramRepository>;
    let activityLogRepository: jest.Mocked<IUserActivityLogRepository>;
    let cacheService: jest.Mocked<Partial<CacheService>>;
    let prismaService: jest.Mocked<Partial<PrismaService>>;
    let landingRevalidation: jest.Mocked<Partial<LandingRevalidationService>>;

    beforeEach(async () => {
        programRepository = {
            findById: jest.fn(),
            update: jest.fn(),
        } as any;

        activityLogRepository = {
            create: jest.fn().mockResolvedValue(undefined),
        } as any;

        cacheService = {
            invalidateBrandLandingCaches: jest.fn().mockResolvedValue(undefined),
            invalidateByPattern: jest.fn().mockResolvedValue(undefined),
        };

        prismaService = {
            brandLandingSnapshot: {
                deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
            } as any,
        };

        landingRevalidation = {
            revalidateHomeAndSettingsForBrand: jest.fn().mockResolvedValue(undefined),
        };

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                UpdateProgramHandler,
                { provide: 'IProgramRepository', useValue: programRepository },
                { provide: IUserActivityLogRepository, useValue: activityLogRepository },
                { provide: CacheService, useValue: cacheService },
                { provide: PrismaService, useValue: prismaService },
                { provide: LandingRevalidationService, useValue: landingRevalidation },
            ],
        }).compile();

        handler = module.get<UpdateProgramHandler>(UpdateProgramHandler);
    });

    it('should throw NotFoundException when program does not exist', async () => {
        programRepository.findById.mockResolvedValue(null);
        const command = new UpdateProgramCommand('nonexistent', { name: 'Updated' }, 'user-1');

        await expect(handler.execute(command)).rejects.toThrow(NotFoundException);
    });

    it('should update the program and return result', async () => {
        const program = makeProgram();
        programRepository.findById.mockResolvedValue(program as any);
        programRepository.update.mockResolvedValue({ ...program, name: 'Updated' } as any);

        const command = new UpdateProgramCommand('prog-1', { name: 'Updated' }, 'user-1');
        const result = await handler.execute(command);

        expect(programRepository.update).toHaveBeenCalledWith('prog-1', expect.objectContaining({ name: 'Updated' }));
        expect(result.name).toBe('Updated');
    });

    it('should call revalidateHomeAndSettingsForBrand with the program brandId', async () => {
        const program = makeProgram({ brandId: 'brand-42' });
        programRepository.findById.mockResolvedValue(program as any);
        programRepository.update.mockResolvedValue(program as any);

        const command = new UpdateProgramCommand('prog-1', { name: 'Updated' }, 'user-1');
        await handler.execute(command);

        expect(landingRevalidation.revalidateHomeAndSettingsForBrand).toHaveBeenCalledWith('brand-42');
    });

    it('should still complete the update even if revalidation is mocked to fail', async () => {
        const program = makeProgram();
        programRepository.findById.mockResolvedValue(program as any);
        programRepository.update.mockResolvedValue({ ...program, name: 'FailSafe' } as any);
        (landingRevalidation.revalidateHomeAndSettingsForBrand as jest.Mock).mockResolvedValue(undefined);

        const command = new UpdateProgramCommand('prog-1', { name: 'FailSafe' }, 'user-1');
        const result = await handler.execute(command);

        expect(result.name).toBe('FailSafe');
    });

    it('should generate a slug from name when slug is not provided', async () => {
        const program = makeProgram();
        programRepository.findById.mockResolvedValue(program as any);
        programRepository.update.mockResolvedValue({ ...program, name: 'Hello World', slug: 'hello-world' } as any);

        const command = new UpdateProgramCommand('prog-1', { name: 'Hello World' }, 'user-1');
        await handler.execute(command);

        expect(programRepository.update).toHaveBeenCalledWith(
            'prog-1',
            expect.objectContaining({ slug: 'hello-world' }),
        );
    });
});
