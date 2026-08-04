/**
 * Unit tests for ExportApplicationsHandler
 *
 * Covers the dynamic-column derivation: columns come from a program's
 * application_form_fields + program_essays instead of a hardcoded list,
 * essay answers are pulled from the right store for both essay systems,
 * and a multi-program export unions columns without misaligning values
 * across programs. All Prisma/Excel calls are mocked — no DB required.
 */

import { ExportApplicationsHandler } from './export-applications.handler';
import { ExportApplicationsQuery } from '../export-applications.query';

// ── Fixtures ─────────────────────────────────────────────────────────────────

const PROGRAM_1_FIELDS = [
  {
    programId: 'prog-1',
    name: 'emergency_phone_number',
    label: 'Emergency Phone',
    type: 'text',
    section: 'personal_info',
    order: 1,
    placeholder: null,
    validationRules: {},
  },
  {
    programId: 'prog-1',
    name: 'why_join',
    label: 'Why do you want to join?',
    type: 'textarea',
    section: 'essay',
    order: 2,
    placeholder: null,
    validationRules: {},
  },
  {
    programId: 'prog-1',
    name: 'id_card',
    label: 'ID Card',
    type: 'file',
    section: 'documents',
    order: 3,
    placeholder: null,
    validationRules: {},
  },
  {
    programId: 'prog-1',
    name: 'confirm',
    label: 'Confirm',
    type: 'checkbox',
    section: 'preview',
    order: 4,
    placeholder: null,
    validationRules: {},
  },
];

const PROGRAM_2_FIELDS = [
  {
    programId: 'prog-2',
    name: 'dietary_pref',
    label: 'Dietary Preference',
    type: 'text',
    section: 'personal_info',
    order: 1,
    placeholder: null,
    validationRules: {},
  },
];

const PROGRAM_1_ESSAYS = [
  { programId: 'prog-1', id: 'essay-uuid-1', question: 'Tell us about yourself', order: 5 },
];

const APP_1 = {
  id: 'app-1',
  programId: 'prog-1',
  status: 'submitted',
  applicationCategory: 'self_funded',
  scoreTotal: null,
  scoreStatus: null,
  submittedAt: new Date('2026-01-01T00:00:00Z'),
  createdAt: new Date('2026-01-01T00:00:00Z'),
  registrationPaymentStatus: 'paid',
  programPaymentStatus: 'unpaid',
  personalData: { emergency_phone_number: '+628123456' } as Record<string, unknown>,
  essayAnswers: { why_join: 'I want to learn', 'essay-uuid-1': 'About me text' } as Record<string, unknown>,
  uploadedFiles: { id_card: 'https://files.example.com/id-1.pdf' } as Record<string, unknown>,
  participant: {
    fullName: 'Alice',
    phoneCountryCode: '62',
    phoneNumber: '81234',
    originCountry: 'Indonesia',
    birthdate: new Date('1990-01-01T00:00:00.000Z'), // onboarding year-only placeholder
    user: { email: 'alice@example.com' },
  },
  program: { name: 'China Youth Summit' },
};

const APP_2 = {
  id: 'app-2',
  programId: 'prog-2',
  status: 'submitted',
  applicationCategory: 'fully_funded',
  scoreTotal: null,
  scoreStatus: null,
  submittedAt: new Date('2026-01-02T00:00:00Z'),
  createdAt: new Date('2026-01-02T00:00:00Z'),
  registrationPaymentStatus: 'paid',
  programPaymentStatus: 'unpaid',
  personalData: { dietary_pref: 'Vegetarian' } as Record<string, unknown>,
  essayAnswers: {} as Record<string, unknown>,
  uploadedFiles: {} as Record<string, unknown>,
  participant: {
    fullName: 'Bob',
    phoneCountryCode: '1',
    phoneNumber: '5551234',
    originCountry: 'USA',
    birthdate: new Date('1995-07-20T00:00:00.000Z'), // real date, no personalData birthdate -> fallback applies
    user: { email: 'bob@example.com' },
  },
  program: { name: 'Istanbul Youth Summit' },
};

// ── Mock builders ────────────────────────────────────────────────────────────

function buildPrismaMock(options: {
  distinctProgramIds: string[];
  applications: Array<Record<string, unknown>>;
  fields: typeof PROGRAM_1_FIELDS;
  essays: typeof PROGRAM_1_ESSAYS;
}) {
  const { distinctProgramIds, applications, fields, essays } = options;

  const findManyApplications = jest.fn().mockImplementation((args: { distinct?: string[]; skip?: number }) => {
    if (args.distinct) {
      return Promise.resolve(distinctProgramIds.map((programId) => ({ programId })));
    }
    // Paginated call: return the full fixture set on the first page, empty afterwards.
    if ((args.skip ?? 0) > 0) return Promise.resolve([]);
    return Promise.resolve(applications);
  });

  const prisma = {
    participantApplication: { findMany: findManyApplications },
    applicationFormField: { findMany: jest.fn().mockResolvedValue(fields) },
    programEssay: { findMany: jest.fn().mockResolvedValue(essays) },
  };

  return prisma;
}

function buildExcelMock() {
  return { generateExcel: jest.fn().mockResolvedValue(Buffer.from('xlsx')) };
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('ExportApplicationsHandler', () => {
  it('derives dynamic columns from a single program\'s form fields and both essay systems', async () => {
    const prisma = buildPrismaMock({
      distinctProgramIds: ['prog-1'],
      applications: [APP_1],
      fields: PROGRAM_1_FIELDS,
      essays: PROGRAM_1_ESSAYS,
    });
    const excel = buildExcelMock();
    const handler = new ExportApplicationsHandler(prisma as never, excel as never);

    await handler.execute(new ExportApplicationsQuery('brand-1', 'prog-1'));

    expect(excel.generateExcel).toHaveBeenCalledTimes(1);
    const [rows, columns] = excel.generateExcel.mock.calls[0];

    const columnKeys = columns.map((c: { key: string }) => c.key);
    // Core columns still present (no regression).
    expect(columnKeys).toEqual(expect.arrayContaining(['id', 'program', 'email', 'status']));
    // Dynamic personal_data field.
    expect(columnKeys).toContain('f_emergency_phone_number');
    // application_form_fields essay (section='essay', name-keyed).
    expect(columnKeys).toContain('f_why_join');
    // File field.
    expect(columnKeys).toContain('f_id_card');
    // program_essays (UUID-keyed).
    expect(columnKeys).toContain('e_essay-uuid-1');
    // preview section excluded.
    expect(columnKeys).not.toContain('f_confirm');

    const row = rows[0];
    expect(row.f_emergency_phone_number).toBe('+628123456');
    expect(row.f_why_join).toBe('I want to learn');
    expect(row.f_id_card).toBe('https://files.example.com/id-1.pdf');
    expect(row['e_essay-uuid-1']).toBe('About me text');
  });

  it('unions columns across a multi-program export without misaligning values between programs', async () => {
    const prisma = buildPrismaMock({
      distinctProgramIds: ['prog-1', 'prog-2'],
      applications: [APP_1, APP_2],
      fields: [...PROGRAM_1_FIELDS, ...PROGRAM_2_FIELDS],
      essays: PROGRAM_1_ESSAYS,
    });
    const excel = buildExcelMock();
    const handler = new ExportApplicationsHandler(prisma as never, excel as never);

    // No programId → brand-wide, multi-program export.
    await handler.execute(new ExportApplicationsQuery('brand-1'));

    const [rows, columns] = excel.generateExcel.mock.calls[0];
    const columnKeys = columns.map((c: { key: string }) => c.key);

    expect(columnKeys).toContain('f_emergency_phone_number');
    expect(columnKeys).toContain('f_dietary_pref');

    const aliceRow = rows.find((r: { id: string }) => r.id === 'app-1');
    const bobRow = rows.find((r: { id: string }) => r.id === 'app-2');

    // Alice belongs to prog-1: her own field is filled, prog-2's field is blank.
    expect(aliceRow.f_emergency_phone_number).toBe('+628123456');
    expect(aliceRow.f_dietary_pref).toBe('');

    // Bob belongs to prog-2: the reverse.
    expect(bobRow.f_dietary_pref).toBe('Vegetarian');
    expect(bobRow.f_emergency_phone_number).toBe('');
  });

  it('produces only core columns when the export has no matching applications', async () => {
    const prisma = buildPrismaMock({
      distinctProgramIds: [],
      applications: [],
      fields: [],
      essays: [],
    });
    const excel = buildExcelMock();
    const handler = new ExportApplicationsHandler(prisma as never, excel as never);

    await handler.execute(new ExportApplicationsQuery('brand-1', 'prog-empty'));

    const [rows, columns] = excel.generateExcel.mock.calls[0];
    expect(rows).toEqual([]);
    const columnKeys = columns.map((c: { key: string }) => c.key);
    expect(columnKeys).toEqual([
      'id', 'program', 'participantName', 'email', 'country', 'phone', 'phoneValid',
      'dateOfBirth', 'status', 'category', 'appliedAt', 'submittedAt',
      'registrationPaymentStatus', 'programPaymentStatus', 'scoreTotal', 'scoreStatus',
    ]);
  });

  // dateOfBirth uses the same resolveApplicationBirthdate() resolver as the
  // admin detail view and LoA, so the export must agree with them: prefer
  // personal_data, fall back to participants.birthdate only when it is a
  // real (non-placeholder) date, and never blank a genuine Jan-1 date that
  // came from personal_data itself.
  describe('dateOfBirth resolution', () => {
    function buildAppWithBirthdate(overrides: {
      personalData: Record<string, unknown>;
      participantBirthdate: Date | null;
    }) {
      return {
        ...APP_1,
        id: 'app-dob',
        personalData: overrides.personalData,
        participant: { ...APP_1.participant, birthdate: overrides.participantBirthdate },
      };
    }

    it('prefers the personal_data birthdate over participant.birthdate', async () => {
      const app = buildAppWithBirthdate({
        personalData: { birthdate: '1998-05-12' },
        participantBirthdate: new Date('1990-01-01T00:00:00.000Z'),
      });
      const prisma = buildPrismaMock({
        distinctProgramIds: ['prog-1'],
        applications: [app],
        fields: PROGRAM_1_FIELDS,
        essays: PROGRAM_1_ESSAYS,
      });
      const excel = buildExcelMock();
      const handler = new ExportApplicationsHandler(prisma as never, excel as never);

      await handler.execute(new ExportApplicationsQuery('brand-1', 'prog-1'));

      const [rows] = excel.generateExcel.mock.calls[0];
      expect(rows[0].dateOfBirth).toBe('1998-05-12');
    });

    it('falls back to participant.birthdate when it holds a real (non-Jan-1) date', async () => {
      const app = buildAppWithBirthdate({
        personalData: {},
        participantBirthdate: new Date('1995-07-20T00:00:00.000Z'),
      });
      const prisma = buildPrismaMock({
        distinctProgramIds: ['prog-1'],
        applications: [app],
        fields: PROGRAM_1_FIELDS,
        essays: PROGRAM_1_ESSAYS,
      });
      const excel = buildExcelMock();
      const handler = new ExportApplicationsHandler(prisma as never, excel as never);

      await handler.execute(new ExportApplicationsQuery('brand-1', 'prog-1'));

      const [rows] = excel.generateExcel.mock.calls[0];
      expect(rows[0].dateOfBirth).toBe('1995-07-20');
    });

    it('leaves dateOfBirth blank when personal_data has none and participant.birthdate is the year-only placeholder', async () => {
      const app = buildAppWithBirthdate({
        personalData: {},
        participantBirthdate: new Date('1990-01-01T00:00:00.000Z'),
      });
      const prisma = buildPrismaMock({
        distinctProgramIds: ['prog-1'],
        applications: [app],
        fields: PROGRAM_1_FIELDS,
        essays: PROGRAM_1_ESSAYS,
      });
      const excel = buildExcelMock();
      const handler = new ExportApplicationsHandler(prisma as never, excel as never);

      await handler.execute(new ExportApplicationsQuery('brand-1', 'prog-1'));

      const [rows] = excel.generateExcel.mock.calls[0];
      expect(rows[0].dateOfBirth).toBe('');
    });

    it('does NOT blank a genuine Jan-1 birthdate that came from personal_data itself', async () => {
      const app = buildAppWithBirthdate({
        personalData: { birthdate: '1990-01-01' },
        participantBirthdate: new Date('1990-01-01T00:00:00.000Z'), // also the placeholder, irrelevant here
      });
      const prisma = buildPrismaMock({
        distinctProgramIds: ['prog-1'],
        applications: [app],
        fields: PROGRAM_1_FIELDS,
        essays: PROGRAM_1_ESSAYS,
      });
      const excel = buildExcelMock();
      const handler = new ExportApplicationsHandler(prisma as never, excel as never);

      await handler.execute(new ExportApplicationsQuery('brand-1', 'prog-1'));

      const [rows] = excel.generateExcel.mock.calls[0];
      expect(rows[0].dateOfBirth).toBe('1990-01-01');
    });
  });
});
