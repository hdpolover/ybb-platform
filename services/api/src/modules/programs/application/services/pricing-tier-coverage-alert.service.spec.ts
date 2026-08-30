// src/modules/programs/application/services/pricing-tier-coverage-alert.service.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PricingTierCoverageAlertService } from './pricing-tier-coverage-alert.service';
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service';
import { RabbitMQProducerService } from '@shared/infrastructure/rabbitmq/rabbitmq-producer.service';

const now = new Date('2027-01-10T01:00:00Z');

const lapsedProgram = {
  id: 'prog-1',
  name: 'China Youth Summit 2027',
  registrationCloseDate: new Date('2027-02-01T00:00:00Z'),
  brand: { name: 'CYS' },
  pricingTiers: [
    {
      id: 'tier-1',
      name: 'Fully Funded',
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
      validityPeriods: [{ startDate: new Date('2026-12-01T00:00:00Z'), endDate: new Date('2027-06-01T00:00:00Z') }],
    },
  ],
};

describe('PricingTierCoverageAlertService', () => {
  let service: PricingTierCoverageAlertService;
  let mockPrisma: { program: { findMany: jest.Mock } };
  let mockRabbitmq: { emit: jest.Mock };
  let mockConfig: { get: jest.Mock };

  const build = async (opsAlertEmails: string | undefined) => {
    mockConfig = { get: jest.fn().mockReturnValue(opsAlertEmails) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PricingTierCoverageAlertService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: RabbitMQProducerService, useValue: mockRabbitmq },
        { provide: ConfigService, useValue: mockConfig },
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
});
