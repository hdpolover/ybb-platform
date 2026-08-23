import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { DeleteProgramHandler } from './delete-program.handler';
import { DeleteProgramCommand } from '../delete-program.command';
import { IProgramRepository } from '@core/interfaces/repositories/program.repository.interface';
import { IUserActivityLogRepository } from '@core/interfaces/repositories/user-activity-log.repository.interface';
import { LandingCacheInvalidationService } from '../../../../brands/application/services/landing-cache-invalidation.service';

const makeProgram = (overrides: Record<string, unknown> = {}) => ({
    id: 'prog-1',
    name: 'Test Program',
    brandId: 'brand-1',
    ...overrides,
});

describe('DeleteProgramHandler', () => {
    let handler: DeleteProgramHandler;
    let programRepository: jest.Mocked<IProgramRepository>;
    let activityLogRepository: jest.Mocked<IUserActivityLogRepository>;
    let landingCacheInvalidation: jest.Mocked<Partial<LandingCacheInvalidationService>>;

    beforeEach(async () => {
        programRepository = {
            findById: jest.fn(),
            delete: jest.fn(),
        } as any;

        activityLogRepository = {
            create: jest.fn().mockResolvedValue(undefined),
        } as any;

        landingCacheInvalidation = {
            invalidate: jest.fn().mockResolvedValue(undefined),
        };

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                DeleteProgramHandler,
                { provide: 'IProgramRepository', useValue: programRepository },
                { provide: IUserActivityLogRepository, useValue: activityLogRepository },
                { provide: LandingCacheInvalidationService, useValue: landingCacheInvalidation },
            ],
        }).compile();

        handler = module.get<DeleteProgramHandler>(DeleteProgramHandler);
    });

    it('throws NotFoundException when the program does not exist', async () => {
        programRepository.findById.mockResolvedValue(null);
        const command = new DeleteProgramCommand('nonexistent', 'user-1');

        await expect(handler.execute(command)).rejects.toThrow(NotFoundException);
        expect(programRepository.delete).not.toHaveBeenCalled();
    });

    it('deletes the program and logs activity', async () => {
        const program = makeProgram();
        programRepository.findById.mockResolvedValue(program as any);
        programRepository.delete.mockResolvedValue(undefined);

        const command = new DeleteProgramCommand('prog-1', 'user-1');
        await handler.execute(command);

        expect(programRepository.delete).toHaveBeenCalledWith('prog-1');
        expect(activityLogRepository.create).toHaveBeenCalled();
    });

    // Audit: this handler cleared Redis + the Postgres snapshot directly but
    // never fired LandingRevalidationService, so a deleted program stayed on
    // the public landing page until the cache TTL lapsed.
    it('invalidates landing caches via the shared service with the home+settings revalidate hook', async () => {
        const program = makeProgram({ brandId: 'brand-77' });
        programRepository.findById.mockResolvedValue(program as any);
        programRepository.delete.mockResolvedValue(undefined);

        const command = new DeleteProgramCommand('prog-1', 'user-1');
        await handler.execute(command);

        expect(landingCacheInvalidation.invalidate).toHaveBeenCalledWith('brand-77', {
            clearSnapshot: true,
            bustProgramCache: true,
            swallowErrors: true,
            revalidate: { kind: 'homeAndSettings' },
        });
    });
});
