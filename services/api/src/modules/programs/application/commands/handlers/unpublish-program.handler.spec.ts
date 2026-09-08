// file: services/api/src/modules/programs/application/commands/handlers/unpublish-program.handler.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { QueryBus } from '@nestjs/cqrs';
import { UnpublishProgramHandler } from './unpublish-program.handler';
import { UnpublishProgramCommand } from '../unpublish-program.command';

const mockQueryBus = { execute: jest.fn() };
const mockRepo = { update: jest.fn() };

describe('UnpublishProgramHandler', () => {
  let handler: UnpublishProgramHandler;

  beforeEach(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      providers: [
        UnpublishProgramHandler,
        { provide: QueryBus, useValue: mockQueryBus },
        { provide: 'IProgramRepository', useValue: mockRepo },
      ],
    }).compile();
    handler = moduleRef.get(UnpublishProgramHandler);
    jest.clearAllMocks();
  });

  // Regression guard: unpublish must never consult readiness. If someone later
  // "helpfully" adds a readiness check here, this test fails and explains why
  // (see Task 9 brief: unpublish is never gated).
  it('unpublishes without consulting readiness', async () => {
    mockRepo.update.mockResolvedValue({ id: 'p1' });

    await handler.execute(new UnpublishProgramCommand('p1', 'admin-1'));

    expect(mockRepo.update).toHaveBeenCalledWith('p1', { isPublished: false });
    expect(mockQueryBus.execute).not.toHaveBeenCalled();
  });
});
