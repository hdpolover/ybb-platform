// src/modules/applications/infrastructure/services/submission-deadline-reminder.service.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { SubmissionDeadlineReminderService } from './submission-deadline-reminder.service';
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service';
import { RabbitMQProducerService } from '@shared/infrastructure/rabbitmq/rabbitmq-producer.service';
import { startOfWibDay, addDays } from '@shared/utils/wib-time';
import { resolveSubmissionCutoff } from '@shared/utils/submission-deadline.util';

// ── Helpers ───────────────────────────────────────────────────────────────────

const makeCandidate = (overrides: Record<string, unknown> = {}) => ({
  id: 'app-1',
  program: {
    id: 'prog-1',
    name: 'China Youth Summit 2027',
    applicationDeadline: new Date('2027-01-08T10:00:00Z'),
    brandId: 'brand-1',
    brand: { landingUrl: 'https://cys.example.com', websiteUrl: null },
  },
  participant: {
    fullName: 'Jane Doe',
    user: { email: 'jane@example.com' },
  },
  ...overrides,
});

const uniqueViolation = () =>
  new Prisma.PrismaClientKnownRequestError('duplicate', {
    code: 'P2002',
    clientVersion: 'test',
  });

// ── Suite ─────────────────────────────────────────────────────────────────────

describe('SubmissionDeadlineReminderService', () => {
  let service: SubmissionDeadlineReminderService;
  let mockPrisma: {
    participantApplication: { findMany: jest.Mock };
    submissionReminderLog: { create: jest.Mock };
  };
  let mockRabbitmq: { emit: jest.Mock };

  const referenceDate = new Date('2027-01-01T01:00:00Z'); // 08:00 WIB, Jan 1

  beforeEach(async () => {
    mockPrisma = {
      participantApplication: { findMany: jest.fn().mockResolvedValue([]) },
      submissionReminderLog: { create: jest.fn().mockResolvedValue({}) },
    };
    mockRabbitmq = { emit: jest.fn().mockResolvedValue(undefined) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SubmissionDeadlineReminderService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: RabbitMQProducerService, useValue: mockRabbitmq },
      ],
    }).compile();

    service = module.get<SubmissionDeadlineReminderService>(SubmissionDeadlineReminderService);
  });

  it('queries once per offset (7/3/1) using WIB calendar-day deadline windows', async () => {
    await service.sendDueReminders(referenceDate);

    expect(mockPrisma.participantApplication.findMany).toHaveBeenCalledTimes(3);

    const expectedOffsets = [7, 3, 1];
    expectedOffsets.forEach((offsetDays, index) => {
      const dayStart = startOfWibDay(addDays(referenceDate, offsetDays));
      const dayEnd = addDays(dayStart, 1);
      const call = mockPrisma.participantApplication.findMany.mock.calls[index][0];

      expect(call.where.status).toBe('draft');
      expect(call.where.deletedAt).toBeNull();
      expect(call.where.program.applicationDeadline.gte).toEqual(dayStart);
      expect(call.where.program.applicationDeadline.lt).toEqual(dayEnd);
      expect(call.where.participant).toEqual({
        deletedAt: null,
        user: { isActive: true, deletedAt: null },
      });
    });
  });

  it('derives the window upper bound from the shared submission-deadline resolver, not a separate addDays call', async () => {
    // Locks the reminder window to the same resolver submit-application.handler.ts
    // and portal-submit-application.handler.ts use, so "H-1" and "the last day
    // you can submit" cannot silently drift apart.
    await service.sendDueReminders(referenceDate);

    [7, 3, 1].forEach((offsetDays, index) => {
      const targetInstant = addDays(referenceDate, offsetDays);
      const expectedEnd = resolveSubmissionCutoff(targetInstant);
      const call = mockPrisma.participantApplication.findMany.mock.calls[index][0];

      expect(call.where.program.applicationDeadline.lt).toEqual(expectedEnd);
    });
  });

  it('matches a candidate whose deadline is stored as 23:59:59 UTC (the TEST-program shape), not just midnight UTC', async () => {
    // A deadline of '2027-01-08T23:59:59Z' falls on WIB calendar day 9 Jan
    // (06:59:59 WIB), not 8 Jan. The window for offset=1, referenced from
    // 2027-01-08T01:00:00Z (08:00 WIB, 8 Jan), targets WIB day 9 Jan - so this
    // non-midnight shape must still fall inside that window.
    const refDate = new Date('2027-01-08T01:00:00Z'); // 08:00 WIB, 8 Jan
    const oddShapeDeadline = new Date('2027-01-08T23:59:59Z');

    mockPrisma.participantApplication.findMany
      .mockResolvedValueOnce([]) // offset 7
      .mockResolvedValueOnce([]) // offset 3
      .mockResolvedValueOnce([makeCandidate({ program: { ...makeCandidate().program, applicationDeadline: oddShapeDeadline } })]); // offset 1

    const report = await service.sendDueReminders(refDate);

    const offset1Call = mockPrisma.participantApplication.findMany.mock.calls[2][0];
    const { gte, lt } = offset1Call.where.program.applicationDeadline;
    expect(oddShapeDeadline.getTime()).toBeGreaterThanOrEqual(gte.getTime());
    expect(oddShapeDeadline.getTime()).toBeLessThan(lt.getTime());
    expect(report.sent).toBe(1);
  });

  it('claims the reminder then emits application.submission_reminder for an eligible draft application', async () => {
    mockPrisma.participantApplication.findMany
      .mockResolvedValueOnce([makeCandidate()]) // offset 7
      .mockResolvedValueOnce([]) // offset 3
      .mockResolvedValueOnce([]); // offset 1

    const report = await service.sendDueReminders(referenceDate);

    expect(mockPrisma.submissionReminderLog.create).toHaveBeenCalledWith({
      data: { applicationId: 'app-1', reminderOffset: 7 },
    });
    // Claim must happen before the emit, so a claim failure never sends a duplicate.
    const claimOrder = mockPrisma.submissionReminderLog.create.mock.invocationCallOrder[0];
    const emitOrder = mockRabbitmq.emit.mock.invocationCallOrder[0];
    expect(claimOrder).toBeLessThan(emitOrder);

    expect(mockRabbitmq.emit).toHaveBeenCalledWith(
      'application.submission_reminder',
      expect.objectContaining({
        email: 'jane@example.com',
        customer_name: 'Jane Doe',
        program: 'China Youth Summit 2027',
        daysRemaining: 7,
        metadata: expect.objectContaining({
          application_id: 'app-1',
          reminder_offset: 7,
        }),
      }),
    );
    expect(report.sent).toBe(1);
    expect(report.alreadySent).toBe(0);
  });

  it('logs a structured per-send line, since application.submission_reminder is not yet wired into AuditController', async () => {
    // audit_log_queue's AuditController only persists a row for event names it
    // explicitly registers (see 'payment.reminder' there); 'application.submission_reminder'
    // isn't registered yet, so this log line is currently the only way to answer
    // "did this participant get their H-3 reminder" without a raw SQL query.
    mockPrisma.participantApplication.findMany
      .mockResolvedValueOnce([makeCandidate()]) // offset 7
      .mockResolvedValueOnce([]) // offset 3
      .mockResolvedValueOnce([]); // offset 1

    const logSpy = jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);

    await service.sendDueReminders(referenceDate);

    const sentLogLine = logSpy.mock.calls
      .map((call) => String(call[0]))
      .find((line) => line.startsWith('[submission-reminder] sent'));

    expect(sentLogLine).toBeDefined();
    expect(sentLogLine).toContain('application=app-1');
    expect(sentLogLine).toContain('email=jane@example.com');
    expect(sentLogLine).toContain('offset=7');

    logSpy.mockRestore();
  });

  it('is idempotent: a unique-constraint violation on claim skips the send without emitting', async () => {
    mockPrisma.participantApplication.findMany
      .mockResolvedValueOnce([makeCandidate()])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);
    mockPrisma.submissionReminderLog.create.mockRejectedValueOnce(uniqueViolation());

    const report = await service.sendDueReminders(referenceDate);

    expect(mockRabbitmq.emit).not.toHaveBeenCalled();
    expect(report.alreadySent).toBe(1);
    expect(report.sent).toBe(0);
  });

  it('skips and does not claim when the participant has no email on file', async () => {
    mockPrisma.participantApplication.findMany
      .mockResolvedValueOnce([makeCandidate({ participant: { fullName: 'No Email', user: null } })])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);

    const report = await service.sendDueReminders(referenceDate);

    expect(mockPrisma.submissionReminderLog.create).not.toHaveBeenCalled();
    expect(mockRabbitmq.emit).not.toHaveBeenCalled();
    expect(report.skippedNoEmail).toBe(1);
  });

  it('counts a non-idempotency claim error against the report without throwing the whole run', async () => {
    mockPrisma.participantApplication.findMany
      .mockResolvedValueOnce([makeCandidate()])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);
    mockPrisma.submissionReminderLog.create.mockRejectedValueOnce(new Error('connection lost'));

    const report = await service.sendDueReminders(referenceDate);

    expect(mockRabbitmq.emit).not.toHaveBeenCalled();
    expect(report.errors).toBe(1);
  });
});
