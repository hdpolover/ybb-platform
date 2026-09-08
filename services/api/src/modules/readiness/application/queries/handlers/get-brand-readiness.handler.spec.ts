// services/api/src/modules/readiness/application/queries/handlers/get-brand-readiness.handler.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { GetBrandReadinessHandler } from './get-brand-readiness.handler';
import { GetBrandReadinessQuery } from '../get-brand-readiness.query';
import { ReadinessContextLoader } from '../../../infrastructure/readiness-context.loader';
import { ReadinessRepository } from '../../../infrastructure/persistence/readiness.repository';

const mockLoader = { loadBrand: jest.fn() };
const mockRepo = { findActiveOverrides: jest.fn(), saveSnapshot: jest.fn() };

const blankColourBrand = {
  brand: {
    id: 'b1', name: 'KYS', primaryColor: '', logoUrl: 'https://cdn.ybbhub.com/a.png',
    logoIconUrl: null, landingUrl: null, tagline: null, defaultCurrency: 'USD',
    isMaintenanceMode: false, supportEmail: null,
    activeSignatureCount: 0, legalDocumentCount: 0, publishedProgramCount: 4,
  },
};

describe('GetBrandReadinessHandler', () => {
  let handler: GetBrandReadinessHandler;

  beforeEach(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      providers: [
        GetBrandReadinessHandler,
        { provide: ReadinessContextLoader, useValue: mockLoader },
        { provide: ReadinessRepository, useValue: mockRepo },
      ],
    }).compile();
    handler = moduleRef.get(GetBrandReadinessHandler);
    jest.clearAllMocks();
    mockLoader.loadBrand.mockResolvedValue(blankColourBrand);
    mockRepo.findActiveOverrides.mockResolvedValue([]);
  });

  it('reports Korea Youth Summit as not ready, naming the colour and signature blockers', async () => {
    const report = await handler.execute(new GetBrandReadinessQuery('b1'));
    const failing = report.results.filter((r) => r.status === 'fail').map((r) => r.ruleId);
    expect(failing).toContain('brand.primary-color-set');
    expect(failing).toContain('brand.has-active-signature');
    expect(report.isReady).toBe(false);
  });

  it('persists a snapshot so the fleet summary stays current', async () => {
    await handler.execute(new GetBrandReadinessQuery('b1'));
    expect(mockRepo.saveSnapshot).toHaveBeenCalledWith('brand', 'b1', 'b1', expect.objectContaining({ isReady: false }));
  });
});
