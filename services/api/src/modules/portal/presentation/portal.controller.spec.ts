import { Test, TestingModule } from '@nestjs/testing';
import { PortalController } from './portal.controller';
import { QueryBus, CommandBus } from '@nestjs/cqrs';
import { ConfigService } from '@nestjs/config';
import { BadRequestException, NotFoundException, ServiceUnavailableException, UnauthorizedException } from '@nestjs/common';
import { JwtAuthGuard } from '@modules/auth/infrastructure/guards/jwt-auth.guard';
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service';
import { PortalReceiptService } from '../application/services/portal-receipt.service';
import { ConfirmPortalPaymentHandler } from '../application/commands/handlers/confirm-portal-payment.handler';
import { CancelPortalPaymentHandler } from '../application/commands/handlers/cancel-portal-payment.handler';
import { EnsurePortalPaymentInvoiceHandler } from '../application/commands/handlers/ensure-portal-payment-invoice.handler';
import { PaymentServiceHttpClient } from '../../payments/infrastructure/services/payment-service-http.client';
import { LoaDownloadService } from '../application/services/loa-download.service';
import { CacheService } from '@shared/infrastructure/cache/cache.service';
import { PortalCacheService } from '../application/services/portal-cache.service';
import {
  GetPortalDashboardQuery,
  GetPortalSubmissionsQuery,
  GetPortalPaymentsQuery,
  GetPortalDocumentsQuery
} from '../application/queries/portal-queries';

describe('PortalController', () => {
  let controller: PortalController;
  let queryBus: QueryBus;
  let paymentServiceClient: PaymentServiceHttpClient;
  let prismaService: PrismaService;
  let portalCacheService: PortalCacheService;
  let cacheService: CacheService;

  const mockUser = { userId: 'user-123', email: 'test@test.com', brandId: 'brand-id' } as import('@shared/decorators/current-user.decorator').CurrentUserData;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [PortalController],
      providers: [
        { provide: QueryBus, useValue: { execute: jest.fn() } },
        { provide: CommandBus, useValue: { execute: jest.fn() } },
        { provide: ConfirmPortalPaymentHandler, useValue: { execute: jest.fn() } },
        { provide: CancelPortalPaymentHandler, useValue: { execute: jest.fn() } },
        { provide: EnsurePortalPaymentInvoiceHandler, useValue: { execute: jest.fn() } },
        { provide: PaymentServiceHttpClient, useValue: { get: jest.fn() } },
        { provide: ConfigService, useValue: { get: jest.fn() } },
        {
          provide: PrismaService,
          useValue: {
            applicationInvoice: { findUnique: jest.fn() },
            participant: { findUnique: jest.fn().mockResolvedValue(null) },
            participantApplication: { findFirst: jest.fn() },
          },
        },
        { provide: PortalReceiptService, useValue: { generate: jest.fn() } },
        { provide: LoaDownloadService, useValue: { downloadLoa: jest.fn() } },
        {
          provide: CacheService,
          useValue: { get: jest.fn().mockResolvedValue(undefined), set: jest.fn().mockResolvedValue(undefined) },
        },
        {
          provide: PortalCacheService,
          useValue: { getParticipantProfile: jest.fn().mockResolvedValue(null) },
        },
      ],
    })
    .overrideGuard(JwtAuthGuard)
    .useValue({ canActivate: () => true })
    .compile();

    controller = module.get<PortalController>(PortalController);
    queryBus = module.get<QueryBus>(QueryBus);
    paymentServiceClient = module.get<PaymentServiceHttpClient>(PaymentServiceHttpClient);
    prismaService = module.get<PrismaService>(PrismaService);
    portalCacheService = module.get<PortalCacheService>(PortalCacheService);
    cacheService = module.get<CacheService>(CacheService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('getDashboard', () => {
    it('should execute GetPortalDashboardQuery', async () => {
      await controller.getDashboard(mockUser);
      expect(queryBus.execute).toHaveBeenCalledWith(new GetPortalDashboardQuery(mockUser.userId));
    });

    // The MEYS 6th/7th bug: the overview card used a DIFFERENT selection rule
    // than the top-bar program selector because this route never accepted the
    // caller's chosen program at all. Without this, two published programs on
    // one brand contradict each other on the same screen.
    it('forwards the caller-supplied programId', async () => {
      await controller.getDashboard(mockUser, 'program-9');
      expect(queryBus.execute).toHaveBeenCalledWith(
        new GetPortalDashboardQuery(mockUser.userId, 'program-9'),
      );
    });

    it('should throw UnauthorizedException if no user', async () => {
      await expect(controller.getDashboard({} as unknown as import('@shared/decorators/current-user.decorator').CurrentUserData)).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('getSubmissions', () => {
    it('should execute GetPortalSubmissionsQuery', async () => {
      await controller.getSubmissions(mockUser);
      expect(queryBus.execute).toHaveBeenCalledWith(new GetPortalSubmissionsQuery(mockUser.userId));
    });
  });

  describe('getPayments', () => {
    it('should execute GetPortalPaymentsQuery', async () => {
      await controller.getPayments(mockUser);
      expect(queryBus.execute).toHaveBeenCalledWith(new GetPortalPaymentsQuery(mockUser.userId));
    });
  });

  describe('getPaymentMethods', () => {
    // Regression for M67: an unconfigured brand and a downed payment service
    // used to be indistinguishable — both returned []. This pins that a
    // downstream failure now surfaces as a 503, not a silent empty list.
    it('throws ServiceUnavailableException instead of returning [] when the payment service call fails', async () => {
      (paymentServiceClient.get as jest.Mock).mockRejectedValueOnce(new Error('payment-service unreachable'));

      await expect(controller.getPaymentMethods(mockUser)).rejects.toBeInstanceOf(
        ServiceUnavailableException,
      );
    });

    // Audit M47: ?programId= used to reach the payment-service call completely
    // unvalidated and unscoped to the caller. These three pin the fix: shape
    // validation, ownership validation, and that a legitimate caller with a
    // real application in that programme still gets through.
    describe('M47: programId validation and ownership scoping', () => {
      it('rejects a non-UUID programId before ever calling the payment service', async () => {
        await expect(
          controller.getPaymentMethods(mockUser, 'not-a-uuid; DROP TABLE'),
        ).rejects.toBeInstanceOf(BadRequestException);

        expect(paymentServiceClient.get).not.toHaveBeenCalled();
      });

      it('rejects a well-formed UUID the caller has no application in', async () => {
        const foreignProgramId = '11111111-1111-4111-8111-111111111111';
        (portalCacheService.getParticipantProfile as jest.Mock).mockResolvedValueOnce({ id: 'participant-1' });
        (prismaService.participantApplication.findFirst as jest.Mock).mockResolvedValueOnce(null);

        await expect(
          controller.getPaymentMethods(mockUser, foreignProgramId),
        ).rejects.toBeInstanceOf(NotFoundException);

        expect(paymentServiceClient.get).not.toHaveBeenCalled();
      });

      it('allows a well-formed UUID the caller DOES have an application in, and encodes it into the upstream url', async () => {
        const ownProgramId = '22222222-2222-4222-8222-222222222222';
        (portalCacheService.getParticipantProfile as jest.Mock).mockResolvedValueOnce({ id: 'participant-1' });
        (prismaService.participantApplication.findFirst as jest.Mock).mockResolvedValueOnce({ id: 'app-1' });
        (paymentServiceClient.get as jest.Mock).mockResolvedValueOnce({ data: [] });

        await controller.getPaymentMethods(mockUser, ownProgramId);

        expect(paymentServiceClient.get).toHaveBeenCalledWith(
          `/api/v1/programs/${ownProgramId}/payment-methods`,
          expect.anything(),
        );
      });
    });

    // Audit M50: the route had no cache at all. These pin that it now reads
    // through CacheService before ever calling the payment service, and that
    // a cache hit skips the network call entirely.
    describe('M50: caching', () => {
      it('returns a cached global payment-methods response without calling the payment service', async () => {
        const cachedResult = [{ id: 'pm-1', code: 'manual_transfer' }];
        (cacheService.get as jest.Mock).mockResolvedValueOnce(cachedResult);

        const result = await controller.getPaymentMethods(mockUser);

        expect(result).toBe(cachedResult);
        expect(paymentServiceClient.get).not.toHaveBeenCalled();
      });

      it('caches the global payment-methods response on a miss', async () => {
        (paymentServiceClient.get as jest.Mock).mockResolvedValueOnce({ data: [] });

        await controller.getPaymentMethods(mockUser);

        expect(cacheService.set).toHaveBeenCalledWith(
          expect.any(String),
          expect.anything(),
          expect.any(Number),
        );
      });

      it('returns a cached program-scoped payment-methods response without calling the payment service', async () => {
        const ownProgramId = '22222222-2222-4222-8222-222222222222';
        const cachedResult = [{ id: 'pm-2', code: 'manual_transfer' }];
        (portalCacheService.getParticipantProfile as jest.Mock).mockResolvedValueOnce({ id: 'participant-1' });
        (prismaService.participantApplication.findFirst as jest.Mock).mockResolvedValueOnce({ id: 'app-1' });
        (cacheService.get as jest.Mock).mockResolvedValueOnce(cachedResult);

        const result = await controller.getPaymentMethods(mockUser, ownProgramId);

        expect(result).toBe(cachedResult);
        expect(paymentServiceClient.get).not.toHaveBeenCalled();
      });
    });
  });

  describe('getDocuments', () => {
    it('should execute GetPortalDocumentsQuery', async () => {
      await controller.getDocuments(mockUser);
      expect(queryBus.execute).toHaveBeenCalledWith(
        new GetPortalDocumentsQuery(mockUser.userId, undefined, mockUser.brandId),
      );
    });

    // The programme the portal is showing, and the caller's brand, both have to
    // reach the handler: the brand is what makes `downloadable` agree with what
    // the download endpoint will actually do.
    it('forwards the caller-supplied programId and the caller\'s brand', async () => {
      await controller.getDocuments(mockUser, 'program-9');
      expect(queryBus.execute).toHaveBeenCalledWith(
        new GetPortalDocumentsQuery(mockUser.userId, 'program-9', mockUser.brandId),
      );
    });
  });

  // M44: a WeasyPrint render is expensive (subprocess + font/layout work per call),
  // and both PDF routes previously relied on nothing but the global 20 rps throttle.
  // Asserts the actual @nestjs/throttler metadata, not just that a decorator was
  // typed somewhere - a decorator with the wrong arg shape leaves this metadata unset.
  describe('PDF download throttling (M44)', () => {
    const THROTTLER_LIMIT = 'THROTTLER:LIMIT';
    const THROTTLER_TTL = 'THROTTLER:TTL';

    it.each([
      ['downloadReceipt', 'receipt'],
      ['downloadInvoice', 'invoice'],
    ])('%s carries the same per-route throttle as loa/download (limit 5 / 60s)', (methodName) => {
      const handler = (controller as unknown as Record<string, (...args: unknown[]) => unknown>)[methodName];

      expect(Reflect.getMetadata(THROTTLER_LIMIT + 'default', handler)).toBe(5);
      expect(Reflect.getMetadata(THROTTLER_TTL + 'default', handler)).toBe(60000);
    });

    it('matches the limit already enforced on loa/download, so the two do not silently drift apart', () => {
      const asMap = controller as unknown as Record<string, (...args: unknown[]) => unknown>;

      expect(Reflect.getMetadata(THROTTLER_LIMIT + 'default', asMap.downloadReceipt)).toBe(
        Reflect.getMetadata(THROTTLER_LIMIT + 'default', asMap.downloadLoa),
      );
      expect(Reflect.getMetadata(THROTTLER_TTL + 'default', asMap.downloadInvoice)).toBe(
        Reflect.getMetadata(THROTTLER_TTL + 'default', asMap.downloadLoa),
      );
    });
  });
});
