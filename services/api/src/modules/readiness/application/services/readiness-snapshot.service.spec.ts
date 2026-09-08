// services/api/src/modules/readiness/application/services/readiness-snapshot.service.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { QueryBus } from '@nestjs/cqrs';
import { ReadinessSnapshotService } from './readiness-snapshot.service';
import { ReadinessRepository } from '../../infrastructure/persistence/readiness.repository';
import { RabbitMQProducerService } from '@shared/infrastructure/rabbitmq/rabbitmq-producer.service';
import { PrismaReadService } from '@shared/infrastructure/prisma/prisma-read.service';

const mockQueryBus = { execute: jest.fn() };
const mockRepo = { findSnapshots: jest.fn(), saveSnapshot: jest.fn() };
const mockProducer = { emit: jest.fn() };
const mockRead = { program: { findMany: jest.fn() } };

describe('ReadinessSnapshotService', () => {
  let service: ReadinessSnapshotService;

  beforeEach(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      providers: [
        ReadinessSnapshotService,
        { provide: QueryBus, useValue: mockQueryBus },
        { provide: ReadinessRepository, useValue: mockRepo },
        { provide: RabbitMQProducerService, useValue: mockProducer },
        { provide: PrismaReadService, useValue: mockRead },
      ],
    }).compile();
    service = moduleRef.get(ReadinessSnapshotService);
    jest.clearAllMocks();
    mockRead.program.findMany.mockResolvedValue([
      { id: 'p1', name: 'KYS 2027', brandId: 'b1', brand: { name: 'Korea Youth Summit' } },
    ]);
  });

  it('selects published programs using all three live flags', async () => {
    mockRepo.findSnapshots.mockResolvedValue([]);
    mockQueryBus.execute.mockResolvedValue({ results: [], blockerCount: 0, warningCount: 0, unknownCount: 0, isReady: true, evaluatedAt: new Date() });

    await service.reevaluatePublished();

    expect(mockRead.program.findMany).toHaveBeenCalledWith({
      where: { isPublished: true, isActive: true, status: { not: 'draft' }, deletedAt: null },
      select: { id: true, name: true, brandId: true, brand: { select: { name: true } } },
    });
  });

  it('emits only for blockers that are new since the last snapshot', async () => {
    mockRepo.findSnapshots.mockResolvedValue([
      { subjectType: 'program', subjectId: 'p1', brandId: 'b1', blockerCount: 1, warningCount: 0,
        evaluatedAt: new Date(), result: [{ ruleId: 'program.has-pricing-tiers', severity: 'BLOCKER', status: 'fail' }] },
    ]);
    mockQueryBus.execute.mockResolvedValue({
      results: [
        { ruleId: 'program.has-pricing-tiers', severity: 'BLOCKER', status: 'fail', title: 'a', symptom: 'b', fix: { label: 'c', href: '/d' } },
        { ruleId: 'program.deadline-order-valid', severity: 'BLOCKER', status: 'fail', title: 'e', symptom: 'f', fix: { label: 'g', href: '/h' } },
      ],
      blockerCount: 2, warningCount: 0, unknownCount: 0, isReady: false, evaluatedAt: new Date(),
    });

    await service.reevaluatePublished();

    expect(mockProducer.emit).toHaveBeenCalledTimes(1);
    const [routingKey, payload] = mockProducer.emit.mock.calls[0];
    expect(routingKey).toBe('readiness.regression.detected');
    expect(payload.newBlockers.map((b: { ruleId: string }) => b.ruleId)).toEqual(['program.deadline-order-valid']);
  });

  it('stays silent when nothing changed', async () => {
    mockRepo.findSnapshots.mockResolvedValue([
      { subjectType: 'program', subjectId: 'p1', brandId: 'b1', blockerCount: 1, warningCount: 0,
        evaluatedAt: new Date(), result: [{ ruleId: 'program.has-pricing-tiers', severity: 'BLOCKER', status: 'fail' }] },
    ]);
    mockQueryBus.execute.mockResolvedValue({
      results: [{ ruleId: 'program.has-pricing-tiers', severity: 'BLOCKER', status: 'fail', title: 'a', symptom: 'b', fix: { label: 'c', href: '/d' } }],
      blockerCount: 1, warningCount: 0, unknownCount: 0, isReady: false, evaluatedAt: new Date(),
    });

    await service.reevaluatePublished();

    expect(mockProducer.emit).not.toHaveBeenCalled();
  });

  it('includes the brand name (not just the id) in the emitted payload', async () => {
    mockRepo.findSnapshots.mockResolvedValue([]);
    mockQueryBus.execute.mockResolvedValue({
      results: [{ ruleId: 'program.has-pricing-tiers', severity: 'BLOCKER', status: 'fail', title: 'a', symptom: 'b', fix: { label: 'c', href: '/d' } }],
      blockerCount: 1, warningCount: 0, unknownCount: 0, isReady: false, evaluatedAt: new Date(),
    });

    await service.reevaluatePublished();

    const [, payload] = mockProducer.emit.mock.calls[0];
    expect(payload.brandId).toBe('b1');
    expect(payload.brandName).toBe('Korea Youth Summit');
  });

  it('does not treat a status change between fail and unknown on the same rule as a new blocker', async () => {
    mockRepo.findSnapshots.mockResolvedValue([
      { subjectType: 'program', subjectId: 'p1', brandId: 'b1', blockerCount: 1, warningCount: 0,
        evaluatedAt: new Date(), result: [{ ruleId: 'program.has-pricing-tiers', severity: 'BLOCKER', status: 'fail' }] },
    ]);
    mockQueryBus.execute.mockResolvedValue({
      results: [{ ruleId: 'program.has-pricing-tiers', severity: 'BLOCKER', status: 'unknown', title: 'a', symptom: 'b', fix: { label: 'c', href: '/d' } }],
      blockerCount: 1, warningCount: 0, unknownCount: 1, isReady: false, evaluatedAt: new Date(),
    });

    await service.reevaluatePublished();

    expect(mockProducer.emit).not.toHaveBeenCalled();
  });

  it('does not treat a status change between unknown and fail on the same rule as a new blocker', async () => {
    mockRepo.findSnapshots.mockResolvedValue([
      { subjectType: 'program', subjectId: 'p1', brandId: 'b1', blockerCount: 1, warningCount: 0,
        evaluatedAt: new Date(), result: [{ ruleId: 'program.has-pricing-tiers', severity: 'BLOCKER', status: 'unknown' }] },
    ]);
    mockQueryBus.execute.mockResolvedValue({
      results: [{ ruleId: 'program.has-pricing-tiers', severity: 'BLOCKER', status: 'fail', title: 'a', symptom: 'b', fix: { label: 'c', href: '/d' } }],
      blockerCount: 1, warningCount: 0, unknownCount: 0, isReady: false, evaluatedAt: new Date(),
    });

    await service.reevaluatePublished();

    expect(mockProducer.emit).not.toHaveBeenCalled();
  });

  it('evaluates program B and emits its new blockers when program A throws', async () => {
    mockRead.program.findMany.mockResolvedValue([
      { id: 'p1', name: 'Program A', brandId: 'b1', brand: { name: 'Brand A' } },
      { id: 'p2', name: 'Program B', brandId: 'b2', brand: { name: 'Brand B' } },
    ]);
    mockRepo.findSnapshots.mockResolvedValue([]);
    mockQueryBus.execute.mockImplementation((query: { programId: string }) => {
      if (query.programId === 'p1') {
        return Promise.reject(new Error('payment service unreachable'));
      }
      return Promise.resolve({
        results: [{ ruleId: 'program.deadline-order-valid', severity: 'BLOCKER', status: 'fail', title: 'e', symptom: 'f', fix: { label: 'g', href: '/h' } }],
        blockerCount: 1, warningCount: 0, unknownCount: 0, isReady: false, evaluatedAt: new Date(),
      });
    });

    await expect(service.reevaluatePublished()).resolves.toBeUndefined();

    expect(mockProducer.emit).toHaveBeenCalledTimes(1);
    const [routingKey, payload] = mockProducer.emit.mock.calls[0];
    expect(routingKey).toBe('readiness.regression.detected');
    expect(payload.subjectId).toBe('p2');
    expect(payload.newBlockers.map((b: { ruleId: string }) => b.ruleId)).toEqual(['program.deadline-order-valid']);
  });
});
