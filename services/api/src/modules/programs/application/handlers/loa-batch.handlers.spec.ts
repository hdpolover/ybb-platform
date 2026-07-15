import { Test } from '@nestjs/testing';
import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
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
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service';
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

describe('CreateLoaBatchHandler', () => {
  let handler: CreateLoaBatchHandler;
  let mockRepo: jest.Mocked<LoaReleaseBatchRepository>;

  beforeEach(async () => {
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
      new CreateLoaBatchCommand('prog-1', 'Wave 1', new Date('2026-01-01'), new Date('2026-03-31'), 'admin-1'),
    );
    expect(result.name).toBe('Wave 1');
    // The handler normalizes the range to whole UTC days (startOfUtcDay/endOfUtcDay),
    // so an end date of 2026-03-31 covers that entire day rather than its midnight
    // boundary. Assert the normalized values the repository actually receives.
    const submissionFrom = new Date('2026-01-01T00:00:00.000Z');
    const submissionTo = new Date('2026-03-31T23:59:59.999Z');
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
        new CreateLoaBatchCommand('prog-1', 'Wave 2', new Date('2026-02-01'), new Date('2026-04-30'), 'admin-1'),
      ),
    ).rejects.toThrow(ConflictException);
  });

  it('throws BadRequestException when submissionFrom is after submissionTo', async () => {
    mockRepo.findOverlapping.mockResolvedValue([]);
    const { CreateLoaBatchCommand } = await import('../commands/loa-batch.commands');
    await expect(
      handler.execute(
        new CreateLoaBatchCommand('prog-1', 'Bad Range', new Date('2026-06-01'), new Date('2026-01-01'), 'admin-1'),
      ),
    ).rejects.toThrow(BadRequestException);
    expect(mockRepo.create).not.toHaveBeenCalled();
  });
});

describe('UpdateLoaBatchHandler', () => {
  let handler: UpdateLoaBatchHandler;
  let mockRepo: jest.Mocked<LoaReleaseBatchRepository>;

  beforeEach(async () => {
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
      new UpdateLoaBatchCommand('batch-1', 'prog-1', 'Updated Wave 1'),
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
      handler.execute(new UpdateLoaBatchCommand('bad-id', 'prog-1', 'New Name')),
    ).rejects.toThrow(NotFoundException);
  });

  it('throws ConflictException when update causes overlap', async () => {
    mockRepo.findById.mockResolvedValue({ ...mockBatch });
    mockRepo.findOverlapping.mockResolvedValue([{ ...mockBatch, id: 'other-batch', name: 'Other Wave' } as any]);
    const { UpdateLoaBatchCommand } = await import('../commands/loa-batch.commands');
    await expect(
      handler.execute(new UpdateLoaBatchCommand('batch-1', 'prog-1', undefined, new Date('2026-02-01'), new Date('2026-05-31'))),
    ).rejects.toThrow(ConflictException);
  });

  it('throws BadRequestException when effective submissionFrom is after submissionTo', async () => {
    mockRepo.findById.mockResolvedValue({ ...mockBatch });
    mockRepo.findOverlapping.mockResolvedValue([]);
    const { UpdateLoaBatchCommand } = await import('../commands/loa-batch.commands');
    // Passing a new submissionFrom that is after the existing submissionTo
    await expect(
      handler.execute(new UpdateLoaBatchCommand('batch-1', 'prog-1', undefined, new Date('2026-12-01'), new Date('2026-01-01'))),
    ).rejects.toThrow(BadRequestException);
    expect(mockRepo.update).not.toHaveBeenCalled();
  });
});

describe('ReleaseLoaBatchHandler', () => {
  let handler: ReleaseLoaBatchHandler;
  let mockRepo: jest.Mocked<LoaReleaseBatchRepository>;
  let mockPrisma: any;
  let mockProducer: any;
  let mockUserNotificationRepo: any;

  const releasedBatch = { ...mockBatch, releasedAt: new Date('2026-07-01') };
  const recipient = { userId: 'user-1', email: 'jane@example.com', fullName: 'Jane Doe' };

  beforeEach(async () => {
    const { IUserNotificationRepository } = await import(
      '@core/interfaces/repositories/user-notification.repository.interface'
    );

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
          provide: IUserNotificationRepository,
          useValue: { create: jest.fn().mockResolvedValue(undefined) },
        },
      ],
    }).compile();
    handler = module.get(ReleaseLoaBatchHandler);
    mockRepo = module.get(LoaReleaseBatchRepository);
    mockPrisma = module.get(PrismaService);
    mockProducer = module.get(RabbitMQProducerService);
    mockUserNotificationRepo = module.get(IUserNotificationRepository);
  });

  it('releases the batch', async () => {
    mockRepo.findById.mockResolvedValue({ ...mockBatch });
    mockRepo.release.mockResolvedValue({ batch: releasedBatch, transitioned: true });
    mockRepo.findEligibleRecipients.mockResolvedValue([]);
    const { ReleaseLoaBatchCommand } = await import('../commands/loa-batch.commands');
    await handler.execute(new ReleaseLoaBatchCommand('batch-1', 'prog-1'));
    expect(mockRepo.release).toHaveBeenCalledWith('batch-1');
  });

  it('throws NotFoundException for unknown batch', async () => {
    mockRepo.findById.mockResolvedValue(null);
    const { ReleaseLoaBatchCommand } = await import('../commands/loa-batch.commands');
    await expect(handler.execute(new ReleaseLoaBatchCommand('bad-id', 'prog-1'))).rejects.toThrow(NotFoundException);
  });

  it('on a real release, creates an in-app notification per eligible recipient and emits loa.batch.released', async () => {
    mockRepo.findById.mockResolvedValue({ ...mockBatch });
    mockRepo.release.mockResolvedValue({ batch: releasedBatch, transitioned: true });
    mockRepo.findEligibleRecipients.mockResolvedValue([recipient]);
    mockPrisma.program.findUnique.mockResolvedValue({ name: 'YBB Summit 2026' });

    const { ReleaseLoaBatchCommand } = await import('../commands/loa-batch.commands');
    await handler.execute(new ReleaseLoaBatchCommand('batch-1', 'prog-1'));

    expect(mockRepo.findEligibleRecipients).toHaveBeenCalledWith(
      'prog-1',
      mockBatch.submissionFrom,
      mockBatch.submissionTo,
    );
    expect(mockUserNotificationRepo.create).toHaveBeenCalledTimes(1);
    expect(mockProducer.emit).toHaveBeenCalledWith('loa.batch.released', {
      batchId: 'batch-1',
      programId: 'prog-1',
      programName: 'YBB Summit 2026',
      batchName: 'Wave 1',
      recipients: [recipient],
    });
  });

  it('does NOT re-notify when re-releasing an already-released batch (idempotent)', async () => {
    mockRepo.findById.mockResolvedValue({ ...releasedBatch });
    mockRepo.release.mockResolvedValue({ batch: releasedBatch, transitioned: false });

    const { ReleaseLoaBatchCommand } = await import('../commands/loa-batch.commands');
    await handler.execute(new ReleaseLoaBatchCommand('batch-1', 'prog-1'));

    expect(mockRepo.findEligibleRecipients).not.toHaveBeenCalled();
    expect(mockUserNotificationRepo.create).not.toHaveBeenCalled();
    expect(mockProducer.emit).not.toHaveBeenCalled();
  });

  it('skips notification entirely when there are zero eligible recipients', async () => {
    mockRepo.findById.mockResolvedValue({ ...mockBatch });
    mockRepo.release.mockResolvedValue({ batch: releasedBatch, transitioned: true });
    mockRepo.findEligibleRecipients.mockResolvedValue([]);

    const { ReleaseLoaBatchCommand } = await import('../commands/loa-batch.commands');
    await handler.execute(new ReleaseLoaBatchCommand('batch-1', 'prog-1'));

    expect(mockUserNotificationRepo.create).not.toHaveBeenCalled();
    expect(mockProducer.emit).not.toHaveBeenCalled();
  });

  it('does not let a notify-pipeline failure surface as a thrown error (release already committed)', async () => {
    mockRepo.findById.mockResolvedValue({ ...mockBatch });
    mockRepo.release.mockResolvedValue({ batch: releasedBatch, transitioned: true });
    mockRepo.findEligibleRecipients.mockRejectedValue(new Error('db exploded'));

    const { ReleaseLoaBatchCommand } = await import('../commands/loa-batch.commands');
    const result = await handler.execute(new ReleaseLoaBatchCommand('batch-1', 'prog-1'));

    expect(result).toEqual(releasedBatch);
  });
});

describe('UnreleaseLoaBatchHandler', () => {
  let handler: UnreleaseLoaBatchHandler;
  let mockRepo: jest.Mocked<LoaReleaseBatchRepository>;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        UnreleaseLoaBatchHandler,
        {
          provide: LoaReleaseBatchRepository,
          useValue: { findById: jest.fn(), unrelease: jest.fn() },
        },
      ],
    }).compile();
    handler = module.get(UnreleaseLoaBatchHandler);
    mockRepo = module.get(LoaReleaseBatchRepository);
  });

  it('unreleases the batch', async () => {
    mockRepo.findById.mockResolvedValue({ ...mockBatch, releasedAt: new Date() });
    mockRepo.unrelease.mockResolvedValue({ ...mockBatch, releasedAt: null });
    const { UnreleaseLoaBatchCommand } = await import('../commands/loa-batch.commands');
    await handler.execute(new UnreleaseLoaBatchCommand('batch-1', 'prog-1'));
    expect(mockRepo.unrelease).toHaveBeenCalledWith('batch-1');
  });

  it('throws NotFoundException for unknown batch', async () => {
    mockRepo.findById.mockResolvedValue(null);
    const { UnreleaseLoaBatchCommand } = await import('../commands/loa-batch.commands');
    await expect(handler.execute(new UnreleaseLoaBatchCommand('bad-id', 'prog-1'))).rejects.toThrow(NotFoundException);
  });
});

describe('DeleteLoaBatchHandler', () => {
  let handler: DeleteLoaBatchHandler;
  let mockRepo: jest.Mocked<LoaReleaseBatchRepository>;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        DeleteLoaBatchHandler,
        {
          provide: LoaReleaseBatchRepository,
          useValue: { findById: jest.fn(), softDelete: jest.fn() },
        },
      ],
    }).compile();
    handler = module.get(DeleteLoaBatchHandler);
    mockRepo = module.get(LoaReleaseBatchRepository);
  });

  it('soft-deletes the batch', async () => {
    mockRepo.findById.mockResolvedValue({ ...mockBatch });
    mockRepo.softDelete.mockResolvedValue({ ...mockBatch, deletedAt: new Date() });
    const { DeleteLoaBatchCommand } = await import('../commands/loa-batch.commands');
    await handler.execute(new DeleteLoaBatchCommand('batch-1', 'prog-1'));
    expect(mockRepo.softDelete).toHaveBeenCalledWith('batch-1');
  });

  it('throws NotFoundException for unknown batch', async () => {
    mockRepo.findById.mockResolvedValue(null);
    const { DeleteLoaBatchCommand } = await import('../commands/loa-batch.commands');
    await expect(handler.execute(new DeleteLoaBatchCommand('bad-id', 'prog-1'))).rejects.toThrow(NotFoundException);
  });
});

describe('GetLoaBatchesHandler', () => {
  let handler: GetLoaBatchesHandler;
  let mockRepo: jest.Mocked<LoaReleaseBatchRepository>;
  let mockPrisma: any;

  beforeEach(async () => {
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
    const result = await handler.execute(new GetLoaBatchesQuery('prog-1'));

    expect(result).toHaveLength(1);
    expect(result[0].eligibleCount).toBe(10);
    expect(result[0].downloadedCount).toBe(3);
    expect(result[0].name).toBe('Wave 1');
  });

  it('returns empty array when no batches exist', async () => {
    mockRepo.findByProgram.mockResolvedValue([]);
    const { GetLoaBatchesQuery } = await import('../queries/loa-batch.queries');
    const result = await handler.execute(new GetLoaBatchesQuery('prog-1'));
    expect(result).toHaveLength(0);
  });
});

describe('GetLoaDownloadsHandler', () => {
  let handler: GetLoaDownloadsHandler;
  let mockPrisma: any;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        GetLoaDownloadsHandler,
        {
          provide: PrismaService,
          useValue: {
            participantDocument: { findMany: jest.fn() },
          },
        },
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
    const result = await handler.execute(new GetLoaDownloadsQuery('prog-1'));

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
    const result = await handler.execute(new GetLoaDownloadsQuery('prog-1'));

    expect(result[0].batchName).toBeNull();
  });
});
