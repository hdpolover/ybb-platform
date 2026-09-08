import { Test, TestingModule } from '@nestjs/testing';
import { ReadinessContextLoader } from './readiness-context.loader';
import { PrismaReadService } from '@shared/infrastructure/prisma/prisma-read.service';
import { PaymentConfigClient } from './payment-config.client';

const mockPayment = { getProgramMethodSummary: jest.fn() };

const mockRead = {
  brand: { findUnique: jest.fn() },
  signature: { count: jest.fn() },
  legalDocument: { count: jest.fn() },
  program: { count: jest.fn(), findUnique: jest.fn() },
  programPricingTier: { count: jest.fn() },
  programObjective: { count: jest.fn() },
  programFaq: { count: jest.fn() },
  programGallery: { count: jest.fn() },
  programTestimonial: { count: jest.fn() },
};

describe('ReadinessContextLoader', () => {
  let loader: ReadinessContextLoader;

  beforeEach(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      providers: [
        ReadinessContextLoader,
        { provide: PrismaReadService, useValue: mockRead },
        { provide: PaymentConfigClient, useValue: mockPayment },
      ],
    }).compile();
    loader = moduleRef.get(ReadinessContextLoader);
    jest.clearAllMocks();

    mockPayment.getProgramMethodSummary.mockResolvedValue({ enabledCount: 1, isConfigured: true });
    mockRead.brand.findUnique.mockResolvedValue({
      id: 'b1', name: 'KYS', primaryColor: '', logoUrl: null, logoIconUrl: null,
      landingUrl: null, tagline: 'x', defaultCurrency: 'USD',
      settings: { isMaintenanceMode: false, supportEmail: null },
    });
    mockRead.signature.count.mockResolvedValue(0);
    mockRead.legalDocument.count.mockResolvedValue(0);
    mockRead.program.count.mockResolvedValue(4);
  });

  it('passes deletedAt: null explicitly to every count, since the soft-delete extension does not cover count()', async () => {
    await loader.loadBrand('b1');
    expect(mockRead.signature.count).toHaveBeenCalledWith({
      where: { brandId: 'b1', isActive: true, deletedAt: null },
    });
    expect(mockRead.legalDocument.count).toHaveBeenCalledWith({
      where: { brandId: 'b1', isActive: true, deletedAt: null },
    });
  });

  it('counts published programs with all three live flags, not isPublished alone', async () => {
    await loader.loadBrand('b1');
    expect(mockRead.program.count).toHaveBeenCalledWith({
      where: { brandId: 'b1', isPublished: true, isActive: true, status: { not: 'draft' }, deletedAt: null },
    });
  });

  it('maps a blank primary colour through untouched so the rule can judge it', async () => {
    const ctx = await loader.loadBrand('b1');
    expect(ctx.brand.primaryColor).toBe('');
    expect(ctx.brand.activeSignatureCount).toBe(0);
    expect(ctx.brand.publishedProgramCount).toBe(4);
  });

  it('counts testimonials scoped to the program or to its brand, since programId is nullable', async () => {
    mockRead.program.findUnique.mockResolvedValue({
      id: 'p1', name: 'KYS 2027', brandId: 'b1', bannerUrl: null, description: null,
      registrationOpenDate: null, registrationCloseDate: null, applicationDeadline: null,
    });
    [mockRead.programPricingTier, mockRead.programObjective, mockRead.programFaq,
     mockRead.programGallery, mockRead.programTestimonial].forEach((m) => m.count.mockResolvedValue(0));

    await loader.loadProgram('p1');

    expect(mockRead.programTestimonial.count).toHaveBeenCalledWith({
      where: {
        isActive: true, deletedAt: null,
        OR: [{ programId: 'p1' }, { brandId: 'b1', programId: null }],
      },
    });
  });

  it('throws a NotFoundException for an unknown brand', async () => {
    mockRead.brand.findUnique.mockResolvedValue(null);
    await expect(loader.loadBrand('nope')).rejects.toThrow('Brand nope not found');
  });
});
