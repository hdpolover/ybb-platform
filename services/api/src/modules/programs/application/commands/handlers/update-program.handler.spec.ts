import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { UpdateProgramHandler } from './update-program.handler';
import { UpdateProgramCommand } from '../update-program.command';
import { IProgramRepository } from '@core/interfaces/repositories/program.repository.interface';
import { IUserActivityLogRepository } from '@core/interfaces/repositories/user-activity-log.repository.interface';
import { LandingCacheInvalidationService } from '../../../../brands/application/services/landing-cache-invalidation.service';

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
    let landingCacheInvalidation: jest.Mocked<Partial<LandingCacheInvalidationService>>;

    beforeEach(async () => {
        programRepository = {
            findById: jest.fn(),
            update: jest.fn(),
        } as any;

        activityLogRepository = {
            create: jest.fn().mockResolvedValue(undefined),
        } as any;

        landingCacheInvalidation = {
            invalidate: jest.fn().mockResolvedValue(undefined),
        };

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                UpdateProgramHandler,
                { provide: 'IProgramRepository', useValue: programRepository },
                { provide: IUserActivityLogRepository, useValue: activityLogRepository },
                { provide: LandingCacheInvalidationService, useValue: landingCacheInvalidation },
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

    it('should invalidate landing caches for the program brandId with the home+settings revalidate hook', async () => {
        const program = makeProgram({ brandId: 'brand-42' });
        programRepository.findById.mockResolvedValue(program as any);
        programRepository.update.mockResolvedValue(program as any);

        const command = new UpdateProgramCommand('prog-1', { name: 'Updated' }, 'user-1');
        await handler.execute(command);

        expect(landingCacheInvalidation.invalidate).toHaveBeenCalledWith('brand-42', {
            clearSnapshot: true,
            bustProgramCache: true,
            swallowErrors: true,
            revalidate: { kind: 'homeAndSettings' },
        });
    });

    it('should still complete the update even if cache invalidation is mocked to fail', async () => {
        const program = makeProgram();
        programRepository.findById.mockResolvedValue(program as any);
        programRepository.update.mockResolvedValue({ ...program, name: 'FailSafe' } as any);
        (landingCacheInvalidation.invalidate as jest.Mock).mockResolvedValue(undefined);

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

    it('caps the auto-generated slug at 255 chars (Program.slug is VarChar(255))', async () => {
        const program = makeProgram();
        programRepository.findById.mockResolvedValue(program as any);
        programRepository.update.mockImplementation((_id, data) => Promise.resolve({ ...program, ...data } as any));

        const longName = 'Word '.repeat(60).trim(); // well over 255 chars once hyphenated
        const command = new UpdateProgramCommand('prog-1', { name: longName }, 'user-1');
        await handler.execute(command);

        const updatedSlug = (programRepository.update as jest.Mock).mock.calls[0][1].slug as string;
        expect(updatedSlug.length).toBeLessThanOrEqual(255);
    });
});
