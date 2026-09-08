import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { CreateReadinessOverrideHandler } from './create-readiness-override.handler';
import { CreateReadinessOverrideCommand } from '../create-readiness-override.command';
import { ReadinessRepository } from '../../../infrastructure/persistence/readiness.repository';

const mockRepo = { createOverride: jest.fn() };

describe('CreateReadinessOverrideHandler', () => {
  let handler: CreateReadinessOverrideHandler;

  beforeEach(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      providers: [
        CreateReadinessOverrideHandler,
        { provide: ReadinessRepository, useValue: mockRepo },
      ],
    }).compile();
    handler = moduleRef.get(CreateReadinessOverrideHandler);
    jest.clearAllMocks();
  });

  it('stores the override with the acting admin id and reason', async () => {
    await handler.execute(new CreateReadinessOverrideCommand({
      subjectType: 'brand', subjectId: 'b1', ruleId: 'brand.primary-color-set',
      reason: 'Rebrand lands next week', expiresAt: null,
    }, 'admin-1'));

    expect(mockRepo.createOverride).toHaveBeenCalledWith({
      subjectType: 'brand', subjectId: 'b1', ruleId: 'brand.primary-color-set',
      adminId: 'admin-1', reason: 'Rebrand lands next week', expiresAt: null,
    });
  });

  it('rejects an unknown rule id, so a typo cannot create a dead override', async () => {
    await expect(handler.execute(new CreateReadinessOverrideCommand({
      subjectType: 'brand', subjectId: 'b1', ruleId: 'brand.nonexistent',
      reason: 'x', expiresAt: null,
    }, 'admin-1'))).rejects.toThrow(BadRequestException);
    expect(mockRepo.createOverride).not.toHaveBeenCalled();
  });

  it('rejects a whitespace-only reason', async () => {
    await expect(handler.execute(new CreateReadinessOverrideCommand({
      subjectType: 'brand', subjectId: 'b1', ruleId: 'brand.primary-color-set',
      reason: '   ', expiresAt: null,
    }, 'admin-1'))).rejects.toThrow(BadRequestException);
  });

  it('rejects a rule whose scope does not match the subject', async () => {
    await expect(handler.execute(new CreateReadinessOverrideCommand({
      subjectType: 'brand', subjectId: 'b1', ruleId: 'program.has-pricing-tiers',
      reason: 'wrong scope', expiresAt: null,
    }, 'admin-1'))).rejects.toThrow(BadRequestException);
  });
});
