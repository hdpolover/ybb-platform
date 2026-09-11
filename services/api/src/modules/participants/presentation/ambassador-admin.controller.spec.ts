
import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { AmbassadorAdminController } from './ambassador-admin.controller';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import { JwtAuthGuard } from '@modules/auth/infrastructure/guards/jwt-auth.guard';
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service';
import { RabbitMQProducerService } from '@shared/infrastructure/rabbitmq/rabbitmq-producer.service';
import { ConfigService } from '@nestjs/config';
import { GetAmbassadorsListQuery, UpdateAmbassadorStatusCommand } from '../application/commands/ambassador-admin.commands';
import { PrismaReadService } from '@shared/infrastructure/prisma/prisma-read.service';

describe('AmbassadorAdminController', () => {
  let controller: AmbassadorAdminController;
  let commandBus: CommandBus;
  let queryBus: QueryBus;

  const mockCommandBus = { execute: jest.fn() };
  const mockQueryBus = { execute: jest.fn() };
  const mockPrismaService = {
    ambassador: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    ambassadorReferral: { findMany: jest.fn() },
    program: { findUnique: jest.fn() },
    user: { findFirst: jest.fn(), create: jest.fn() },
  };

  // A platform-scope admin, so these existing tests keep testing what they were
  // written to test. The scope logic itself is covered in
  // ambassador-access.util.spec.ts, with every scope kind.
  const platformActor = { userId: 'u', email: 'a@b.c', brandId: 'b', adminId: 'adm-1' } as never;
  const mockPrismaRead = {
    admin: {
      findUnique: jest.fn().mockResolvedValue({
        accessLevel: 5,
        canManageAdmins: true,
        canAssignRoles: true,
        customPermissions: [],
        role: { name: 'super_admin', permissions: ['platform_access'] },
        adminBrands: [],
        adminPrograms: [],
      }),
    },
    program: { findMany: jest.fn().mockResolvedValue([]), findUnique: jest.fn() },
    ambassador: { findFirst: jest.fn() },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AmbassadorAdminController],
      providers: [
        { provide: CommandBus, useValue: mockCommandBus },
        { provide: QueryBus, useValue: mockQueryBus },
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: RabbitMQProducerService, useValue: { emit: jest.fn() } },
        { provide: ConfigService, useValue: { get: jest.fn().mockReturnValue('') } },
        { provide: PrismaReadService, useValue: mockPrismaRead },
      ],
    })
    .overrideGuard(JwtAuthGuard)
    .useValue({ canActivate: () => true })
    .compile();

    controller = module.get<AmbassadorAdminController>(AmbassadorAdminController);
    commandBus = module.get<CommandBus>(CommandBus);
    queryBus = module.get<QueryBus>(QueryBus);
    
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('findAll', () => {
    it('should execute GetAmbassadorsListQuery', async () => {
      await controller.findAll(platformActor, 'prog-1', 'search-term', 2);
      expect(mockQueryBus.execute).toHaveBeenCalledWith(expect.any(GetAmbassadorsListQuery));
      const query = mockQueryBus.execute.mock.calls[0][0];
      expect(query.programId).toBe('prog-1');
      expect(query.search).toBe('search-term');
      expect(query.page).toBe(2);
    });
  });

  describe('activate', () => {
      it('should execute UpdateAmbassadorStatusCommand with isActive=true', async () => {
          await controller.activate('amb-1', platformActor);
          expect(mockCommandBus.execute).toHaveBeenCalledWith(expect.any(UpdateAmbassadorStatusCommand));
          const cmd = mockCommandBus.execute.mock.calls[0][0];
          expect(cmd.ambassadorId).toBe('amb-1');
          expect(cmd.isActive).toBe(true);
      });
  });

  describe('deactivate', () => {
    it('should execute UpdateAmbassadorStatusCommand with isActive=false', async () => {
        await controller.deactivate('amb-1', platformActor);
        expect(mockCommandBus.execute).toHaveBeenCalledWith(expect.any(UpdateAmbassadorStatusCommand));
        const cmd = mockCommandBus.execute.mock.calls[0][0];
        expect(cmd.ambassadorId).toBe('amb-1');
        expect(cmd.isActive).toBe(false);
    });
});

  describe('findOne', () => {
    // createAmbassadorShareToken() (called unconditionally inside findOne)
    // needs a real secret from the environment — same pattern used by
    // get-ambassador-dashboard.handler.spec.ts.
    const previousShareTokenSecret = process.env.AMBASSADOR_SHARE_TOKEN_SECRET;

    beforeAll(() => {
      process.env.AMBASSADOR_SHARE_TOKEN_SECRET = 'test-secret-for-ambassador-detail-spec';
    });

    afterAll(() => {
      process.env.AMBASSADOR_SHARE_TOKEN_SECRET = previousShareTokenSecret;
    });

    const baseAmbassador = {
      // createAmbassadorShareToken() needs 32 hex chars once dashes are
      // stripped, unlike the 'amb-1' route param used elsewhere in this
      // spec, so a real UUID shape is required here.
      id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
      program: {
        id: 'prog-1',
        name: 'Test Program',
        slug: 'test-program',
        brand: { websiteUrl: 'https://ybb.co' },
      },
    };

    // WIB is UTC+7 — 2026-07-30T16:30:00Z is 2026-07-30T23:30:00+07:00, i.e.
    // 23:30 WIB on the last day of a `to=2026-07-30` window.
    const lastDayAt2330Wib = new Date('2026-07-30T16:30:00.000Z');

    const multiStageReferral = {
      status: 'accepted',
      totalConversionDays: 10,
      programId: 'prog-1',
      program: { name: 'Test Program' },
      referredAt: new Date('2026-07-01T01:00:00.000Z'),
      registeredAt: new Date('2026-07-02T01:00:00.000Z'),
      appliedAt: lastDayAt2330Wib,
      acceptedAt: new Date('2026-08-05T01:00:00.000Z'), // outside the July window
      completedAt: null,
    };

    beforeEach(() => {
      mockPrismaService.ambassador.findFirst.mockResolvedValue(baseAmbassador);
    });

    it('returns statusCounts/statusCountsByProgram unchanged and omits reachedCounts when no from/to is supplied', async () => {
      mockPrismaService.ambassadorReferral.findMany.mockResolvedValue([multiStageReferral]);

      const result = await controller.findOne('amb-1', platformActor, {});

      expect(result.analytics.statusCounts).toEqual({
        referred: 0,
        registered: 0,
        applied: 0,
        accepted: 1,
        completed: 0,
      });
      expect(result.analytics.statusCountsByProgram).toEqual([
        { programId: 'prog-1', programName: 'Test Program', referred: 0, registered: 0, applied: 0, accepted: 1, completed: 0 },
      ]);
      expect(result.analytics).not.toHaveProperty('reachedCounts');
      expect(result.analytics).not.toHaveProperty('reachedCountsByProgram');
    });

    it('counts a referral in every stage bucket it reached within the window, and inclusively through 23:59:59.999 WIB on `to`', async () => {
      mockPrismaService.ambassadorReferral.findMany.mockResolvedValue([multiStageReferral]);

      const result = await controller.findOne('amb-1', platformActor, { from: '2026-07-01', to: '2026-07-30' });

      // referred, registered and applied (23:30 WIB on the `to` day) all fall
      // inside the window; acceptedAt is in August so it must not count, and
      // completedAt is null so it never counts.
      expect(result.analytics.reachedCounts).toEqual({
        referred: 1,
        registered: 1,
        applied: 1,
        accepted: 0,
        completed: 0,
      });
      expect(result.analytics.reachedCountsByProgram).toEqual([
        { programId: 'prog-1', programName: 'Test Program', referred: 1, registered: 1, applied: 1, accepted: 0, completed: 0 },
      ]);
    });

    it('never counts a stage whose own timestamp is null', async () => {
      mockPrismaService.ambassadorReferral.findMany.mockResolvedValue([multiStageReferral]);

      // A window wide enough to cover every non-null timestamp above.
      const result = await controller.findOne('amb-1', platformActor, { from: '2026-01-01', to: '2026-12-31' });

      expect(result.analytics.reachedCounts?.completed).toBe(0);
    });

    // Unparseable from/to date STRINGS never reach this handler at all: the
    // global ValidationPipe rejects them against AmbassadorReferralAnalyticsQueryDto's
    // @IsDateString() before the controller method runs. That is covered directly
    // against the DTO in ambassador-admin.dto.spec.ts ("rejects an unparseable
    // from/to date"). What the handler itself is responsible for is the
    // cross-field from > to check, which a single-field decorator can't express.
    it('rejects from later than to with a validation error', async () => {
      mockPrismaService.ambassadorReferral.findMany.mockResolvedValue([]);

      await expect(controller.findOne('amb-1', platformActor, { from: '2026-07-30', to: '2026-07-01' })).rejects.toThrow(BadRequestException);
    });
  });
});
