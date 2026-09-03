import { Test } from '@nestjs/testing';
import { BadRequestException, ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import {
  CreateLoaBatchHandler,
  UpdateLoaBatchHandler,
  ReleaseLoaBatchHandler,
  UnreleaseLoaBatchHandler,
  DeleteLoaBatchHandler,
  GetLoaBatchesHandler,
  GetLoaDownloadsHandler,
} from './loa-batch.handlers';
import { LoaReleaseBatchRepository } from '../../infrastructure/persistence/loa-release-batch.repository';
import { LoaBatchRecipientSendRepository } from '../../infrastructure/persistence/loa-batch-recipient-send.repository';
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service';
import { PrismaReadService } from '@shared/infrastructure/prisma/prisma-read.service';
import { RabbitMQProducerService } from '@shared/infrastructure/rabbitmq/rabbitmq-producer.service';

const mockBatch = {
  id: 'batch-1',
  programId: 'prog-1',
  name: 'Wave 1',
  submissionFrom: new Date('2026-01-01'),
  submissionTo: new Date('2026-03-31'),
  releasedAt: null,
  createdBy: 'admin-1',
  createdAt: new Date(),
  updatedAt: new Date(),
  deletedAt: null,
};

// 'prog-1' throughout this file is NOT a valid UUID shape, so resolveProgramId()
// in loa-batch.handlers.ts treats it as a slug and routes it through
// programRepository.findBySlug(). Every describe block below provides that
// mock resolving 'prog-1' -> itself, so the pre-existing assertions on
// mockRepo calls with the literal 'prog-1' stay valid unchanged.
const platformAdmin = {
  accessLevel: 5,
  canManageAdmins: true,
  canAssignRoles: true,
  customPermissions: [],
  role: { name: 'super_admin', permissions: ['platform_access'] },
  adminBrands: [],
  adminPrograms: [],
};
const assignedAdminFor = (programIds: string[]) => ({
  accessLevel: 1,
  canManageAdmins: false,
  canAssignRoles: false,
  customPermissions: [],
  role: { name: 'reviewer', permissions: [] },
  adminBrands: [],
  adminPrograms: programIds.map((programId) => ({ programId, permissions: [] })),
});
const actor = { userId: 'admin-1', email: 'a@b.c', brandId: 'brand-x', adminId: 'adm-1' } as any;

function mockProgramRepo(resolvedId = 'prog-1') {
  return { findBySlug: jest.fn().mockResolvedValue({ id: resolvedId }) };
}

function mockPrismaRead(admin: unknown = platformAdmin, programId = 'prog-1') {
  return {
    admin: { findUnique: jest.fn().mockResolvedValue(admin) },
    program: {
      findUnique: jest.fn().mockResolvedValue({ id: programId, brandId: 'brand-x', name: 'P', deletedAt: null }),
    },
  };
}

describe('CreateLoaBatchHandler', () => {
  let handler: CreateLoaBatchHandler;
  let mockRepo: jest.Mocked<LoaReleaseBatchRepository>;
  let mockProgramRepository: any;
  let mockReadPrisma: any;

  beforeEach(async () => {
    mockProgramRepository = mockProgramRepo();
    mockReadPrisma = mockPrismaRead();
    const module = await Test.createTestingModule({
      providers: [
        CreateLoaBatchHandler,
        {
          provide: LoaReleaseBatchRepository,
          useValue: {
            findOverlapping: jest.fn(),
            create: jest.fn(),
          },
        },
        { provide: 'IProgramRepository', useValue: mockProgramRepository },
        { provide: PrismaReadService, useValue: mockReadPrisma },
      ],
    }).compile();
    handler = module.get(CreateLoaBatchHandler);
    mockRepo = module.get(LoaReleaseBatchRepository);
  });

  it('creates a batch when no overlap exists', async () => {
    mockRepo.findOverlapping.mockResolvedValue([]);
    mockRepo.create.mockResolvedValue({ ...mockBatch });
    const { CreateLoaBatchCommand } = await import('../commands/loa-batch.commands');
    const result = await handler.execute(
      new CreateLoaBatchCommand('prog-1', 'Wave 1', new Date('2026-01-01'), new Date('2026-03-31'), 'admin-1', actor),
    );
    expect(result.name).toBe('Wave 1');
    // The handler normalizes the range to whole WIB days (startOfWibDay/endOfWibDay),
    // so an end date of 2026-03-31 covers that entire WIB day rather than its UTC
    // midnight boundary. Assert the normalized values the repository actually receives.
    const submissionFrom = new Date('2025-12-31T17:00:00.000Z');
    const submissionTo = new Date('2026-03-31T16:59:59.999Z');
    expect(mockRepo.findOverlapping).toHaveBeenCalledWith('prog-1', submissionFrom, submissionTo);
    expect(mockRepo.create).toHaveBeenCalledWith({
      programId: 'prog-1',
      name: 'Wave 1',
      submissionFrom,
      submissionTo,
      createdBy: 'admin-1',
    });
  });

  it('throws ConflictException when batch ranges overlap', async () => {
    mockRepo.findOverlapping.mockResolvedValue([{ ...mockBatch, id: 'existing', name: 'Existing' } as any]);
    const { CreateLoaBatchCommand } = await import('../commands/loa-batch.commands');
    await expect(
      handler.execute(
        new CreateLoaBatchCommand('prog-1', 'Wave 2', new Date('2026-02-01'), new Date('2026-04-30'), 'admin-1', actor),
      ),
    ).rejects.toThrow(ConflictException);
  });

  it('throws BadRequestException when submissionFrom is after submissionTo', async () => {
    mockRepo.findOverlapping.mockResolvedValue([]);
    const { CreateLoaBatchCommand } = await import('../commands/loa-batch.commands');
    await expect(
      handler.execute(
        new CreateLoaBatchCommand('prog-1', 'Bad Range', new Date('2026-06-01'), new Date('2026-01-01'), 'admin-1', actor),
      ),
    ).rejects.toThrow(BadRequestException);
    expect(mockRepo.create).not.toHaveBeenCalled();
  });

  it('refuses a programme-scoped admin outside their assigned programmes', async () => {
    mockReadPrisma.admin.findUnique.mockResolvedValue(assignedAdminFor(['someone-elses-program']));
    const { CreateLoaBatchCommand } = await import('../commands/loa-batch.commands');
    await expect(
      handler.execute(
        new CreateLoaBatchCommand('prog-1', 'Wave 1', new Date('2026-01-01'), new Date('2026-03-31'), 'admin-1', actor),
      ),
    ).rejects.toThrow(ForbiddenException);
    expect(mockRepo.create).not.toHaveBeenCalled();
  });

  it('lets an in-scope programme-assigned admin create a batch', async () => {
    mockReadPrisma.admin.findUnique.mockResolvedValue(assignedAdminFor(['prog-1']));
    mockRepo.findOverlapping.mockResolvedValue([]);
    mockRepo.create.mockResolvedValue({ ...mockBatch });
    const { CreateLoaBatchCommand } = await import('../commands/loa-batch.commands');
    await expect(
      handler.execute(
        new CreateLoaBatchCommand('prog-1', 'Wave 1', new Date('2026-01-01'), new Date('2026-03-31'), 'admin-1', actor),
      ),
    ).resolves.toBeDefined();
    expect(mockRepo.create).toHaveBeenCalled();
  });
});

describe('UpdateLoaBatchHandler', () => {
  let handler: UpdateLoaBatchHandler;
  let mockRepo: jest.Mocked<LoaReleaseBatchRepository>;
  let mockReadPrisma: any;

  beforeEach(async () => {
    mockReadPrisma = mockPrismaRead();
    const module = await Test.createTestingModule({
      providers: [
        UpdateLoaBatchHandler,
        {
          provide: LoaReleaseBatchRepository,
          useValue: {
            findById: jest.fn(),
            findOverlapping: jest.fn(),
            update: jest.fn(),
          },
        },
        { provide: 'IProgramRepository', useValue: mockProgramRepo() },
        { provide: PrismaReadService, useValue: mockReadPrisma },
      ],
    }).compile();
    handler = module.get(UpdateLoaBatchHandler);
    mockRepo = module.get(LoaReleaseBatchRepository);
  });

  it('updates a batch when no overlap exists', async () => {
    mockRepo.findById.mockResolvedValue({ ...mockBatch });
    mockRepo.findOverlapping.mockResolvedValue([]);
    mockRepo.update.mockResolvedValue({ ...mockBatch, name: 'Updated Wave 1' });
    const { UpdateLoaBatchCommand } = await import('../commands/loa-batch.commands');
    const result = await handler.execute(
      new UpdateLoaBatchCommand('batch-1', 'prog-1', actor, 'Updated Wave 1'),
    );
    expect(result.name).toBe('Updated Wave 1');
    expect(mockRepo.findOverlapping).toHaveBeenCalledWith(
      'prog-1',
      mockBatch.submissionFrom,
      mockBatch.submissionTo,
      'batch-1',
    );
  });

  it('throws NotFoundException for unknown batch', async () => {
    mockRepo.findById.mockResolvedValue(null);
    const { UpdateLoaBatchCommand } = await import('../commands/loa-batch.commands');
    await expect(
      handler.execute(new UpdateLoaBatchCommand('bad-id', 'prog-1', actor, 'New Name')),
    ).rejects.toThrow(NotFoundException);
  });

  it('throws ConflictException when update causes overlap', async () => {
    mockRepo.findById.mockResolvedValue({ ...mockBatch });
    mockRepo.findOverlapping.mockResolvedValue([{ ...mockBatch, id: 'other-batch', name: 'Other Wave' } as any]);
    const { UpdateLoaBatchCommand } = await import('../commands/loa-batch.commands');
    await expect(
      handler.execute(new UpdateLoaBatchCommand('batch-1', 'prog-1', actor, undefined, new Date('2026-02-01'), new Date('2026-05-31'))),
    ).rejects.toThrow(ConflictException);
  });

  it('throws BadRequestException when effective submissionFrom is after submissionTo', async () => {
    mockRepo.findById.mockResolvedValue({ ...mockBatch });
    mockRepo.findOverlapping.mockResolvedValue([]);
    const { UpdateLoaBatchCommand } = await import('../commands/loa-batch.commands');
    // Passing a new submissionFrom that is after the existing submissionTo
    await expect(
      handler.execute(new UpdateLoaBatchCommand('batch-1', 'prog-1', actor, undefined, new Date('2026-12-01'), new Date('2026-01-01'))),
    ).rejects.toThrow(BadRequestException);
    expect(mockRepo.update).not.toHaveBeenCalled();
  });

  it('refuses a programme-scoped admin outside their assigned programmes, BEFORE touching the batch repo', async () => {
    mockReadPrisma.admin.findUnique.mockResolvedValue(assignedAdminFor(['someone-elses-program']));
    const { UpdateLoaBatchCommand } = await import('../commands/loa-batch.commands');
    await expect(
      handler.execute(new UpdateLoaBatchCommand('batch-1', 'prog-1', actor, 'New Name')),
    ).rejects.toThrow(ForbiddenException);
    expect(mockRepo.findById).not.toHaveBeenCalled();
    expect(mockRepo.update).not.toHaveBeenCalled();
  });
});

describe('ReleaseLoaBatchHandler', () => {
  let handler: ReleaseLoaBatchHandler;
  let mockRepo: jest.Mocked<LoaReleaseBatchRepository>;
  let mockPrisma: any;
  let mockProducer: any;
  let mockUserNotificationRepo: any;
  let mockRecipientSendRepo: any;
  let mockReadPrisma: any;

  const releasedBatch = { ...mockBatch, releasedAt: new Date('2026-07-01') };
  const recipient = {
    participantId: 'participant-1',
    userId: 'user-1',
    email: 'jane@example.com',
    fullName: 'Jane Doe',
  };

  beforeEach(async () => {
    const { IUserNotificationRepository } = await import(
      '@core/interfaces/repositories/user-notification.repository.interface'
    );

    mockReadPrisma = mockPrismaRead();
    const module = await Test.createTestingModule({
      providers: [
        ReleaseLoaBatchHandler,
        {
          provide: LoaReleaseBatchRepository,
          useValue: {
            findById: jest.fn(),
            release: jest.fn(),
            findEligibleRecipients: jest.fn(),
          },
        },
        {
          provide: PrismaService,
          useValue: {
            program: { findUnique: jest.fn() },
          },
        },
        {
          provide: RabbitMQProducerService,
          useValue: { emit: jest.fn().mockResolvedValue(true) },
        },
        {
          provide: LoaBatchRecipientSendRepository,
          useValue: { markPending: jest.fn().mockResolvedValue(undefined) },
        },
        {
          provide: IUserNotificationRepository,
          useValue: { create: jest.fn().mockResolvedValue(undefined) },
        },
        { provide: 'IProgramRepository', useValue: mockProgramRepo() },
        { provide: PrismaReadService, useValue: mockReadPrisma },
      ],
    }).compile();
    handler = module.get(ReleaseLoaBatchHandler);
    mockRepo = module.get(LoaReleaseBatchRepository);
    mockPrisma = module.get(PrismaService);
    mockProducer = module.get(RabbitMQProducerService);
    mockUserNotificationRepo = module.get(IUserNotificationRepository);
    mockRecipientSendRepo = module.get(LoaBatchRecipientSendRepository);
  });

  it('releases the batch', async () => {
    mockRepo.findById.mockResolvedValue({ ...mockBatch });
    mockRepo.release.mockResolvedValue({ batch: releasedBatch, transitioned: true });
    mockRepo.findEligibleRecipients.mockResolvedValue([]);
    const { ReleaseLoaBatchCommand } = await import('../commands/loa-batch.commands');
    await handler.execute(new ReleaseLoaBatchCommand('batch-1', 'prog-1', actor));
    expect(mockRepo.release).toHaveBeenCalledWith('batch-1');
  });

  it('throws NotFoundException for unknown batch', async () => {
    mockRepo.findById.mockResolvedValue(null);
    const { ReleaseLoaBatchCommand } = await import('../commands/loa-batch.commands');
    await expect(handler.execute(new ReleaseLoaBatchCommand('bad-id', 'prog-1', actor))).rejects.toThrow(NotFoundException);
    // `rejects.toThrow` only proves the exception fired, not that the mutation
    // was skipped -- release() is a bare jest.fn() that resolves undefined
    // without throwing, so this must be asserted separately. Firing release()
    // for a foreign/unknown batch id would trigger the notify-eligible-recipients
    // pipeline (in-app notifications + loa.batch.released event) irreversibly,
    // even though the caller still sees a 404. Template: cancel-portal-payment.handler.spec.ts.
    expect(mockRepo.release).not.toHaveBeenCalled();
  });

  it('refuses a programme-scoped admin outside their assigned programmes, BEFORE releasing', async () => {
    mockReadPrisma.admin.findUnique.mockResolvedValue(assignedAdminFor(['someone-elses-program']));
    const { ReleaseLoaBatchCommand } = await import('../commands/loa-batch.commands');
    await expect(handler.execute(new ReleaseLoaBatchCommand('batch-1', 'prog-1', actor))).rejects.toThrow(ForbiddenException);
    expect(mockRepo.findById).not.toHaveBeenCalled();
    expect(mockRepo.release).not.toHaveBeenCalled();
  });

  it('on a real release, creates an in-app notification per eligible recipient and emits loa.batch.released', async () => {
    mockRepo.findById.mockResolvedValue({ ...mockBatch });
    mockRepo.release.mockResolvedValue({ batch: releasedBatch, transitioned: true });
    mockRepo.findEligibleRecipients.mockResolvedValue([recipient]);
    mockPrisma.program.findUnique.mockResolvedValue({
      name: 'YBB Summit 2026',
      brand: { name: 'YBB', websiteUrl: 'https://ybbfoundation.com' },
    });

    const { ReleaseLoaBatchCommand } = await import('../commands/loa-batch.commands');
    await handler.execute(new ReleaseLoaBatchCommand('batch-1', 'prog-1', actor));

    expect(mockRepo.findEligibleRecipients).toHaveBeenCalledWith(
      'prog-1',
      mockBatch.submissionFrom,
      mockBatch.submissionTo,
    );
    expect(mockPrisma.program.findUnique).toHaveBeenCalledWith({
      where: { id: 'prog-1' },
      select: { name: true, brand: { select: { name: true, websiteUrl: true } } },
    });
    expect(mockUserNotificationRepo.create).toHaveBeenCalledTimes(1);
    expect(mockProducer.emit).toHaveBeenCalledWith('loa.batch.released', {
      batchId: 'batch-1',
      programId: 'prog-1',
      programName: 'YBB Summit 2026',
      batchName: 'Wave 1',
      recipients: [recipient],
      brand: { name: 'YBB', websiteUrl: 'https://ybbfoundation.com' },
    });
  });

  it('emits brand: null when the program has no brand relation loaded', async () => {
    mockRepo.findById.mockResolvedValue({ ...mockBatch });
    mockRepo.release.mockResolvedValue({ batch: releasedBatch, transitioned: true });
    mockRepo.findEligibleRecipients.mockResolvedValue([recipient]);
    mockPrisma.program.findUnique.mockResolvedValue({ name: 'YBB Summit 2026', brand: null });

    const { ReleaseLoaBatchCommand } = await import('../commands/loa-batch.commands');
    await handler.execute(new ReleaseLoaBatchCommand('batch-1', 'prog-1', actor));

    expect(mockProducer.emit).toHaveBeenCalledWith(
      'loa.batch.released',
      expect.objectContaining({ brand: null }),
    );
  });

  it('records a pending send row per recipient BEFORE publishing loa.batch.released', async () => {
    mockRepo.findById.mockResolvedValue({ ...mockBatch });
    mockRepo.release.mockResolvedValue({ batch: releasedBatch, transitioned: true });
    mockRepo.findEligibleRecipients.mockResolvedValue([recipient]);
    mockPrisma.program.findUnique.mockResolvedValue({ name: 'YBB Summit 2026', brand: null });

    const order: string[] = [];
    mockRecipientSendRepo.markPending.mockImplementation(async () => {
      order.push('markPending');
    });
    mockProducer.emit.mockImplementation(async () => {
      order.push('emit');
      return true;
    });

    const { ReleaseLoaBatchCommand } = await import('../commands/loa-batch.commands');
    await handler.execute(new ReleaseLoaBatchCommand('batch-1', 'prog-1', actor));

    expect(mockRecipientSendRepo.markPending).toHaveBeenCalledWith('batch-1', 'prog-1', [recipient]);
    // Ordering is the whole point: rows written first means "who was supposed
    // to get this" survives a publish failure or a dead notification service.
    expect(order).toEqual(['markPending', 'emit']);
  });

  it('still emits loa.batch.released when writing the send log fails — logging must not break sending', async () => {
    mockRepo.findById.mockResolvedValue({ ...mockBatch });
    mockRepo.release.mockResolvedValue({ batch: releasedBatch, transitioned: true });
    mockRepo.findEligibleRecipients.mockResolvedValue([recipient]);
    mockPrisma.program.findUnique.mockResolvedValue({ name: 'YBB Summit 2026', brand: null });
    mockRecipientSendRepo.markPending.mockRejectedValue(new Error('table missing'));

    const { ReleaseLoaBatchCommand } = await import('../commands/loa-batch.commands');
    await expect(
      handler.execute(new ReleaseLoaBatchCommand('batch-1', 'prog-1', actor)),
    ).resolves.toEqual(releasedBatch);

    expect(mockProducer.emit).toHaveBeenCalledWith(
      'loa.batch.released',
      expect.objectContaining({ batchId: 'batch-1' }),
    );
  });

  it('does not write send rows when the batch has no eligible recipients', async () => {
    mockRepo.findById.mockResolvedValue({ ...mockBatch });
    mockRepo.release.mockResolvedValue({ batch: releasedBatch, transitioned: true });
    mockRepo.findEligibleRecipients.mockResolvedValue([]);

    const { ReleaseLoaBatchCommand } = await import('../commands/loa-batch.commands');
    await handler.execute(new ReleaseLoaBatchCommand('batch-1', 'prog-1', actor));

    expect(mockRecipientSendRepo.markPending).not.toHaveBeenCalled();
  });

  it('does NOT re-notify when re-releasing an already-released batch (idempotent)', async () => {
    mockRepo.findById.mockResolvedValue({ ...releasedBatch });
    mockRepo.release.mockResolvedValue({ batch: releasedBatch, transitioned: false });

    const { ReleaseLoaBatchCommand } = await import('../commands/loa-batch.commands');
    await handler.execute(new ReleaseLoaBatchCommand('batch-1', 'prog-1', actor));

    expect(mockRepo.findEligibleRecipients).not.toHaveBeenCalled();
    expect(mockUserNotificationRepo.create).not.toHaveBeenCalled();
    expect(mockProducer.emit).not.toHaveBeenCalled();
  });

  it('skips notification entirely when there are zero eligible recipients', async () => {
    mockRepo.findById.mockResolvedValue({ ...mockBatch });
    mockRepo.release.mockResolvedValue({ batch: releasedBatch, transitioned: true });
    mockRepo.findEligibleRecipients.mockResolvedValue([]);

    const { ReleaseLoaBatchCommand } = await import('../commands/loa-batch.commands');
    await handler.execute(new ReleaseLoaBatchCommand('batch-1', 'prog-1', actor));

    expect(mockUserNotificationRepo.create).not.toHaveBeenCalled();
    expect(mockProducer.emit).not.toHaveBeenCalled();
  });

  it('does not let a notify-pipeline failure surface as a thrown error (release already committed)', async () => {
    mockRepo.findById.mockResolvedValue({ ...mockBatch });
    mockRepo.release.mockResolvedValue({ batch: releasedBatch, transitioned: true });
    mockRepo.findEligibleRecipients.mockRejectedValue(new Error('db exploded'));

    const { ReleaseLoaBatchCommand } = await import('../commands/loa-batch.commands');
    const result = await handler.execute(new ReleaseLoaBatchCommand('batch-1', 'prog-1', actor));

    expect(result).toEqual(releasedBatch);
  });
});

describe('UnreleaseLoaBatchHandler', () => {
  let handler: UnreleaseLoaBatchHandler;
  let mockRepo: jest.Mocked<LoaReleaseBatchRepository>;
  let mockReadPrisma: any;

  beforeEach(async () => {
    mockReadPrisma = mockPrismaRead();
    const module = await Test.createTestingModule({
      providers: [
        UnreleaseLoaBatchHandler,
        {
          provide: LoaReleaseBatchRepository,
          useValue: { findById: jest.fn(), unrelease: jest.fn() },
        },
        { provide: 'IProgramRepository', useValue: mockProgramRepo() },
        { provide: PrismaReadService, useValue: mockReadPrisma },
      ],
    }).compile();
    handler = module.get(UnreleaseLoaBatchHandler);
    mockRepo = module.get(LoaReleaseBatchRepository);
  });

  it('unreleases the batch', async () => {
    mockRepo.findById.mockResolvedValue({ ...mockBatch, releasedAt: new Date() });
    mockRepo.unrelease.mockResolvedValue({ ...mockBatch, releasedAt: null });
    const { UnreleaseLoaBatchCommand } = await import('../commands/loa-batch.commands');
    await handler.execute(new UnreleaseLoaBatchCommand('batch-1', 'prog-1', actor));
    expect(mockRepo.unrelease).toHaveBeenCalledWith('batch-1');
  });

  it('throws NotFoundException for unknown batch', async () => {
    mockRepo.findById.mockResolvedValue(null);
    const { UnreleaseLoaBatchCommand } = await import('../commands/loa-batch.commands');
    await expect(handler.execute(new UnreleaseLoaBatchCommand('bad-id', 'prog-1', actor))).rejects.toThrow(NotFoundException);
    // Guard test must also prove the mutation was skipped -- unrelease() flips
    // releasedAt back to null on a real batch, retracting LoAs participants
    // already have. A bare unconfigured jest.fn() resolving undefined would
    // pass this test either way without this assertion.
    expect(mockRepo.unrelease).not.toHaveBeenCalled();
  });

  it('refuses a programme-scoped admin outside their assigned programmes', async () => {
    mockReadPrisma.admin.findUnique.mockResolvedValue(assignedAdminFor(['someone-elses-program']));
    const { UnreleaseLoaBatchCommand } = await import('../commands/loa-batch.commands');
    await expect(handler.execute(new UnreleaseLoaBatchCommand('batch-1', 'prog-1', actor))).rejects.toThrow(ForbiddenException);
    expect(mockRepo.unrelease).not.toHaveBeenCalled();
  });
});

describe('DeleteLoaBatchHandler', () => {
  let handler: DeleteLoaBatchHandler;
  let mockRepo: jest.Mocked<LoaReleaseBatchRepository>;
  let mockReadPrisma: any;

  beforeEach(async () => {
    mockReadPrisma = mockPrismaRead();
    const module = await Test.createTestingModule({
      providers: [
        DeleteLoaBatchHandler,
        {
          provide: LoaReleaseBatchRepository,
          useValue: { findById: jest.fn(), softDelete: jest.fn() },
        },
        { provide: 'IProgramRepository', useValue: mockProgramRepo() },
        { provide: PrismaReadService, useValue: mockReadPrisma },
      ],
    }).compile();
    handler = module.get(DeleteLoaBatchHandler);
    mockRepo = module.get(LoaReleaseBatchRepository);
  });

  it('soft-deletes the batch', async () => {
    mockRepo.findById.mockResolvedValue({ ...mockBatch });
    mockRepo.softDelete.mockResolvedValue({ ...mockBatch, deletedAt: new Date() });
    const { DeleteLoaBatchCommand } = await import('../commands/loa-batch.commands');
    await handler.execute(new DeleteLoaBatchCommand('batch-1', 'prog-1', actor));
    expect(mockRepo.softDelete).toHaveBeenCalledWith('batch-1');
  });

  it('throws NotFoundException for unknown batch', async () => {
    mockRepo.findById.mockResolvedValue(null);
    const { DeleteLoaBatchCommand } = await import('../commands/loa-batch.commands');
    await expect(handler.execute(new DeleteLoaBatchCommand('bad-id', 'prog-1', actor))).rejects.toThrow(NotFoundException);
    // Guard test must also prove the mutation was skipped -- softDelete()
    // removes another program's batch. A bare unconfigured jest.fn() resolving
    // undefined would pass this test either way without this assertion.
    expect(mockRepo.softDelete).not.toHaveBeenCalled();
  });

  it('refuses a programme-scoped admin outside their assigned programmes, BEFORE deleting', async () => {
    mockReadPrisma.admin.findUnique.mockResolvedValue(assignedAdminFor(['someone-elses-program']));
    const { DeleteLoaBatchCommand } = await import('../commands/loa-batch.commands');
    await expect(handler.execute(new DeleteLoaBatchCommand('batch-1', 'prog-1', actor))).rejects.toThrow(ForbiddenException);
    expect(mockRepo.findById).not.toHaveBeenCalled();
    expect(mockRepo.softDelete).not.toHaveBeenCalled();
  });
});

describe('GetLoaBatchesHandler', () => {
  let handler: GetLoaBatchesHandler;
  let mockRepo: jest.Mocked<LoaReleaseBatchRepository>;
  let mockPrisma: any;
  let mockProgramRepository: any;
  let mockReadPrisma: any;

  beforeEach(async () => {
    mockProgramRepository = mockProgramRepo();
    mockReadPrisma = mockPrismaRead();
    const module = await Test.createTestingModule({
      providers: [
        GetLoaBatchesHandler,
        {
          provide: LoaReleaseBatchRepository,
          useValue: { findByProgram: jest.fn() },
        },
        {
          provide: PrismaService,
          useValue: {
            participantApplication: { count: jest.fn() },
            participantDocument: { count: jest.fn() },
          },
        },
        { provide: 'IProgramRepository', useValue: mockProgramRepository },
        { provide: PrismaReadService, useValue: mockReadPrisma },
      ],
    }).compile();
    handler = module.get(GetLoaBatchesHandler);
    mockRepo = module.get(LoaReleaseBatchRepository);
    mockPrisma = module.get(PrismaService);
  });

  it('returns batches with eligible and downloaded counts', async () => {
    mockRepo.findByProgram.mockResolvedValue([{ ...mockBatch }]);
    mockPrisma.participantApplication.count.mockResolvedValue(10);
    mockPrisma.participantDocument.count.mockResolvedValue(3);

    const { GetLoaBatchesQuery } = await import('../queries/loa-batch.queries');
    const result = await handler.execute(new GetLoaBatchesQuery('prog-1', actor));

    expect(result).toHaveLength(1);
    expect(result[0].eligibleCount).toBe(10);
    expect(result[0].downloadedCount).toBe(3);
    expect(result[0].name).toBe('Wave 1');
  });

  it('returns empty array when no batches exist', async () => {
    mockRepo.findByProgram.mockResolvedValue([]);
    const { GetLoaBatchesQuery } = await import('../queries/loa-batch.queries');
    const result = await handler.execute(new GetLoaBatchesQuery('prog-1', actor));
    expect(result).toHaveLength(0);
  });

  it('refuses a programme-scoped admin listing batches outside their assigned programmes', async () => {
    mockReadPrisma.admin.findUnique.mockResolvedValue(assignedAdminFor(['someone-elses-program']));
    const { GetLoaBatchesQuery } = await import('../queries/loa-batch.queries');
    await expect(handler.execute(new GetLoaBatchesQuery('prog-1', actor))).rejects.toThrow(ForbiddenException);
    expect(mockRepo.findByProgram).not.toHaveBeenCalled();
  });

  // M203-shaped bug, not a race: the admin dashboard's useResolvedProgramId
  // falls back to the raw route value (a program SLUG) whenever the program is
  // not in the caller's frontend-computed accessiblePrograms - which is the
  // normal steady state for a super admin on a program page, not just a
  // first-paint timing issue. assertProgramAccess looks the program row up by
  // id BEFORE its platform-scope short-circuit, so handing it the raw slug
  // 404s a super admin too. The fix resolves the slug to the real id first.
  //
  // The mock below is deliberately strict about WHICH id is queried: it only
  // resolves for the UUID resolveProgramId() is supposed to produce, and
  // returns null for the raw slug - so this test fails if the fix regresses
  // to asserting on the unresolved identifier.
  it('resolves a SLUG to the real programme id before asserting scope, so a super admin is NOT 404d', async () => {
    const realProgramId = '123e4567-e89b-12d3-a456-426614174000';
    const slug = 'china-youth-summit-2026';

    mockProgramRepository.findBySlug.mockImplementation((identifier: string) =>
      identifier === slug ? Promise.resolve({ id: realProgramId }) : Promise.resolve(null),
    );
    mockReadPrisma.admin.findUnique.mockResolvedValue(platformAdmin);
    mockReadPrisma.program.findUnique.mockImplementation(({ where }: { where: { id: string } }) =>
      where.id === realProgramId
        ? Promise.resolve({ id: realProgramId, brandId: 'brand-x', name: 'China Youth Summit', deletedAt: null })
        : Promise.resolve(null),
    );
    mockRepo.findByProgram.mockResolvedValue([]);

    const { GetLoaBatchesQuery } = await import('../queries/loa-batch.queries');
    await expect(
      handler.execute(new GetLoaBatchesQuery(slug, actor)),
    ).resolves.toEqual([]);

    expect(mockProgramRepository.findBySlug).toHaveBeenCalledWith(slug);
    expect(mockReadPrisma.program.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: realProgramId } }),
    );
    // The rest of the handler must also use the RESOLVED id, not the slug -
    // findByProgram(slug) would silently return nothing forever.
    expect(mockRepo.findByProgram).toHaveBeenCalledWith(realProgramId);
  });
});

describe('GetLoaDownloadsHandler', () => {
  let handler: GetLoaDownloadsHandler;
  let mockPrisma: any;
  let mockReadPrisma: any;

  beforeEach(async () => {
    mockReadPrisma = mockPrismaRead();
    const module = await Test.createTestingModule({
      providers: [
        GetLoaDownloadsHandler,
        {
          provide: PrismaService,
          useValue: {
            participantDocument: { findMany: jest.fn() },
          },
        },
        { provide: 'IProgramRepository', useValue: mockProgramRepo() },
        { provide: PrismaReadService, useValue: mockReadPrisma },
      ],
    }).compile();
    handler = module.get(GetLoaDownloadsHandler);
    mockPrisma = module.get(PrismaService);
  });

  it('returns mapped download records', async () => {
    const mockDoc = {
      id: 'doc-1',
      documentNumber: 'LOA-YBB2026-0001',
      downloadCount: 2,
      firstDownloadedAt: new Date('2026-06-01'),
      application: {
        participant: {
          fullName: 'Jane Doe',
          user: { email: 'jane@example.com' },
        },
      },
      loaReleaseBatch: { name: 'Wave 1' },
    };
    mockPrisma.participantDocument.findMany.mockResolvedValue([mockDoc]);

    const { GetLoaDownloadsQuery } = await import('../queries/loa-batch.queries');
    const result = await handler.execute(new GetLoaDownloadsQuery('prog-1', actor));

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      participantName: 'Jane Doe',
      email: 'jane@example.com',
      batchName: 'Wave 1',
      documentNumber: 'LOA-YBB2026-0001',
      downloadCount: 2,
    });
  });

  it('returns null batchName when no batch is linked', async () => {
    const mockDoc = {
      id: 'doc-2',
      documentNumber: 'LOA-YBB2026-0002',
      downloadCount: 0,
      firstDownloadedAt: null,
      application: {
        participant: {
          fullName: 'John Smith',
          user: { email: 'john@example.com' },
        },
      },
      loaReleaseBatch: null,
    };
    mockPrisma.participantDocument.findMany.mockResolvedValue([mockDoc]);

    const { GetLoaDownloadsQuery } = await import('../queries/loa-batch.queries');
    const result = await handler.execute(new GetLoaDownloadsQuery('prog-1', actor));

    expect(result[0].batchName).toBeNull();
  });

  it('refuses a programme-scoped admin listing downloads outside their assigned programmes', async () => {
    mockReadPrisma.admin.findUnique.mockResolvedValue(assignedAdminFor(['someone-elses-program']));
    const { GetLoaDownloadsQuery } = await import('../queries/loa-batch.queries');
    await expect(handler.execute(new GetLoaDownloadsQuery('prog-1', actor))).rejects.toThrow(ForbiddenException);
    expect(mockPrisma.participantDocument.findMany).not.toHaveBeenCalled();
  });
});
