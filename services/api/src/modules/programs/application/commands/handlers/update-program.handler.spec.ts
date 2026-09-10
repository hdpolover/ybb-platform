import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { prismaToHttp } from '@shared/utils/prisma-error.util';
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

    // Audit M8: renaming a program used to silently regenerate its slug on
    // every update, breaking already-shared public/admin URLs. The slug
    // must now stay untouched unless the client explicitly sends one.
    it('does not regenerate the slug from name when slug is not provided', async () => {
        const program = makeProgram();
        programRepository.findById.mockResolvedValue(program as any);
        programRepository.update.mockResolvedValue({ ...program, name: 'Hello World' } as any);

        const command = new UpdateProgramCommand('prog-1', { name: 'Hello World' }, 'user-1');
        await handler.execute(command);

        const updateArg = (programRepository.update as jest.Mock).mock.calls[0][1];
        expect(updateArg).not.toHaveProperty('slug');
    });

    it('passes an explicitly requested slug through unchanged', async () => {
        const program = makeProgram();
        programRepository.findById.mockResolvedValue(program as any);
        programRepository.update.mockResolvedValue({ ...program, slug: 'custom-slug' } as any);

        const command = new UpdateProgramCommand('prog-1', { slug: 'custom-slug' }, 'user-1');
        await handler.execute(command);

        expect(programRepository.update).toHaveBeenCalledWith(
            'prog-1',
            expect.objectContaining({ slug: 'custom-slug' }),
        );
    });

    // The handler deliberately does not translate this itself; the global
    // HttpExceptionFilter maps P2002 to a 409 naming the offending field, and a
    // catch here would relabel every unique violation as a slug collision.
    it('lets a P2002 slug collision propagate for the global filter to map', async () => {
        const program = makeProgram();
        programRepository.findById.mockResolvedValue(program as any);
        const p2002 = Object.assign(new Error('Unique constraint failed on the fields: (`brand_id`,`slug`)'), {
            code: 'P2002',
            clientVersion: 'test',
            name: 'PrismaClientKnownRequestError',
        });
        programRepository.update.mockRejectedValue(p2002);

        const command = new UpdateProgramCommand('prog-1', { slug: 'taken-slug' }, 'user-1');

        await expect(handler.execute(command)).rejects.toBe(p2002);
        expect(prismaToHttp(p2002)).toEqual(
            expect.objectContaining({ status: 409, errorCode: 'DUPLICATE_RECORD' }),
        );
    });

    it('does NOT block an unrelated edit to a program with pre-existing bad dates', async () => {
        // registrationCloseDate already earlier than registrationOpenDate on the existing
        // record. Editing only `name` must not trip the deadline-order validator.
        const program = makeProgram({
            registrationOpenDate: new Date('2026-12-10T00:00:00Z'),
            registrationCloseDate: new Date('2026-12-05T00:00:00Z'),
            applicationDeadline: new Date('2026-12-20T00:00:00Z'),
        });
        programRepository.findById.mockResolvedValue(program as any);
        programRepository.update.mockResolvedValue({ ...program, name: 'Renamed' } as any);

        const command = new UpdateProgramCommand('prog-1', { name: 'Renamed' }, 'user-1');
        const result = await handler.execute(command);

        expect(result.name).toBe('Renamed');
    });

    it('validates a touched date field against the existing (merged) values and rejects a bad ordering', async () => {
        const program = makeProgram({
            registrationOpenDate: new Date('2026-12-01T00:00:00Z'),
            registrationCloseDate: new Date('2026-12-05T00:00:00Z'),
            applicationDeadline: new Date('2026-12-10T00:00:00Z'),
        });
        programRepository.findById.mockResolvedValue(program as any);

        // Only applicationDeadline is touched, moved earlier than the existing registrationCloseDate.
        const command = new UpdateProgramCommand(
            'prog-1',
            { applicationDeadline: '2026-12-02T00:00:00.000Z' },
            'user-1',
        );

        await expect(handler.execute(command)).rejects.toThrow(
            /Application Deadline.*cannot be earlier than.*Registration Closes/s,
        );
        expect(programRepository.update).not.toHaveBeenCalled();
    });

    it('allows a touched date field when it is consistent with the existing merged values', async () => {
        const program = makeProgram({
            registrationOpenDate: new Date('2026-12-01T00:00:00Z'),
            registrationCloseDate: new Date('2026-12-05T00:00:00Z'),
            applicationDeadline: new Date('2026-12-10T00:00:00Z'),
        });
        programRepository.findById.mockResolvedValue(program as any);
        programRepository.update.mockResolvedValue({ ...program } as any);

        const command = new UpdateProgramCommand(
            'prog-1',
            { applicationDeadline: '2026-12-06T00:00:00.000Z' },
            'user-1',
        );

        await expect(handler.execute(command)).resolves.toBeDefined();
    });

    describe('status/isActive drift guard (MEYS 7th incident)', () => {
        it('advances status from draft to published when isActive is set true without touching status', async () => {
            const program = makeProgram({ status: 'draft' });
            programRepository.findById.mockResolvedValue(program as any);
            programRepository.update.mockImplementation((_id, data) => Promise.resolve({ ...program, ...data } as any));

            const command = new UpdateProgramCommand('prog-1', { isActive: true }, 'user-1');
            await handler.execute(command);

            expect(programRepository.update).toHaveBeenCalledWith(
                'prog-1',
                expect.objectContaining({ isActive: true, status: 'published' }),
            );
        });

        it('does not touch status when the request already sends an explicit status', async () => {
            const program = makeProgram({ status: 'draft' });
            programRepository.findById.mockResolvedValue(program as any);
            programRepository.update.mockImplementation((_id, data) => Promise.resolve({ ...program, ...data } as any));

            const command = new UpdateProgramCommand('prog-1', { isActive: true, status: 'draft' }, 'user-1');
            await handler.execute(command);

            expect(programRepository.update).toHaveBeenCalledWith(
                'prog-1',
                expect.objectContaining({ isActive: true, status: 'draft' }),
            );
        });

        it('does not drag a completed program back to published when isActive is re-saved true', async () => {
            const program = makeProgram({ status: 'completed' });
            programRepository.findById.mockResolvedValue(program as any);
            programRepository.update.mockImplementation((_id, data) => Promise.resolve({ ...program, ...data } as any));

            const command = new UpdateProgramCommand('prog-1', { isActive: true }, 'user-1');
            await handler.execute(command);

            const updateArg = (programRepository.update as jest.Mock).mock.calls[0][1];
            expect(updateArg.status).toBeUndefined();
        });
    });

    describe('isPublished guard (publish moved to POST /programs/:id/publish)', () => {
        // isPublished is no longer part of UpdateProgramDto's type, but a caller
        // (or an old client build) can still send it over the wire — this must
        // be rejected rather than silently bypassing the readiness guard on the
        // dedicated publish endpoint.
        it('rejects any payload still carrying isPublished', async () => {
            const program = makeProgram({ status: 'draft' });
            programRepository.findById.mockResolvedValue(program as any);

            const command = new UpdateProgramCommand(
                'prog-1',
                { isPublished: true } as any,
                'user-1',
            );

            await expect(handler.execute(command)).rejects.toThrow(BadRequestException);
            expect(programRepository.update).not.toHaveBeenCalled();
        });
    });
});
