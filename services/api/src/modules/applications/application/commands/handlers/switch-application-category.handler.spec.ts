import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { SwitchApplicationCategoryHandler } from './switch-application-category.handler';
import { SwitchApplicationCategoryCommand } from '../switch-application-category.command';
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service';
import { CacheService } from '@shared/infrastructure/cache/cache.service';
import { ApplicationMapper } from '@modules/applications/infrastructure/mappers/application.mapper';
import { ApplicationCategory } from '@core/entities/participant-application.entity';
import { makePrismaTxMock, expectNoOuterWrites } from '@test/utils/prisma-tx-mock';
import { PaymentStatus } from '@prisma/client';

describe('SwitchApplicationCategoryHandler', () => {
  let handler: SwitchApplicationCategoryHandler;

  // Disjoint prisma/tx mocks: `update`/`updateMany` live ONLY on `mockTx`, so a
  // regression that moves the switch+auto-cancel writes outside the
  // `$transaction` callback (onto `mockPrisma` instead) is caught by the
  // `expectNoOuterWrites(mockPrisma)` guard below, rather than passing
  // identically either way.
  const { prisma: mockPrisma, tx: mockTx } = makePrismaTxMock(
    {
      participantApplication: {
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      participant: {
        findUnique: jest.fn(),
      },
      applicationInvoice: {
        updateMany: jest.fn(),
      },
    },
    {
      participantApplication: {
        update: jest.fn(),
      },
      applicationInvoice: {
        updateMany: jest.fn(),
      },
    },
  );

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

  const paidApplication = () => ({
    ...buildApplication([
      { startDate: new Date(Date.now() - 86400000), endDate: new Date(Date.now() + 86400000) },
    ]),
    registrationPaymentStatus: 'paid',
  });

  it('rejects an admin switching a paid application without a reason', async () => {
    mockPrisma.participantApplication.findUnique.mockResolvedValue(paidApplication());

    await expect(
      handler.execute(
        new SwitchApplicationCategoryCommand(
          'app-1',
          'fully_funded' as ApplicationCategory,
          'admin-user',
          'admin-1',
        ),
      ),
    ).rejects.toThrow(BadRequestException);
  });

  it('lets an admin switch someone else\'s paid application when a reason is given', async () => {
    mockPrisma.participantApplication.findUnique.mockResolvedValue(paidApplication());
    mockTx.participantApplication.update.mockResolvedValue({ id: 'app-1', applicationCategory: 'fully_funded' });

    await handler.execute(
      new SwitchApplicationCategoryCommand(
        'app-1',
        'fully_funded' as ApplicationCategory,
        'admin-user',
        'admin-1',
        'Registered Self Funded by mistake',
      ),
    );

    expect(mockTx.participantApplication.update).toHaveBeenCalled();
  });

  it('still refuses a participant acting on an application that is not theirs', async () => {
    mockPrisma.participantApplication.findUnique.mockResolvedValue(
      buildApplication([{ startDate: new Date(Date.now() - 86400000), endDate: new Date(Date.now() + 86400000) }]),
    );

    await expect(
      handler.execute(
        new SwitchApplicationCategoryCommand('app-1', 'fully_funded' as ApplicationCategory, 'someone-else'),
      ),
    ).rejects.toThrow();
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
    mockTx.participantApplication.update.mockResolvedValue({
      id: 'app-1',
      applicationCategory: 'fully_funded',
    });

    const command = new SwitchApplicationCategoryCommand(
      'app-1',
      'fully_funded' as ApplicationCategory,
      'u-1',
    );

    await expect(handler.execute(command)).resolves.toBeDefined();
    // The switch write must go through the transaction client...
    expect(mockTx.participantApplication.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'app-1' },
        data: expect.objectContaining({ applicationCategory: 'fully_funded' }),
      }),
    );
    // ...and never leak onto the outer (non-transactional) prisma client. If it
    // did, a mid-transaction failure could leave cancelled invoices under a
    // category the participant never actually switched to, or vice versa.
    expectNoOuterWrites(mockPrisma);
  });

  it('auto-cancels unpaid invoices atomically with the category switch, inside the same transaction', async () => {
    const application = buildApplication([
      {
        startDate: new Date(Date.now() - 86400000),
        endDate: new Date(Date.now() + 86400000), // ends tomorrow
      },
    ]);
    mockPrisma.participantApplication.findUnique.mockResolvedValue({
      ...application,
      invoices: [
        { id: 'inv-1', status: 'unpaid', pricingTier: { feeType: 'registration_fee' } },
      ],
    });
    mockTx.participantApplication.update.mockResolvedValue({
      id: 'app-1',
      applicationCategory: 'fully_funded',
    });

    const command = new SwitchApplicationCategoryCommand(
      'app-1',
      'fully_funded' as ApplicationCategory,
      'u-1',
    );

    await handler.execute(command);

    expect(mockTx.applicationInvoice.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        // The status predicate is the point (audit M110): filtering for `unpaid`
        // in memory scoped the cancel to a snapshot read earlier in the request,
        // so a payment settling mid-request was flipped to `cancelled` with the
        // money already taken. The database has to enforce it.
        where: { id: { in: ['inv-1'] }, status: PaymentStatus.unpaid },
        data: { status: 'cancelled' },
      }),
    );
    // Same non-atomicity concern as above, for the auto-cancel side.
    expectNoOuterWrites(mockPrisma);
  });

  describe('admin exception: submitted / fully-funded-window-closed overrides', () => {
    const submittedPaidApplication = (overrides: Record<string, unknown> = {}) => ({
      ...buildApplication([
        {
          startDate: new Date(Date.now() - 2 * 86400000),
          endDate: new Date(Date.now() - 86400000), // FF window closed
        },
      ]),
      status: 'submitted',
      applicationCategory: 'self_funded',
      registrationPaymentStatus: 'paid',
      statusHistory: [],
      ...overrides,
    });

    it('lets an admin with overrideReason switch a SUBMITTED application: status unchanged, category changed, status_history appended', async () => {
      mockPrisma.participantApplication.findUnique.mockResolvedValue(submittedPaidApplication());
      mockTx.participantApplication.update.mockResolvedValue({
        id: 'app-1',
        status: 'submitted',
        applicationCategory: 'fully_funded',
      });

      await handler.execute(
        new SwitchApplicationCategoryCommand(
          'app-1',
          'fully_funded' as ApplicationCategory,
          'admin-user',
          'admin-1',
          'Participant paid self-funded but should be fully-funded',
        ),
      );

      expect(mockTx.participantApplication.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'app-1' },
          data: expect.objectContaining({
            applicationCategory: 'fully_funded',
            statusHistory: [
              expect.objectContaining({
                status: 'submitted',
                changedBy: 'admin-1',
                reason:
                  'Category changed self_funded → fully_funded by admin: Participant paid self-funded but should be fully-funded',
              }),
            ],
          }),
        }),
      );
      // The update must never touch `status` itself.
      const callArgs = mockTx.participantApplication.update.mock.calls[0][0];
      expect(callArgs.data.status).toBeUndefined();
    });

    it('lets an admin with overrideReason switch INTO fully_funded while the window is closed', async () => {
      mockPrisma.participantApplication.findUnique.mockResolvedValue(submittedPaidApplication());
      mockTx.participantApplication.update.mockResolvedValue({
        id: 'app-1',
        applicationCategory: 'fully_funded',
      });

      await expect(
        handler.execute(
          new SwitchApplicationCategoryCommand(
            'app-1',
            'fully_funded' as ApplicationCategory,
            'admin-user',
            'admin-1',
            'Window closed but approved manually',
          ),
        ),
      ).resolves.toBeDefined();
    });

    it('still 400s an admin WITHOUT overrideReason on a submitted application (no accidental full bypass)', async () => {
      mockPrisma.participantApplication.findUnique.mockResolvedValue(submittedPaidApplication());

      await expect(
        handler.execute(
          new SwitchApplicationCategoryCommand(
            'app-1',
            'fully_funded' as ApplicationCategory,
            'admin-user',
            'admin-1',
            // no overrideReason
          ),
        ),
      ).rejects.toThrow(BadRequestException);
      expect(mockTx.participantApplication.update).not.toHaveBeenCalled();
    });

    it('still 400s a participant (non-admin) acting on a submitted application', async () => {
      mockPrisma.participantApplication.findUnique.mockResolvedValue(
        submittedPaidApplication({ registrationPaymentStatus: 'unpaid' }),
      );

      await expect(
        handler.execute(
          new SwitchApplicationCategoryCommand(
            'app-1',
            'fully_funded' as ApplicationCategory,
            'u-1',
            undefined,
            'I want to switch', // a reason with no actingAdminId must not bypass anything
          ),
        ),
      ).rejects.toThrow(BadRequestException);
      expect(mockTx.participantApplication.update).not.toHaveBeenCalled();
    });

    it('still blocks a participant switching into fully_funded while the window is closed', async () => {
      const draftApplication = {
        ...buildApplication([
          {
            startDate: new Date(Date.now() - 2 * 86400000),
            endDate: new Date(Date.now() - 86400000), // FF window closed
          },
        ]),
        status: 'draft',
      };
      mockPrisma.participantApplication.findUnique.mockResolvedValue(draftApplication);

      expect.assertions(3);
      try {
        await handler.execute(
          new SwitchApplicationCategoryCommand('app-1', 'fully_funded' as ApplicationCategory, 'u-1'),
        );
      } catch (error) {
        expect(error).toBeInstanceOf(BadRequestException);
        const response = (error as BadRequestException).getResponse();
        expect(response).toMatchObject({ errorCode: 'FULLY_FUNDED_REGISTRATION_CLOSED' });
      }
      expect(mockTx.participantApplication.update).not.toHaveBeenCalled();
    });

    it('rejects the admin exception on a WITHDRAWN application even with overrideReason', async () => {
      mockPrisma.participantApplication.findUnique.mockResolvedValue(
        submittedPaidApplication({ status: 'withdrawn' }),
      );

      await expect(
        handler.execute(
          new SwitchApplicationCategoryCommand(
            'app-1',
            'fully_funded' as ApplicationCategory,
            'admin-user',
            'admin-1',
            'Trying anyway',
          ),
        ),
      ).rejects.toThrow(BadRequestException);
      expect(mockTx.participantApplication.update).not.toHaveBeenCalled();
    });

    it('leaves a paid invoice untouched by the switch', async () => {
      mockPrisma.participantApplication.findUnique.mockResolvedValue({
        ...submittedPaidApplication(),
        invoices: [
          { id: 'inv-paid', status: 'paid', pricingTier: { feeType: 'registration_fee' } },
        ],
      });
      mockTx.participantApplication.update.mockResolvedValue({
        id: 'app-1',
        applicationCategory: 'fully_funded',
      });

      await handler.execute(
        new SwitchApplicationCategoryCommand(
          'app-1',
          'fully_funded' as ApplicationCategory,
          'admin-user',
          'admin-1',
          'Fix miscategorised paid applicant',
        ),
      );

      // Only `unpaid` invoices are ever passed to the cancel updateMany; a
      // paid invoice must never appear in its `id: { in: [...] }` filter.
      expect(mockTx.applicationInvoice.updateMany).not.toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ id: { in: expect.arrayContaining(['inv-paid']) } }),
        }),
      );
    });
  });
});
