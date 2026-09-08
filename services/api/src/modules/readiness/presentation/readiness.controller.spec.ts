// services/api/src/modules/readiness/presentation/readiness.controller.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { QueryBus } from '@nestjs/cqrs';
import { ReadinessController } from './readiness.controller';
import { JwtAuthGuard } from '@modules/auth/infrastructure/guards/jwt-auth.guard';
import { RolesGuard } from '@modules/auth/infrastructure/guards/roles.guard';
import { AdminScopeGuard } from '@shared/guards/admin-scope.guard';
import { GetBrandReadinessQuery } from '../application/queries/get-brand-readiness.query';
import { GetReadinessSummaryQuery } from '../application/queries/get-readiness-summary.query';

const mockQueryBus = { execute: jest.fn() };

describe('ReadinessController', () => {
  let controller: ReadinessController;

  beforeEach(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      controllers: [ReadinessController],
      providers: [{ provide: QueryBus, useValue: mockQueryBus }],
    })
      .overrideGuard(JwtAuthGuard).useValue({ canActivate: () => true })
      .overrideGuard(RolesGuard).useValue({ canActivate: () => true })
      .overrideGuard(AdminScopeGuard).useValue({ canActivate: () => true })
      .compile();
    controller = moduleRef.get(ReadinessController);
    jest.clearAllMocks();
    mockQueryBus.execute.mockResolvedValue({ isReady: false });
  });

  it('dispatches a brand readiness query', async () => {
    await controller.getBrandReadiness('b1');
    expect(mockQueryBus.execute).toHaveBeenCalledWith(expect.any(GetBrandReadinessQuery));
  });

  it('dispatches a summary query', async () => {
    await controller.getSummary();
    expect(mockQueryBus.execute).toHaveBeenCalledWith(expect.any(GetReadinessSummaryQuery));
  });
});
