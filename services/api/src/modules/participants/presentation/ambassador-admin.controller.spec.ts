
import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, ForbiddenException } from '@nestjs/common';
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
    program: { findMany: jest.fn().mockResolvedValue([]), findUnique: jest.fn(), findFirst: jest.fn() },
    ambassador: { findFirst: jest.fn() },
    $queryRaw: jest.fn(),
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

  describe('getRecap', () => {
    // A valid-uuid-shaped id so the isUuid regex short-circuits straight to
    // resolvedProgramId, skipping the slug lookup path (exercised by its own
    // test below).
    const programId = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';

    // 'assigned' scope, mirroring how resolveAmbassadorProgramScope resolves
    // an admin with no brand grants and one explicit program assignment (see
    // getAdminProgramAccessScope: accessLevel < 5, no platform permissions,
    // adminBrands empty -> 'assigned').
    const assignedActor = { userId: 'u2', email: 'scoped@b.c', brandId: 'b', adminId: 'adm-2' } as never;
    const assignedAdminRecord = (allowedProgramId: string) => ({
      accessLevel: 1,
      canManageAdmins: false,
      canAssignRoles: false,
      customPermissions: [],
      role: { name: 'admin', permissions: [] },
      adminBrands: [],
      adminPrograms: [{ programId: allowedProgramId }],
    });

    const extractSql = (callIndex = 0): { text: string; values: unknown[] } => {
      const [strings, ...values] = mockPrismaRead.$queryRaw.mock.calls[callIndex];
      return { text: (strings as string[]).join(''), values };
    };

    beforeEach(() => {
      mockPrismaRead.$queryRaw.mockResolvedValue([]);
    });

    // An ambassador's Ambassador.programId is only their HOME programme. The
    // schema doc comment is explicit that a brand-wide code produces a referral
    // row per programme a participant applies to, and that per-programme reads
    // must key on referral.programId. Selecting recap rows by home programme
    // alone drops an ambassador based elsewhere who brought participants INTO
    // this programme — their referrals are attributed here and counted nowhere,
    // so the recap under-reports a partner with no error anywhere. Production
    // has zero cross-programme referrals today, which is precisely why this
    // needs a test rather than a manual check.
    it('includes ambassadors from other home programmes who have referrals attributed to this one', async () => {
      await controller.getRecap(platformActor, { programId });

      const { text } = extractSql();
      // Home-programme membership alone is not the row set: there must also be
      // an existence check against referrals attributed to this programme.
      expect(text).toContain('UNION');
      expect(text).toMatch(/EXISTS\s*\(/);
      expect(text).toMatch(/FROM\s+ambassador_referrals\s+r/);
      expect(text).toMatch(/r\.program_id\s*=/);
    });

    it('rejects a programme outside the caller scope, and never runs the recap query', async () => {
      mockPrismaRead.admin.findUnique.mockResolvedValueOnce(assignedAdminRecord('some-other-program-id'));

      await expect(
        controller.getRecap(assignedActor, { programId }),
      ).rejects.toThrow(ForbiddenException);
      expect(mockPrismaRead.$queryRaw).not.toHaveBeenCalled();
    });

    it('allows a programme inside the caller scope', async () => {
      mockPrismaRead.admin.findUnique.mockResolvedValueOnce(assignedAdminRecord(programId));

      const result = await controller.getRecap(assignedActor, { programId });

      expect(mockPrismaRead.$queryRaw).toHaveBeenCalledTimes(1);
      expect(result.stage).toBe('applied');
    });

    it('resolves a slug programId the same way findAll does, via program.findFirst', async () => {
      mockPrismaRead.program.findFirst.mockResolvedValueOnce({ id: programId });

      await controller.getRecap(platformActor, { programId: 'meys-7th' });

      expect(mockPrismaRead.program.findFirst).toHaveBeenCalledWith({ where: { slug: 'meys-7th' }, select: { id: true } });
      const { values } = extractSql();
      // resolvedProgramId (not the slug) is what reaches the query.
      expect(values[1]).toBe(programId);
    });

    it('404s when the slug does not resolve to any programme', async () => {
      mockPrismaRead.program.findFirst.mockResolvedValueOnce(null);

      await expect(controller.getRecap(platformActor, { programId: 'no-such-slug' })).rejects.toThrow('Program not found');
    });

    it('rejects from later than to before running any query', async () => {
      await expect(
        controller.getRecap(platformActor, { programId, from: '2026-07-30', to: '2026-07-01' }),
      ).rejects.toThrow(BadRequestException);
      expect(mockPrismaRead.$queryRaw).not.toHaveBeenCalled();
    });

    it('defaults to the last 6 WIB calendar months ending with the current one', async () => {
      await controller.getRecap(platformActor, { programId });

      const { values } = extractSql();
      const monthKeys = values[0] as string[];
      expect(monthKeys).toHaveLength(6);

      const now = new Date();
      const currentKey = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`;
      // Loose check tolerant of the WIB offset shifting the calendar day
      // (never the month, seven hours can't cross a month boundary except
      // right at 1st/last-day edges) — the meaningful assertion is the
      // window is 6 long and ends at "now"'s month.
      expect(monthKeys[5].slice(0, 4)).toBe(currentKey.slice(0, 4));
    });

    it('builds exactly the calendar months spanning an explicit from/to', async () => {
      await controller.getRecap(platformActor, { programId, from: '2026-07-01', to: '2026-09-15' });

      const { values } = extractSql();
      expect(values[0]).toEqual(['2026-07', '2026-08', '2026-09']);
    });

    it('maps the requested stage to its hardcoded timestamp column, never the raw query value', async () => {
      await controller.getRecap(platformActor, { programId, stage: 'completed' });

      const { text, values } = extractSql();
      expect(text).toContain('IS NOT NULL');
      const rawColumns = values
        .filter((value): value is { strings: string[] } => typeof value === 'object' && value !== null && 'strings' in value)
        .map((value) => value.strings[0]);
      expect(rawColumns.length).toBeGreaterThan(0);
      expect(rawColumns.every((column) => column === 'completed_at')).toBe(true);
    });

    it('rolls up rows into per-ambassador shape, fills zeros, and sums totals from the SQL rows', async () => {
      mockPrismaRead.$queryRaw.mockResolvedValueOnce([
        { ambassadorId: 'amb-a', ambassadorName: 'Amber Ali', referralCode: 'AMB1', monthKey: '2026-07', count: 3 },
        { ambassadorId: 'amb-a', ambassadorName: 'Amber Ali', referralCode: 'AMB1', monthKey: '2026-08', count: 2 },
        // amb-b has zero referrals across the whole window — the SQL's
        // CROSS JOIN guarantees this row exists rather than being absent.
        { ambassadorId: 'amb-b', ambassadorName: 'Budi Santoso', referralCode: 'AMB2', monthKey: '2026-07', count: 0 },
        { ambassadorId: 'amb-b', ambassadorName: 'Budi Santoso', referralCode: 'AMB2', monthKey: '2026-08', count: 0 },
      ]);

      const result = await controller.getRecap(platformActor, { programId, from: '2026-07-01', to: '2026-08-31' });

      expect(result.months.map((m) => m.key)).toEqual(['2026-07', '2026-08']);

      const budi = result.rows.find((row) => row.ambassadorId === 'amb-b');
      expect(budi?.counts).toEqual({ '2026-07': 0, '2026-08': 0 });
      expect(budi?.total).toBe(0);

      const amber = result.rows.find((row) => row.ambassadorId === 'amb-a');
      expect(amber?.counts).toEqual({ '2026-07': 3, '2026-08': 2 });
      expect(amber?.total).toBe(5);

      // Rows sorted by name — Amber before Budi.
      expect(result.rows.map((row) => row.ambassadorId)).toEqual(['amb-a', 'amb-b']);

      expect(result.totals.byMonth).toEqual({ '2026-07': 3, '2026-08': 2 });
      expect(result.totals.total).toBe(5);
      // Totals must equal the sum of every row's own total.
      const rowSum = result.rows.reduce((sum, row) => sum + row.total, 0);
      expect(result.totals.total).toBe(rowSum);
    });
  });
});
