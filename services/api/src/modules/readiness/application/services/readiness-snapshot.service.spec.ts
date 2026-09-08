// services/api/src/modules/readiness/application/services/readiness-snapshot.service.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { QueryBus } from '@nestjs/cqrs';
import { ReadinessSnapshotService } from './readiness-snapshot.service';
import { ReadinessRepository } from '../../infrastructure/persistence/readiness.repository';
import { RabbitMQProducerService } from '@shared/infrastructure/rabbitmq/rabbitmq-producer.service';
import { PrismaReadService } from '@shared/infrastructure/prisma/prisma-read.service';
import { CronLockService } from '@shared/infrastructure/database/cron-lock.service';

const mockQueryBus = { execute: jest.fn() };
const mockRepo = {
  findSnapshots: jest.fn(),
  saveSnapshot: jest.fn(),
  getAlertBaseline: jest.fn(),
  saveAlertBaseline: jest.fn(),
};
const mockProducer = { emit: jest.fn() };
const mockRead = { program: { findMany: jest.fn() }, brand: { findMany: jest.fn() } };
const mockCronLock = {
  runExclusive: jest.fn((_jobName: string, fn: () => Promise<void>) => fn()),
};

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
        { provide: CronLockService, useValue: mockCronLock },
      ],
    }).compile();
    service = moduleRef.get(ReadinessSnapshotService);
    jest.clearAllMocks();
    mockRead.program.findMany.mockResolvedValue([
      { id: 'p1', name: 'KYS 2027', brandId: 'b1', brand: { name: 'Korea Youth Summit' } },
    ]);
    // Empty by default so tests focused on programs aren't affected by the
    // brand sweep; brand-sweep tests override this.
    mockRead.brand.findMany.mockResolvedValue([]);
    mockRepo.getAlertBaseline.mockResolvedValue([]);
    mockRepo.saveAlertBaseline.mockResolvedValue(undefined);
  });

  it('selects published programs using all three live flags', async () => {
    mockQueryBus.execute.mockResolvedValue({ results: [], blockerCount: 0, warningCount: 0, unknownCount: 0, isReady: true, evaluatedAt: new Date() });

    await service.reevaluatePublished();

    expect(mockRead.program.findMany).toHaveBeenCalledWith({
      where: { isPublished: true, isActive: true, status: { not: 'draft' }, deletedAt: null },
      select: { id: true, name: true, brandId: true, brand: { select: { name: true } } },
    });
  });

  it('emits only for blockers that are new since the last recorded alert baseline', async () => {
    mockRepo.getAlertBaseline.mockResolvedValue(['program.has-pricing-tiers']);
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
    mockRepo.getAlertBaseline.mockResolvedValue(['program.has-pricing-tiers']);
    mockQueryBus.execute.mockResolvedValue({
      results: [{ ruleId: 'program.has-pricing-tiers', severity: 'BLOCKER', status: 'fail', title: 'a', symptom: 'b', fix: { label: 'c', href: '/d' } }],
      blockerCount: 1, warningCount: 0, unknownCount: 0, isReady: false, evaluatedAt: new Date(),
    });

    await service.reevaluatePublished();

    expect(mockProducer.emit).not.toHaveBeenCalled();
  });

  it('records the new blocking rule set as the baseline after every sweep, whether or not it alerted', async () => {
    mockRepo.getAlertBaseline.mockResolvedValue(['program.has-pricing-tiers']);
    mockQueryBus.execute.mockResolvedValue({
      results: [{ ruleId: 'program.has-pricing-tiers', severity: 'BLOCKER', status: 'fail', title: 'a', symptom: 'b', fix: { label: 'c', href: '/d' } }],
      blockerCount: 1, warningCount: 0, unknownCount: 0, isReady: false, evaluatedAt: new Date(),
    });

    await service.reevaluatePublished();

    expect(mockRepo.saveAlertBaseline).toHaveBeenCalledWith('program', 'p1', ['program.has-pricing-tiers']);
  });

  it('includes the brand name (not just the id) in the emitted payload', async () => {
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
    mockRepo.getAlertBaseline.mockResolvedValue(['program.has-pricing-tiers']);
    mockQueryBus.execute.mockResolvedValue({
      results: [{ ruleId: 'program.has-pricing-tiers', severity: 'BLOCKER', status: 'unknown', title: 'a', symptom: 'b', fix: { label: 'c', href: '/d' } }],
      blockerCount: 1, warningCount: 0, unknownCount: 1, isReady: false, evaluatedAt: new Date(),
    });

    await service.reevaluatePublished();

    expect(mockProducer.emit).not.toHaveBeenCalled();
  });

  it('does not treat a status change between unknown and fail on the same rule as a new blocker', async () => {
    mockRepo.getAlertBaseline.mockResolvedValue(['program.has-pricing-tiers']);
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
    mockQueryBus.execute.mockImplementation((query: { programId?: string }) => {
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

  // IMPORTANT 6: a readiness panel GET writes readiness_snapshots on every
  // request (see get-program-readiness.handler.ts). That must never be what
  // the cron diffs against, or an admin opening the panel after a real
  // regression would make the cron think it already knew about it.
  it('does not let a readiness-panel snapshot write between sweeps suppress a real regression', async () => {
    // Sweep 1: nothing known yet; rule X is blocking and new.
    mockRepo.getAlertBaseline.mockResolvedValueOnce([]);
    mockQueryBus.execute.mockResolvedValueOnce({
      results: [{ ruleId: 'program.rule-x', severity: 'BLOCKER', status: 'fail', title: 'x', symptom: 'x', fix: { label: 'x', href: '/x' } }],
      blockerCount: 1, warningCount: 0, unknownCount: 0, isReady: false, evaluatedAt: new Date(),
    });

    await service.reevaluatePublished();

    expect(mockRepo.saveAlertBaseline).toHaveBeenCalledWith('program', 'p1', ['program.rule-x']);

    // Between sweeps: an admin opens the readiness panel. That's the
    // read-path handler calling repository.saveSnapshot directly — it does
    // not go through this service at all, and includes a brand-new rule Y
    // that the cron has never recorded. Under the bug, the cron used to
    // diff against this same table and would treat Y as already known.
    await mockRepo.saveSnapshot('program', 'p1', 'b1', {
      results: [
        { ruleId: 'program.rule-x', severity: 'BLOCKER', status: 'fail' },
        { ruleId: 'program.rule-y', severity: 'BLOCKER', status: 'fail' },
      ],
      blockerCount: 2, warningCount: 0, unknownCount: 0, isReady: false, evaluatedAt: new Date(),
    }, { subjectName: 'KYS 2027', brandName: 'Korea Youth Summit' });

    // Sweep 2: the cron's own baseline only ever recorded X, so Y is
    // correctly reported as new.
    mockRepo.getAlertBaseline.mockResolvedValueOnce(['program.rule-x']);
    mockQueryBus.execute.mockResolvedValueOnce({
      results: [
        { ruleId: 'program.rule-x', severity: 'BLOCKER', status: 'fail', title: 'x', symptom: 'x', fix: { label: 'x', href: '/x' } },
        { ruleId: 'program.rule-y', severity: 'BLOCKER', status: 'fail', title: 'y', symptom: 'y', fix: { label: 'y', href: '/y' } },
      ],
      blockerCount: 2, warningCount: 0, unknownCount: 0, isReady: false, evaluatedAt: new Date(),
    });

    await service.reevaluatePublished();

    expect(mockRepo.findSnapshots).not.toHaveBeenCalled();
    expect(mockProducer.emit).toHaveBeenCalledTimes(2);
    const [, secondPayload] = mockProducer.emit.mock.calls[1];
    expect(secondPayload.newBlockers.map((b: { ruleId: string }) => b.ruleId)).toEqual(['program.rule-y']);
  });

  describe('brand sweep', () => {
    it('evaluates every active brand and writes its own alert baseline', async () => {
      mockQueryBus.execute.mockImplementation((query: { programId?: string; brandId?: string }) => {
        if (query.programId) {
          return Promise.resolve({ results: [], blockerCount: 0, warningCount: 0, unknownCount: 0, isReady: true, evaluatedAt: new Date() });
        }
        return Promise.resolve({
          results: [{ ruleId: 'brand.has-active-signature', severity: 'BLOCKER', status: 'fail', title: 'a', symptom: 'b', fix: { label: 'c', href: '/d' } }],
          blockerCount: 1, warningCount: 0, unknownCount: 0, isReady: false, evaluatedAt: new Date(),
        });
      });
      mockRead.brand.findMany.mockResolvedValue([{ id: 'b9', name: 'Japan Youth Summit' }]);

      await service.reevaluatePublished();

      expect(mockRead.brand.findMany).toHaveBeenCalledWith({
        where: { isActive: true, deletedAt: null },
        select: { id: true, name: true },
      });
      expect(mockRepo.saveAlertBaseline).toHaveBeenCalledWith('brand', 'b9', ['brand.has-active-signature']);

      const brandEmit = mockProducer.emit.mock.calls.find(([, payload]) => payload.subjectType === 'brand');
      expect(brandEmit).toBeDefined();
      const [, payload] = brandEmit!;
      expect(payload.subjectId).toBe('b9');
      expect(payload.brandId).toBe('b9');
      expect(payload.brandName).toBe('Japan Youth Summit');
    });

    it('does not let one unevaluable brand abort the sweep', async () => {
      mockRead.brand.findMany.mockResolvedValue([
        { id: 'b1', name: 'Brand One' },
        { id: 'b2', name: 'Brand Two' },
      ]);
      mockQueryBus.execute.mockImplementation((query: { programId?: string; brandId?: string }) => {
        if (query.programId) {
          return Promise.resolve({ results: [], blockerCount: 0, warningCount: 0, unknownCount: 0, isReady: true, evaluatedAt: new Date() });
        }
        if (query.brandId === 'b1') return Promise.reject(new Error('boom'));
        return Promise.resolve({
          results: [{ ruleId: 'brand.has-active-signature', severity: 'BLOCKER', status: 'fail', title: 'a', symptom: 'b', fix: { label: 'c', href: '/d' } }],
          blockerCount: 1, warningCount: 0, unknownCount: 0, isReady: false, evaluatedAt: new Date(),
        });
      });

      await expect(service.reevaluatePublished()).resolves.toBeUndefined();

      expect(mockRepo.saveAlertBaseline).toHaveBeenCalledWith('brand', 'b2', ['brand.has-active-signature']);
    });
  });
});
