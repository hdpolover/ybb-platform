// services/api/src/modules/applications/application/queries/handlers/get-application.handler.spec.ts

import { Test, TestingModule } from '@nestjs/testing';
import { GetApplicationHandler } from './get-application.handler';
import { GetApplicationQuery } from '../get-application.query';
import { ApplicationMapper } from '@modules/applications/infrastructure/mappers/application.mapper';
import { APPLICATION_REPOSITORY } from '@modules/applications/infrastructure/tokens';
import { CacheService } from '@shared/infrastructure/cache/cache.service';
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service';
import { PaymentGrpcClient } from '@modules/payments/infrastructure/services/payment-grpc.client';
import { ParticipantApplication, ApplicationStatus } from '@core/entities/participant-application.entity';

describe('GetApplicationHandler birthdate resolution', () => {
  let handler: GetApplicationHandler;
  let applicationRepository: { findById: jest.Mock };
  let prisma: {
    participant: { findUnique: jest.Mock };
    participantApplication: { findUnique: jest.Mock };
    programEssay: { findMany: jest.Mock };
    applicationFormField: { findMany: jest.Mock };
  };
  let paymentClient: { getIntentsByReference: jest.Mock };

  function buildApplication(personalData: Record<string, unknown>): ParticipantApplication {
    return new ParticipantApplication(
      'app-1',
      'participant-1',
      'program-1',
      ApplicationStatus.SUBMITTED,
      undefined,
      personalData,
    );
  }

  beforeEach(async () => {
    applicationRepository = { findById: jest.fn() };
    prisma = {
      participant: { findUnique: jest.fn() },
      participantApplication: { findUnique: jest.fn().mockResolvedValue(null) },
      programEssay: { findMany: jest.fn().mockResolvedValue([]) },
      applicationFormField: { findMany: jest.fn().mockResolvedValue([]) },
    };
    paymentClient = { getIntentsByReference: jest.fn().mockResolvedValue({ intents: [] }) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GetApplicationHandler,
        { provide: APPLICATION_REPOSITORY, useValue: applicationRepository },
        ApplicationMapper,
        { provide: CacheService, useValue: { get: jest.fn().mockResolvedValue(undefined), set: jest.fn() } },
        { provide: PrismaService, useValue: prisma },
        { provide: PaymentGrpcClient, useValue: paymentClient },
      ],
    }).compile();

    handler = module.get(GetApplicationHandler);
  });

  it('prefers the real personal_data birthdate over the participant.birthdate column', async () => {
    applicationRepository.findById.mockResolvedValue(buildApplication({ birthdate: '1998-05-12' }));
    prisma.participant.findUnique.mockResolvedValue({
      id: 'participant-1',
      fullName: 'John Doe',
      birthdate: new Date('1990-01-01T00:00:00.000Z'),
      user: { email: 'john@example.com' },
    });

    const dto = await handler.execute(new GetApplicationQuery('app-1', true));

    expect(dto.participant?.birthdate?.toISOString().slice(0, 10)).toBe('1998-05-12');
  });

  it('reads date_of_birth from personal_data when birthdate key is absent', async () => {
    applicationRepository.findById.mockResolvedValue(buildApplication({ date_of_birth: '2001-11-20' }));
    prisma.participant.findUnique.mockResolvedValue({
      id: 'participant-1',
      fullName: 'John Doe',
      birthdate: null,
      user: { email: 'john@example.com' },
    });

    const dto = await handler.execute(new GetApplicationQuery('app-1', true));

    expect(dto.participant?.birthdate?.toISOString().slice(0, 10)).toBe('2001-11-20');
  });

  it('falls back to a real (non-Jan-1) participant.birthdate when personal_data has nothing usable', async () => {
    applicationRepository.findById.mockResolvedValue(buildApplication({}));
    prisma.participant.findUnique.mockResolvedValue({
      id: 'participant-1',
      fullName: 'John Doe',
      birthdate: new Date('1995-07-20T00:00:00.000Z'),
      user: { email: 'john@example.com' },
    });

    const dto = await handler.execute(new GetApplicationQuery('app-1', true));

    expect(dto.participant?.birthdate?.toISOString().slice(0, 10)).toBe('1995-07-20');
  });

  it('returns null (not the fake Jan-1 date) when personal_data has nothing and participant.birthdate is year-only', async () => {
    applicationRepository.findById.mockResolvedValue(buildApplication({}));
    prisma.participant.findUnique.mockResolvedValue({
      id: 'participant-1',
      fullName: 'John Doe',
      birthdate: new Date('1990-01-01T00:00:00.000Z'),
      user: { email: 'john@example.com' },
    });

    const dto = await handler.execute(new GetApplicationQuery('app-1', true));

    expect(dto.participant?.birthdate).toBeNull();
  });

  it('returns the registration and program fee statuses the list endpoint shows', async () => {
    applicationRepository.findById.mockResolvedValue(buildApplication({}));
    prisma.participant.findUnique.mockResolvedValue(null);
    prisma.participantApplication.findUnique.mockResolvedValue({
      registrationPaymentStatus: 'paid',
      programPaymentStatus: 'unpaid',
    });

    const dto = await handler.execute(new GetApplicationQuery('app-1', true));

    expect(dto.registrationPaymentStatus).toBe('paid');
    expect(dto.programPaymentStatus).toBe('unpaid');
  });

  describe('participant contact fields across form templates', () => {
    const bareParticipant = {
      id: 'participant-1',
      fullName: 'Abdullah',
      birthdate: null,
      phoneCountryCode: null,
      phoneNumber: null,
      emergencyContactPhone: '',
      emergencyContactCountryCode: null,
      emergencyContactRelation: '',
      user: { email: 'a@example.com' },
    };

    it('reads the newer template keys (phone, emergency_contact_*, cv_upload, referral_source) without doubling the country code', async () => {
      applicationRepository.findById.mockResolvedValue(buildApplication({
        phone: '+923347354006',
        phone_country_code: '+92',
        emergency_contact_name: 'Faqir Muhammad',
        emergency_contact_relation: 'Grand father',
        emergency_contact_country_code: '+92',
        emergency_contact_phone: '+923219343709',
        cv_upload: 'https://drive.google.com/file/d/x/view',
        referral_source: 'instagram',
        occupation: 'Student',
        account_person_name: 'Abdul Moiz',
      }));
      prisma.participant.findUnique.mockResolvedValue(bareParticipant);

      const dto = await handler.execute(new GetApplicationQuery('app-1', true));

      expect(dto.participant).toMatchObject({
        phoneNumber: '+923347354006',
        emergencyContactName: 'Faqir Muhammad',
        emergencyContactRelation: 'Grand father',
        emergencyContactPhone: '+923219343709',
        resumeUrl: 'https://drive.google.com/file/d/x/view',
        knowledgeSource: 'instagram',
        occupation: 'Student',
      });
      expect(dto.sourceAccountName).toBe('Abdul Moiz');
    });

    it('combines the older split keys (phone_number + phone_country_code, emergency_phone_number, contact_relation)', async () => {
      applicationRepository.findById.mockResolvedValue(buildApplication({
        phone_country_code: '+62',
        phone_number: '081234567890',
        emergency_country_code: '62',
        emergency_phone_number: '0811222333',
        contact_relation: 'Mother',
        resume_url: 'https://example.com/cv.pdf',
      }));
      prisma.participant.findUnique.mockResolvedValue(bareParticipant);

      const dto = await handler.execute(new GetApplicationQuery('app-1', true));

      expect(dto.participant).toMatchObject({
        phoneNumber: '+6281234567890',
        emergencyContactPhone: '+62811222333',
        emergencyContactRelation: 'Mother',
        resumeUrl: 'https://example.com/cv.pdf',
      });
    });

    describe('phone validity flags', () => {
      const run = async (pd: Record<string, unknown>) => {
        applicationRepository.findById.mockResolvedValue(buildApplication(pd));
        prisma.participant.findUnique.mockResolvedValue(bareParticipant);
        return (await handler.execute(new GetApplicationQuery('app-1', true))).participant;
      };

      it('flags valid international numbers as valid', async () => {
        const p = await run({
          phone: '+923347354006',
          emergency_contact_country_code: '+92',
          emergency_contact_phone: '+923219343709',
        });
        expect(p?.phoneValid).toBe(true);
        expect(p?.emergencyContactPhoneValid).toBe(true);
      });

      it('flags malformed numbers as invalid without altering the displayed value', async () => {
        const p = await run({ phone: '+62123', emergency_contact_phone: '+9212' });
        expect(p?.phoneNumber).toBe('+62123');
        expect(p?.phoneValid).toBe(false);
        expect(p?.emergencyContactPhoneValid).toBe(false);
      });

      it('uses personal_data nationality as region hint for numbers without a country code', async () => {
        const valid = await run({ phone: '081234567890', nationality: 'ID' });
        expect(valid?.phoneValid).toBe(true);
        const noHint = await run({ phone: '081234567890' });
        expect(noHint?.phoneValid).toBe(false);
      });

      it('returns null when there is no number', async () => {
        const p = await run({});
        expect(p?.phoneNumber).toBeNull();
        expect(p?.phoneValid).toBeNull();
        expect(p?.emergencyContactPhoneValid).toBeNull();
      });
    });
  });

  describe('submissionForm inputType', () => {
    function formField(name: string, type: string, validationRules: unknown) {
      return {
        id: `field-${name}`,
        programId: 'program-1',
        name,
        label: name,
        type,
        section: 'personal_info',
        isRequired: false,
        options: null,
        placeholder: null,
        validationRules,
        allowedCategories: [],
        order: 1,
      };
    }

    async function fieldsFor(rows: ReturnType<typeof formField>[]) {
      applicationRepository.findById.mockResolvedValue(buildApplication({ nationality: 'ZA' }));
      prisma.participant.findUnique.mockResolvedValue({
        id: 'participant-1',
        fullName: 'John Doe',
        birthdate: null,
        user: { email: 'john@example.com' },
      });
      prisma.applicationFormField.findMany.mockResolvedValue(rows);
      const dto = await handler.execute(new GetApplicationQuery('app-1', true));
      return dto.submissionForm?.sections.flatMap((section) => section.fields) ?? [];
    }

    it('exposes validationRules.inputType so a text field configured as country_select is detectable', async () => {
      const fields = await fieldsFor([
        formField('nationality', 'text', { inputType: 'country_select', legacyField: 'nationality' }),
      ]);

      expect(fields[0]?.inputType).toBe('country_select');
    });

    it('omits inputType when the rules are empty, absent, or not a string', async () => {
      const fields = await fieldsFor([
        formField('a', 'country', {}),
        formField('b', 'text', null),
        formField('c', 'text', { inputType: 42 }),
        formField('d', 'text', ['country_select']),
      ]);

      expect(fields).toHaveLength(4);
      for (const field of fields) expect(field).not.toHaveProperty('inputType');
    });
  });
});
