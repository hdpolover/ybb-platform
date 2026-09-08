// file: services/api/src/modules/programs/application/commands/handlers/publish-program.handler.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { UnprocessableEntityException } from '@nestjs/common';
import { QueryBus } from '@nestjs/cqrs';
import { PublishProgramHandler } from './publish-program.handler';
import { PublishProgramCommand } from '../publish-program.command';

const mockQueryBus = { execute: jest.fn() };
const mockRepo = { update: jest.fn() };

describe('PublishProgramHandler', () => {
  let handler: PublishProgramHandler;

  beforeEach(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      providers: [
        PublishProgramHandler,
        { provide: QueryBus, useValue: mockQueryBus },
        { provide: 'IProgramRepository', useValue: mockRepo },
      ],
    }).compile();
    handler = moduleRef.get(PublishProgramHandler);
    jest.clearAllMocks();
  });

  it('refuses to publish when a blocker remains, and names the failing rules', async () => {
    mockQueryBus.execute.mockResolvedValue({
      isReady: false, blockerCount: 1, unknownCount: 0,
      results: [{ ruleId: 'program.has-pricing-tiers', severity: 'BLOCKER', status: 'fail', title: 'No pricing tiers configured', symptom: 'No fee information', fix: { label: 'Add', href: '/x' } }],
    });

    await expect(handler.execute(new PublishProgramCommand('p1', 'admin-1')))
      .rejects.toThrow(UnprocessableEntityException);
    expect(mockRepo.update).not.toHaveBeenCalled();
  });

  it('refuses to publish when a rule could not be evaluated', async () => {
    mockQueryBus.execute.mockResolvedValue({
      isReady: false, blockerCount: 0, unknownCount: 1,
      results: [{ ruleId: 'program.has-payment-method-config', severity: 'BLOCKER', status: 'unknown', title: 'x', symptom: 'y', fix: { label: 'a', href: '/b' } }],
    });
    await expect(handler.execute(new PublishProgramCommand('p1', 'admin-1')))
      .rejects.toThrow(UnprocessableEntityException);
  });

  it('publishes with all three live flags when ready', async () => {
    mockQueryBus.execute.mockResolvedValue({ isReady: true, blockerCount: 0, unknownCount: 0, results: [] });
    mockRepo.update.mockResolvedValue({ id: 'p1' });

    await handler.execute(new PublishProgramCommand('p1', 'admin-1'));

    expect(mockRepo.update).toHaveBeenCalledWith('p1', {
      isPublished: true, isActive: true, status: 'published',
    });
  });

  it('publishes when the only blocker is overridden', async () => {
    mockQueryBus.execute.mockResolvedValue({
      isReady: true, blockerCount: 0, unknownCount: 0,
      results: [{ ruleId: 'brand.primary-color-set', severity: 'BLOCKER', status: 'overridden', title: 'x', symptom: 'y', fix: { label: 'a', href: '/b' } }],
    });
    await handler.execute(new PublishProgramCommand('p1', 'admin-1'));
    expect(mockRepo.update).toHaveBeenCalled();
  });
});
