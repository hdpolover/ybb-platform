import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { SwitchApplicationCategoryHandler } from './switch-application-category.handler';
import { SwitchApplicationCategoryCommand } from '../switch-application-category.command';
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service';
import { CacheService } from '@shared/infrastructure/cache/cache.service';
import { ApplicationMapper } from '@modules/applications/infrastructure/mappers/application.mapper';
import { ApplicationCategory } from '@core/entities/participant-application.entity';

describe('SwitchApplicationCategoryHandler', () => {
  let handler: SwitchApplicationCategoryHandler;

  const mockPrisma = {
    participantApplication: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    applicationInvoice: {
      updateMany: jest.fn(),
    },
    participant: {
      findUnique: jest.fn(),
    },
    $transaction: jest.fn(),
  };

  const mockCacheService = {
    invalidateKeys: jest.fn().mockResolvedValue(undefined),
    invalidateByPatterns: jest.fn().mockResolvedValue(undefined),
  };

  const mockApplicationMapper = {
    toDomain: jest.fn((app: unknown) => app),
    toDto: jest.fn((app: unknown) => app),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SwitchApplicationCategoryHandler,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: CacheService, useValue: mockCacheService },
        { provide: ApplicationMapper, useValue: mockApplicationMapper },
      ],
    }).compile();

    handler = module.get<SwitchApplicationCategoryHandler>(SwitchApplicationCategoryHandler);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  const buildApplication = (
    ffValidityPeriods: { startDate: Date; endDate: Date }[],
  ) => ({
    id: 'app-1',
    status: 'draft',
    applicationCategory: 'self_funded',
    participantId: 'p-1',
    registrationPaymentStatus: 'unpaid',
    invoices: [],
    participant: { userId: 'u-1' },
    program: {
      pricingTiers: [
        {
          id: 'tier-sf',
          isActive: true,
          deletedAt: null,
          feeType: 'registration_fee',
          allowedCategories: ['self_funded'],
          validityPeriods: [],
        },
        {
          id: 'tier-ff',
          isActive: true,
          deletedAt: null,
          feeType: 'registration_fee',
          allowedCategories: ['fully_funded'],
          validityPeriods: ffValidityPeriods,
        },
      ],
    },
  });

  it('throws FULLY_FUNDED_REGISTRATION_CLOSED when switching to fully_funded after all FF windows ended', async () => {
    mockPrisma.participantApplication.findUnique.mockResolvedValue(
      buildApplication([
        {
          startDate: new Date(Date.now() - 2 * 86400000),
          endDate: new Date(Date.now() - 86400000), // ended yesterday
        },
      ]),
    );

    const command = new SwitchApplicationCategoryCommand(
      'app-1',
      'fully_funded' as ApplicationCategory,
      'u-1',
    );

    expect.assertions(2);
    try {
      await handler.execute(command);
    } catch (error) {
      expect(error).toBeInstanceOf(BadRequestException);
      const response = (error as BadRequestException).getResponse();
      expect(response).toMatchObject({
        message: 'Fully Funded registration has closed.',
        errorCode: 'FULLY_FUNDED_REGISTRATION_CLOSED',
      });
    }
  });

  it('allows switching to fully_funded when an FF window is still active', async () => {
    mockPrisma.participantApplication.findUnique.mockResolvedValue(
      buildApplication([
        {
          startDate: new Date(Date.now() - 86400000),
          endDate: new Date(Date.now() + 86400000), // ends tomorrow
        },
      ]),
    );
    mockPrisma.$transaction.mockImplementation(async (cb: (tx: typeof mockPrisma) => unknown) =>
      cb(mockPrisma),
    );
    mockPrisma.participantApplication.update.mockResolvedValue({
      id: 'app-1',
      applicationCategory: 'fully_funded',
    });

    const command = new SwitchApplicationCategoryCommand(
      'app-1',
      'fully_funded' as ApplicationCategory,
      'u-1',
    );

    await expect(handler.execute(command)).resolves.toBeDefined();
    expect(mockPrisma.participantApplication.update).toHaveBeenCalled();
  });
});
