/**
 * Unit tests for ReportingService.exportParticipants
 *
 * Covers the dead-column fix: `institution` must come from an application's
 * personal_data JSON when available, only falling back to the (never
 * written by onboarding) participants.institution column for legacy rows.
 * All Prisma/Excel calls are mocked — no DB required.
 */

import { ReportingService } from './reporting.service';

function buildParticipant(overrides: {
  id: string;
  institution: string | null;
  applications: { personalData: unknown }[];
}) {
  return {
    id: overrides.id,
    fullName: 'Test Participant',
    phoneCountryCode: '62',
    phoneNumber: '81234',
    nationality: 'Indonesia',
    institution: overrides.institution,
    deletedAt: null,
    createdAt: new Date('2026-01-01T00:00:00Z'),
    user: { email: 'test@example.com' },
    applications: overrides.applications,
  };
}

function buildPrismaMock(participants: ReturnType<typeof buildParticipant>[]) {
  const findMany = jest
    .fn()
    .mockResolvedValueOnce(participants)
    .mockResolvedValue([]); // stop the cursor loop on the next page

  return { participant: { findMany } };
}

function buildExcelMock() {
  const collected: Record<string, unknown>[] = [];
  const streamExcelRows = jest.fn(
    async (
      _res: unknown,
      rows: AsyncIterable<Record<string, unknown>>,
    ) => {
      for await (const row of rows) collected.push(row);
    },
  );
  return { streamExcelRows, collected };
}

function fakeRes() {
  return {} as never;
}

describe('ReportingService.exportParticipants', () => {
  it('reads institution from personal_data when an application has it', async () => {
    const participant = buildParticipant({
      id: 'p-1',
      institution: null, // the dead column is empty, as it always is post-onboarding
      applications: [
        { personalData: {} },
        { personalData: { institution: 'Test University' } },
      ],
    });
    const prisma = buildPrismaMock([participant]);
    const excel = buildExcelMock();
    const service = new ReportingService(prisma as never, {} as never, excel as never);

    await service.exportParticipants(fakeRes());

    expect(excel.collected).toHaveLength(1);
    expect(excel.collected[0].institution).toBe('Test University');
  });

  it('falls back to the legacy participants.institution column when no application has one', async () => {
    const participant = buildParticipant({
      id: 'p-2',
      institution: 'Legacy College',
      applications: [{ personalData: {} }],
    });
    const prisma = buildPrismaMock([participant]);
    const excel = buildExcelMock();
    const service = new ReportingService(prisma as never, {} as never, excel as never);

    await service.exportParticipants(fakeRes());

    expect(excel.collected[0].institution).toBe('Legacy College');
  });

  it('prefers personal_data institution over a stale legacy column value', async () => {
    const participant = buildParticipant({
      id: 'p-3',
      institution: 'Stale Legacy Value',
      applications: [{ personalData: { institution: 'Current University' } }],
    });
    const prisma = buildPrismaMock([participant]);
    const excel = buildExcelMock();
    const service = new ReportingService(prisma as never, {} as never, excel as never);

    await service.exportParticipants(fakeRes());

    expect(excel.collected[0].institution).toBe('Current University');
  });
});
