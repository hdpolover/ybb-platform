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
  occupation?: string | null;
  originCountry?: string | null;
}) {
  return {
    id: overrides.id,
    fullName: 'Test Participant',
    phoneCountryCode: '62',
    phoneNumber: '81234',
    nationality: 'Indonesia',
    originCountry: overrides.originCountry ?? null,
    institution: overrides.institution,
    occupation: overrides.occupation ?? null,
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

  it('reads occupation from personal_data when an application has it', async () => {
    const participant = buildParticipant({
      id: 'p-4',
      institution: null,
      occupation: null,
      applications: [
        { personalData: {} },
        { personalData: { occupation: 'Software Engineer' } },
      ],
    });
    const prisma = buildPrismaMock([participant]);
    const excel = buildExcelMock();
    const service = new ReportingService(prisma as never, {} as never, excel as never);

    await service.exportParticipants(fakeRes());

    expect(excel.collected[0].occupation).toBe('Software Engineer');
  });

  it('falls back to the legacy participants.occupation column when no application has one', async () => {
    const participant = buildParticipant({
      id: 'p-5',
      institution: null,
      occupation: 'Legacy Occupation',
      applications: [{ personalData: {} }],
    });
    const prisma = buildPrismaMock([participant]);
    const excel = buildExcelMock();
    const service = new ReportingService(prisma as never, {} as never, excel as never);

    await service.exportParticipants(fakeRes());

    expect(excel.collected[0].occupation).toBe('Legacy Occupation');
  });

  describe('nationality (country) resolution', () => {
    it('renders the display name resolved from personal_data nationality, not the dead participants.nationality column', async () => {
      const participant = buildParticipant({
        id: 'p-6',
        institution: null,
        originCountry: null,
        applications: [{ personalData: { nationality: 'ID' } }],
      });
      const prisma = buildPrismaMock([participant]);
      const excel = buildExcelMock();
      const service = new ReportingService(prisma as never, {} as never, excel as never);

      await service.exportParticipants(fakeRes());

      expect(excel.collected[0].nationality).toBe('Indonesia');
    });

    it('falls back to participants.originCountry when no application has a personal_data nationality', async () => {
      const participant = buildParticipant({
        id: 'p-7',
        institution: null,
        originCountry: 'PK',
        applications: [{ personalData: {} }],
      });
      const prisma = buildPrismaMock([participant]);
      const excel = buildExcelMock();
      const service = new ReportingService(prisma as never, {} as never, excel as never);

      await service.exportParticipants(fakeRes());

      expect(excel.collected[0].nationality).toBe('Pakistan');
    });

    it('renders N/A when neither source has a country', async () => {
      const participant = buildParticipant({
        id: 'p-8',
        institution: null,
        originCountry: null,
        applications: [{ personalData: {} }],
      });
      const prisma = buildPrismaMock([participant]);
      const excel = buildExcelMock();
      const service = new ReportingService(prisma as never, {} as never, excel as never);

      await service.exportParticipants(fakeRes());

      expect(excel.collected[0].nationality).toBe('N/A');
    });
  });
});

describe('ReportingService.exportPayments', () => {
  function buildInvoice(overrides: {
    id: string;
    personalData: Record<string, unknown>;
    participantInstitution: string | null;
    participantOccupation: string | null;
    participantOriginCountry: string | null;
  }) {
    return {
      id: overrides.id,
      applicationId: 'app-1',
      amount: { toString: () => '1000' },
      currency: 'IDR',
      status: 'paid',
      paymentMethod: 'manual_transfer',
      createdAt: new Date('2026-01-01T00:00:00Z'),
      paidAt: null,
      externalTransactionId: null,
      pricingTier: { name: 'Regular' },
      application: {
        applicationCategory: 'self_funded',
        personalData: overrides.personalData,
        program: { name: 'China Youth Summit' },
        participant: {
          fullName: 'Test Participant',
          phoneCountryCode: '62',
          phoneNumber: '81234',
          nationality: null,
          originCountry: overrides.participantOriginCountry,
          institution: overrides.participantInstitution,
          occupation: overrides.participantOccupation,
          user: { email: 'test@example.com' },
        },
      },
    };
  }

  function buildReadPrismaMock(invoices: ReturnType<typeof buildInvoice>[]) {
    const findMany = jest
      .fn()
      .mockResolvedValueOnce(invoices)
      .mockResolvedValue([]); // stop the cursor loop on the next page

    return { applicationInvoice: { findMany }, $queryRaw: jest.fn().mockResolvedValue([]) };
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

  it('prefers personal_data institution/occupation/nationality over the dead participant columns', async () => {
    const invoice = buildInvoice({
      id: 'inv-1',
      personalData: { institution: 'MIT', occupation: 'Student', nationality: 'ID' },
      participantInstitution: 'Legacy University',
      participantOccupation: 'Legacy Job',
      participantOriginCountry: null,
    });
    const readPrisma = buildReadPrismaMock([invoice]);
    const excel = buildExcelMock();
    const service = new ReportingService({} as never, readPrisma as never, excel as never);

    await service.exportPayments({} as never);

    expect(excel.collected[0].institution).toBe('MIT');
    expect(excel.collected[0].occupation).toBe('Student');
    expect(excel.collected[0].country).toBe('Indonesia');
  });

  it('falls back to the participant columns when personal_data has no institution/occupation/country', async () => {
    const invoice = buildInvoice({
      id: 'inv-2',
      personalData: {},
      participantInstitution: 'Legacy University',
      participantOccupation: 'Legacy Job',
      participantOriginCountry: 'PK',
    });
    const readPrisma = buildReadPrismaMock([invoice]);
    const excel = buildExcelMock();
    const service = new ReportingService({} as never, readPrisma as never, excel as never);

    await service.exportPayments({} as never);

    expect(excel.collected[0].institution).toBe('Legacy University');
    expect(excel.collected[0].occupation).toBe('Legacy Job');
    expect(excel.collected[0].country).toBe('Pakistan');
  });

  it('renders empty institution/occupation and N/A country when neither source has a value', async () => {
    const invoice = buildInvoice({
      id: 'inv-3',
      personalData: {},
      participantInstitution: null,
      participantOccupation: null,
      participantOriginCountry: null,
    });
    const readPrisma = buildReadPrismaMock([invoice]);
    const excel = buildExcelMock();
    const service = new ReportingService({} as never, readPrisma as never, excel as never);

    await service.exportPayments({} as never);

    expect(excel.collected[0].institution).toBe('');
    expect(excel.collected[0].occupation).toBe('');
    expect(excel.collected[0].country).toBe('N/A');
  });

  it('includes Country/Institution/Occupation columns positioned after Phone Valid and before Program', async () => {
    const invoice = buildInvoice({
      id: 'inv-4',
      personalData: {},
      participantInstitution: null,
      participantOccupation: null,
      participantOriginCountry: null,
    });
    const readPrisma = buildReadPrismaMock([invoice]);
    const excel = buildExcelMock();
    const service = new ReportingService({} as never, readPrisma as never, excel as never);

    await service.exportPayments({} as never);

    const columns = (excel.streamExcelRows.mock.calls[0] as unknown[])[2] as { key: string }[];
    const keys = columns.map((c) => c.key);
    const phoneValidIdx = keys.indexOf('phoneValid');
    const programIdx = keys.indexOf('program');
    expect(keys.slice(phoneValidIdx + 1, programIdx)).toEqual(['country', 'institution', 'occupation']);
  });
});
