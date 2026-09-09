// src/modules/programs/application/services/pricing-tier-coverage-alert.service.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PricingTierCoverageAlertService } from './pricing-tier-coverage-alert.service';
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service';
import { RabbitMQProducerService } from '@shared/infrastructure/rabbitmq/rabbitmq-producer.service';
import { CronLockService } from '@shared/infrastructure/database/cron-lock.service';

const now = new Date('2027-01-10T01:00:00Z');

// isActive/feeType/allowedCategories now travel with every tier row (see
// N-2026-09-09-E: the scan query no longer filters isActive at the DB level,
// so the caller filters in JS instead) - these fixtures are pinned to
// feeType !== 'registration_fee' so the new uncovered-category check stays a
// no-op for them and this spec keeps testing exactly what its names say.
const lapsedProgram = {
  id: 'prog-1',
  name: 'China Youth Summit 2027',
  registrationCloseDate: new Date('2027-02-01T00:00:00Z'),
  brand: { name: 'CYS' },
  pricingTiers: [
    {
      id: 'tier-1',
      name: 'Fully Funded',
      isActive: true,
      feeType: 'full_fee',
      allowedCategories: [],
      validityPeriods: [{ startDate: new Date('2026-12-01T00:00:00Z'), endDate: new Date('2027-01-05T00:00:00Z') }],
    },
  ],
};

const cleanProgram = {
  id: 'prog-2',
  name: 'Middle East Youth Summit',
  registrationCloseDate: new Date('2027-03-01T00:00:00Z'),
  brand: { name: 'MEYS' },
  pricingTiers: [
    {
      id: 'tier-2',
      name: 'Standard',
      isActive: true,
      feeType: 'full_fee',
      allowedCategories: [],
      validityPeriods: [{ startDate: new Date('2026-12-01T00:00:00Z'), endDate: new Date('2027-06-01T00:00:00Z') }],
    },
  ],
};

// The real MEYS 6th shape (2026-09-08): self_funded still has a live
// registration_fee tier, but the only tier that ever allowed fully_funded
// was deactivated. Before N-2026-09-09-E the scan query filtered isActive at
// the DB level, so this program produced NO alert and NO email at all.
const meysUncoveredCategoryProgram = {
  id: 'prog-3',
  name: 'Middle East Youth Summit 6th',
  registrationCloseDate: new Date('2027-03-01T00:00:00Z'),
  brand: { name: 'MEYS' },
  pricingTiers: [
    {
      id: 'tier-self-funded',
      name: 'Registration Fee (Self Funded)',
      isActive: true,
      feeType: 'registration_fee',
      allowedCategories: ['self_funded'],
      validityPeriods: [{ startDate: new Date('2026-08-01T00:00:00Z'), endDate: new Date('2027-06-01T00:00:00Z') }],
    },
    {
      id: 'tier-fully-funded',
      name: 'Registration Fee (Fully Funded)',
      isActive: false,
      feeType: 'registration_fee',
      allowedCategories: ['fully_funded'],
      validityPeriods: [{ startDate: new Date('2026-08-01T00:00:00Z'), endDate: new Date('2027-06-01T00:00:00Z') }],
    },
  ],
};

describe('PricingTierCoverageAlertService', () => {
  let service: PricingTierCoverageAlertService;
  let mockPrisma: { program: { findMany: jest.Mock } };
  let mockRabbitmq: { emit: jest.Mock };
  let mockConfig: { get: jest.Mock };
  let mockCronLock: { runExclusive: jest.Mock };

  const build = async (opsAlertEmails: string | undefined) => {
    mockConfig = { get: jest.fn().mockReturnValue(opsAlertEmails) };
    mockCronLock = {
      runExclusive: jest.fn((_jobName: string, fn: () => Promise<void>) => fn()),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PricingTierCoverageAlertService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: RabbitMQProducerService, useValue: mockRabbitmq },
        { provide: ConfigService, useValue: mockConfig },
        { provide: CronLockService, useValue: mockCronLock },
      ],
    }).compile();

    return module.get<PricingTierCoverageAlertService>(PricingTierCoverageAlertService);
  };

  beforeEach(() => {
    mockRabbitmq = { emit: jest.fn().mockResolvedValue(undefined) };
  });

  it('emits ops.pricing_tier_coverage_alert with the right shape when alerts are found and recipients are configured', async () => {
    mockPrisma = { program: { findMany: jest.fn().mockResolvedValue([lapsedProgram]) } };
    service = await build('ops1@ybb.id, ops2@ybb.id');

    await service.scanAndAlert(now);

    expect(mockRabbitmq.emit).toHaveBeenCalledTimes(1);
    const [pattern, payload] = mockRabbitmq.emit.mock.calls[0];
    expect(pattern).toBe('ops.pricing_tier_coverage_alert');
    expect(payload.recipients).toEqual(['ops1@ybb.id', 'ops2@ybb.id']);
    expect(payload.programs).toEqual([
      expect.objectContaining({
        programId: 'prog-1',
        programName: 'China Youth Summit 2027',
        brandName: 'CYS',
        tiers: [
          expect.objectContaining({
            tierId: 'tier-1',
            tierName: 'Fully Funded',
            state: 'lapsed',
          }),
        ],
      }),
    ]);
  });

  // Pins N-2026-09-09-E end to end: the MEYS 6th shape must reach the emitted
  // event, not just the pure detector unit test. Fails before the fix because
  // scanProgramsForPricingTierAlerts filtered isActive at the query level, so
  // the deactivated fully_funded tier - and the whole program - never reached
  // this service's results at all.
  it('emits an uncoveredCategories entry for a category whose only registration_fee tier was deactivated', async () => {
    mockPrisma = { program: { findMany: jest.fn().mockResolvedValue([meysUncoveredCategoryProgram]) } };
    service = await build('ops1@ybb.id');

    await service.scanAndAlert(now);

    expect(mockRabbitmq.emit).toHaveBeenCalledTimes(1);
    const [, payload] = mockRabbitmq.emit.mock.calls[0];
    expect(payload.programs).toEqual([
      expect.objectContaining({
        programId: 'prog-3',
        programName: 'Middle East Youth Summit 6th',
        tiers: [],
        uncoveredCategories: [
          { category: 'fully_funded', tierId: 'tier-fully-funded', tierName: 'Registration Fee (Fully Funded)' },
        ],
      }),
    ]);
  });

  it('does NOT emit and logs an ERROR when alerts are found but OPS_ALERT_EMAILS is empty', async () => {
    mockPrisma = { program: { findMany: jest.fn().mockResolvedValue([lapsedProgram]) } };
    service = await build('');

    const errorSpy = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);

    await service.scanAndAlert(now);

    expect(mockRabbitmq.emit).not.toHaveBeenCalled();
    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('OPS_ALERT_EMAILS'));

    errorSpy.mockRestore();
  });

  it('emits nothing and still logs the run when there are no alerts', async () => {
    mockPrisma = { program: { findMany: jest.fn().mockResolvedValue([cleanProgram]) } };
    service = await build('ops1@ybb.id');

    const logSpy = jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);

    await service.scanAndAlert(now);

    expect(mockRabbitmq.emit).not.toHaveBeenCalled();
    const scanLine = logSpy.mock.calls.map((c) => String(c[0])).find((l) => l.includes('scanned='));
    expect(scanLine).toBeDefined();
    expect(scanLine).toContain('scanned=0');

    logSpy.mockRestore();
  });

  // Replica-safety: without this, N API replicas would each detect the same
  // lapsed pricing tier and each emit their own ops alert (N duplicate
  // emails for one real incident) - see CronLockService.
  it('runScheduledScan runs the scan through CronLockService.runExclusive with a stable jobName', async () => {
    mockPrisma = { program: { findMany: jest.fn().mockResolvedValue([]) } };
    service = await build('ops1@ybb.id');

    await service.runScheduledScan();

    expect(mockCronLock.runExclusive).toHaveBeenCalledTimes(1);
    expect(mockCronLock.runExclusive).toHaveBeenCalledWith('pricing-tier-coverage-alert', expect.any(Function));
    // The passthrough mock actually invokes fn(), so a real scan happened.
    expect(mockPrisma.program.findMany).toHaveBeenCalledTimes(1);
  });

  it('runScheduledScan does not run the scan when the lock is not acquired', async () => {
    mockPrisma = { program: { findMany: jest.fn().mockResolvedValue([]) } };
    service = await build('ops1@ybb.id');
    mockCronLock.runExclusive.mockImplementation(async () => undefined); // simulate lock lost

    await service.runScheduledScan();

    expect(mockPrisma.program.findMany).not.toHaveBeenCalled();
  });
});
