import { BadRequestException } from '@nestjs/common';
import { ApplicationCategory } from '@prisma/client';
import {
  ensureParticipantExists,
  ensureProgramApplication,
  isProgramRegistrationOpen,
  resolveAuthTargetProgram,
  toProgramRegistrationInfo,
} from './auth-program-linking.util';

describe('auth-program-linking.util', () => {
  const baseProgram = {
    id: 'program-1',
    brandId: 'brand-1',
    name: 'Program 1',
    slug: 'program-1',
    year: 2026,
    status: 'published',
    isPublished: true,
    isActive: true,
    allowRegistration: true,
    registrationOpenDate: null,
    registrationCloseDate: null,
    startDate: new Date('2026-06-01T00:00:00.000Z'),
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
  };

  function createPrismaMock() {
    return {
      program: {
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn(),
      },
      participantApplication: {
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        create: jest.fn(),
      },
      programParticipationInfo: {
        findMany: jest.fn(),
      },
      // Registration-fee tiers for the per-category window check. Empty by
      // default = no category-level gate, so tests about other rules are
      // unaffected by it.
      programPricingTier: {
        findMany: jest.fn().mockResolvedValue([]),
      },
      participant: {
        findUnique: jest.fn(),
        create: jest.fn(),
      },
    } as any;
  }

  describe('ensureParticipantExists', () => {
    it('creates the participant with a blank name rather than the email local part', async () => {
      // Seeding "owais56" here deadlocked onboarding: the form prefills from
      // this column and the API's @IsEnglishName rejects digits, so the
      // participant could not submit without noticing they had to retype a
      // field they never filled in.
      const prisma = createPrismaMock();
      prisma.participant.findUnique.mockResolvedValue(null);
      prisma.participant.create.mockResolvedValue({ id: 'participant-1' });

      await ensureParticipantExists(prisma, 'user-1');

      expect(prisma.participant.create).toHaveBeenCalledWith({
        data: { userId: 'user-1', fullName: '' },
      });
    });

    it('returns the existing participant without creating another', async () => {
      const prisma = createPrismaMock();
      prisma.participant.findUnique.mockResolvedValue({ id: 'participant-1' });

      const result = await ensureParticipantExists(prisma, 'user-1');

      expect(result).toEqual({ id: 'participant-1' });
      expect(prisma.participant.create).not.toHaveBeenCalled();
    });
  });

  describe('isProgramRegistrationOpen', () => {
    it('returns false for a draft program regardless of the isPublished flag', () => {
      expect(
        isProgramRegistrationOpen({
          status: 'draft',
          isPublished: true,
          isActive: true,
          allowRegistration: true,
          registrationOpenDate: null,
          registrationCloseDate: null,
        }),
      ).toBe(false);
    });

    it('returns false when registrationCloseDate has passed', () => {
      expect(
        isProgramRegistrationOpen(
          {
            status: 'published',
            isPublished: true,
            isActive: true,
            allowRegistration: true,
            registrationOpenDate: new Date('2026-01-01T00:00:00.000Z'),
            registrationCloseDate: new Date('2026-01-31T00:00:00.000Z'),
          },
          new Date('2026-02-01T00:00:00.000Z'),
        ),
      ).toBe(false);
    });
  });

  describe('resolveAuthTargetProgram', () => {
    it('throws when the requested program belongs to a different brand', async () => {
      const prisma = createPrismaMock();
      prisma.program.findUnique.mockResolvedValue({ ...baseProgram, brandId: 'brand-2' });

      await expect(
        resolveAuthTargetProgram(prisma, {
          brandId: 'brand-1',
          programId: 'program-1',
        }),
      ).rejects.toThrow(new BadRequestException('Program does not belong to the selected brand'));
    });

    it('falls back to the latest open program when requested', async () => {
      const prisma = createPrismaMock();
      prisma.program.findMany.mockResolvedValue([baseProgram]);

      const result = await resolveAuthTargetProgram(prisma, {
        brandId: 'brand-1',
        fallbackToLatestOpenProgram: true,
      });

      expect(prisma.program.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ brandId: 'brand-1' }),
        }),
      );
      expect(result).toEqual(baseProgram);
    });

    it('excludes draft programs from the fallback even when isPublished was toggled on', async () => {
      // A draft program created with isPublished/isActive flipped true hijacked
      // every new signup for a brand until an admin noticed hours later: the
      // filter only knew about isPublished, never status.
      const prisma = createPrismaMock();
      prisma.program.findMany.mockResolvedValue([]);

      await resolveAuthTargetProgram(prisma, {
        brandId: 'brand-1',
        fallbackToLatestOpenProgram: true,
      });

      expect(prisma.program.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ status: 'published' }),
        }),
      );
    });

    it('prefers a program with a configured registration window over a later-starting one without', async () => {
      // The next season's program starts later, so ordering by startDate alone
      // handed it every registration while the season actually taking sign-ups
      // sat second in the list.
      const prisma = createPrismaMock();
      const nextSeason = {
        ...baseProgram,
        id: 'program-next',
        slug: 'program-next',
        year: 2027,
        startDate: new Date('2027-03-22T00:00:00.000Z'),
        registrationOpenDate: null,
        registrationCloseDate: null,
      };
      const currentSeason = {
        ...baseProgram,
        id: 'program-current',
        slug: 'program-current',
        year: 2026,
        startDate: new Date('2026-12-07T00:00:00.000Z'),
        registrationOpenDate: new Date('2026-04-30T17:01:00.000Z'),
        registrationCloseDate: new Date('2026-12-05T16:59:00.000Z'),
      };
      prisma.program.findMany.mockResolvedValue([nextSeason, currentSeason]);

      const result = await resolveAuthTargetProgram(prisma, {
        brandId: 'brand-1',
        fallbackToLatestOpenProgram: true,
      });

      expect(result).toEqual(currentSeason);
    });
  });

  describe('ensureProgramApplication', () => {
    it('returns existing when the participant already has an application for the target program', async () => {
      const prisma = createPrismaMock();
      prisma.program.findUnique.mockResolvedValue(baseProgram);
      prisma.participantApplication.findUnique.mockResolvedValue({
        id: 'application-1',
        participantId: 'participant-1',
        programId: 'program-1',
      });

      const result = await ensureProgramApplication(prisma, {
        participantId: 'participant-1',
        brandId: 'brand-1',
        programId: 'program-1',
      });

      expect(result).toEqual({ status: 'existing', program: baseProgram });
      expect(prisma.participantApplication.create).not.toHaveBeenCalled();
    });

    // Regression for the participants the create-guard came too late for: they
    // already HELD a phantom 7th draft, so the early 'existing' return named the
    // 7th as this login's program and the client pinned itself to it on every
    // login, hiding their 6th-edition invitation letter.
    it('does not name an existing application as the login program when the participant holds another in the brand', async () => {
      const prisma = createPrismaMock();
      prisma.program.findUnique.mockResolvedValue(baseProgram);
      // The phantom 7th draft on the requested (open) program.
      prisma.participantApplication.findUnique.mockResolvedValue({
        id: 'application-7th',
        participantId: 'participant-1',
        programId: 'program-1',
      });
      // ...and their real 6th-edition application in the same brand.
      prisma.participantApplication.findFirst.mockResolvedValue({ id: 'application-6th' });

      const result = await ensureProgramApplication(prisma, {
        participantId: 'participant-1',
        brandId: 'brand-1',
        programId: 'program-1',
        skipCreateIfBrandApplicationExists: true,
      });

      expect(prisma.participantApplication.findFirst).toHaveBeenCalledWith({
        where: {
          participantId: 'participant-1',
          program: { brandId: 'brand-1' },
          deletedAt: null,
          id: { not: 'application-7th' },
        },
        select: { id: true },
      });
      expect(result).toEqual({ status: 'missing_target' });
      expect(toProgramRegistrationInfo(result)).toBeUndefined();
      expect(prisma.participantApplication.create).not.toHaveBeenCalled();
    });

    it('still returns existing on login when that application is the only one in the brand', async () => {
      const prisma = createPrismaMock();
      prisma.program.findUnique.mockResolvedValue(baseProgram);
      prisma.participantApplication.findUnique.mockResolvedValue({
        id: 'application-1',
        participantId: 'participant-1',
        programId: 'program-1',
      });
      prisma.participantApplication.findFirst.mockResolvedValue(null);

      const result = await ensureProgramApplication(prisma, {
        participantId: 'participant-1',
        brandId: 'brand-1',
        programId: 'program-1',
        skipCreateIfBrandApplicationExists: true,
      });

      expect(result).toEqual({ status: 'existing', program: baseProgram });
      expect(toProgramRegistrationInfo(result)).toEqual({
        status: 'existing',
        programId: 'program-1',
        programName: 'Program 1',
      });
    });

    it('does not look for other applications on an existing hit when the guard is off', async () => {
      const prisma = createPrismaMock();
      prisma.program.findUnique.mockResolvedValue(baseProgram);
      prisma.participantApplication.findUnique.mockResolvedValue({ id: 'application-1' });

      const result = await ensureProgramApplication(prisma, {
        participantId: 'participant-1',
        brandId: 'brand-1',
        programId: 'program-1',
      });

      expect(result.status).toBe('existing');
      expect(prisma.participantApplication.findFirst).not.toHaveBeenCalled();
    });

    it('returns closed and does not create an application when registration is closed', async () => {
      const prisma = createPrismaMock();
      prisma.program.findUnique.mockResolvedValue({
        ...baseProgram,
        registrationCloseDate: new Date('2026-01-31T00:00:00.000Z'),
      });
      prisma.participantApplication.findUnique.mockResolvedValue(null);

      const result = await ensureProgramApplication(prisma, {
        participantId: 'participant-1',
        brandId: 'brand-1',
        programId: 'program-1',
      });

      expect(result).toEqual({
        status: 'closed',
        program: {
          ...baseProgram,
          registrationCloseDate: new Date('2026-01-31T00:00:00.000Z'),
        },
      });
      expect(prisma.participantApplication.create).not.toHaveBeenCalled();
    });

    it('creates an application using the best available category when registration is open', async () => {
      const prisma = createPrismaMock();
      prisma.program.findUnique.mockResolvedValue(baseProgram);
      prisma.participantApplication.findUnique.mockResolvedValue(null);
      prisma.programParticipationInfo.findMany.mockResolvedValue([
        {
          category: ApplicationCategory.fully_funded,
          isActive: true,
        },
        {
          category: ApplicationCategory.self_funded,
          isActive: true,
        },
      ]);
      prisma.participantApplication.create.mockResolvedValue({ id: 'application-new-1' });

      const result = await ensureProgramApplication(prisma, {
        participantId: 'participant-1',
        brandId: 'brand-1',
        programId: 'program-1',
      });

      expect(prisma.participantApplication.create).toHaveBeenCalledWith({
        data: {
          participantId: 'participant-1',
          programId: 'program-1',
          status: 'draft',
          applicationCategory: ApplicationCategory.fully_funded,
        },
        select: { id: true },
      });
      expect(result).toEqual({ status: 'created', program: baseProgram, applicationId: 'application-new-1' });
    });

    // Regression for the MEYS 6th/7th incident: the BFF attaches the brand's
    // currently-open program to EVERY login, so while two editions overlapped,
    // logging in enrolled 6th participants into the 7th. The phantom draft then
    // won the frontend's active-program selection and hid their real
    // application's documents.
    it('does not enrol a returning participant into a different open edition on login', async () => {
      const prisma = createPrismaMock();
      // The 7th: open, and the participant has no application for it yet.
      prisma.program.findUnique.mockResolvedValue(baseProgram);
      prisma.participantApplication.findUnique.mockResolvedValue(null);
      // ...but they already hold an application on this brand (the 6th).
      prisma.participantApplication.findFirst.mockResolvedValue({ id: 'application-6th' });

      const result = await ensureProgramApplication(prisma, {
        participantId: 'participant-1',
        brandId: 'brand-1',
        programId: 'program-1',
        skipCreateIfBrandApplicationExists: true,
      });

      expect(prisma.participantApplication.create).not.toHaveBeenCalled();
      // missing_target, so toProgramRegistrationInfo yields undefined and the
      // client is never told to switch programs.
      expect(result).toEqual({ status: 'missing_target' });
      expect(toProgramRegistrationInfo(result)).toBeUndefined();
    });

    it('still creates the first application in the brand when the login guard is set', async () => {
      const prisma = createPrismaMock();
      prisma.program.findUnique.mockResolvedValue(baseProgram);
      prisma.participantApplication.findUnique.mockResolvedValue(null);
      prisma.participantApplication.findFirst.mockResolvedValue(null);
      prisma.programParticipationInfo.findMany.mockResolvedValue([]);
      prisma.participantApplication.create.mockResolvedValue({ id: 'application-new-1' });

      const result = await ensureProgramApplication(prisma, {
        participantId: 'participant-1',
        brandId: 'brand-1',
        programId: 'program-1',
        skipCreateIfBrandApplicationExists: true,
      });

      expect(result.status).toBe('created');
    });

    it('leaves registration untouched: no brand lookup when the guard is off', async () => {
      const prisma = createPrismaMock();
      prisma.program.findUnique.mockResolvedValue(baseProgram);
      prisma.participantApplication.findUnique.mockResolvedValue(null);
      prisma.programParticipationInfo.findMany.mockResolvedValue([]);
      prisma.participantApplication.create.mockResolvedValue({ id: 'application-new-1' });

      await ensureProgramApplication(prisma, {
        participantId: 'participant-1',
        brandId: 'brand-1',
        programId: 'program-1',
      });

      expect(prisma.participantApplication.findFirst).not.toHaveBeenCalled();
      expect(prisma.participantApplication.create).toHaveBeenCalled();
    });

    it('throws when the requested application category is not offered by the program', async () => {
      const prisma = createPrismaMock();
      prisma.program.findUnique.mockResolvedValue(baseProgram);
      prisma.participantApplication.findUnique.mockResolvedValue(null);
      prisma.programParticipationInfo.findMany.mockResolvedValue([
        {
          category: ApplicationCategory.self_funded,
          isActive: true,
        },
      ]);

      await expect(
        ensureProgramApplication(prisma, {
          participantId: 'participant-1',
          brandId: 'brand-1',
          programId: 'program-1',
          applicationCategory: ApplicationCategory.fully_funded,
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('toProgramRegistrationInfo', () => {
    // Regression for the MEYS 6th/7th default-selection bug: the frontend's
    // active-program selector (ybb_active_program_id) is only synced off this
    // field, so 'created' and 'existing' - the outcomes of a NORMAL successful
    // signup/login - have to carry a programId too, not just 'closed'.
    it.each([
      ['created', baseProgram],
      ['existing', baseProgram],
      ['closed', { ...baseProgram, allowRegistration: false }],
    ] as const)('surfaces programId and programName for status %s', (status, program) => {
      const result = toProgramRegistrationInfo(
        { status, program } as unknown as Parameters<typeof toProgramRegistrationInfo>[0],
      );

      expect(result).toEqual({
        status,
        programId: program.id,
        programName: program.name,
      });
    });

    it('returns undefined for missing_target, which names no program', () => {
      const result = toProgramRegistrationInfo(
        { status: 'missing_target' } as unknown as Parameters<typeof toProgramRegistrationInfo>[0],
      );

      expect(result).toBeUndefined();
    });
  });

  // MEYS/CYS 2026: Fully Funded registration closed (its tier's validity
  // periods ended) while the programme-wide close date, which follows Self
  // Funded, was still ahead. Signup only checked the programme date, so old
  // ?applicationCategory=fully_funded links kept creating FF applications.
  describe('ensureProgramApplication per-category registration window', () => {
    const NOW = new Date('2026-09-17T05:00:00.000Z');
    const lapsed = [{ startDate: new Date('2026-07-01T00:00:00.000Z'), endDate: new Date('2026-09-05T00:00:00.000Z') }];
    const running = [{ startDate: new Date('2026-07-01T00:00:00.000Z'), endDate: new Date('2026-11-30T00:00:00.000Z') }];
    const future = [{ startDate: new Date('2026-10-01T00:00:00.000Z'), endDate: new Date('2026-11-30T00:00:00.000Z') }];
    const ffTier = (validityPeriods: typeof lapsed) => ({ allowedCategories: [ApplicationCategory.fully_funded], validityPeriods });
    const sfTier = (validityPeriods: typeof lapsed) => ({ allowedCategories: [ApplicationCategory.self_funded], validityPeriods });

    beforeEach(() => {
      jest.useFakeTimers({ now: NOW, doNotFake: ['nextTick', 'setImmediate'] });
    });
    afterEach(() => {
      jest.useRealTimers();
    });

    function openProgramPrisma(tiers: unknown[], participationInfos: unknown[] = []) {
      const prisma = createPrismaMock();
      prisma.program.findUnique.mockResolvedValue(baseProgram);
      prisma.participantApplication.findUnique.mockResolvedValue(null);
      prisma.programParticipationInfo.findMany.mockResolvedValue(participationInfos);
      prisma.programPricingTier.findMany.mockResolvedValue(tiers);
      prisma.participantApplication.create.mockResolvedValue({ id: 'application-new-1' });
      return prisma;
    }

    const createdCategory = (prisma: ReturnType<typeof createPrismaMock>) =>
      prisma.participantApplication.create.mock.calls[0][0].data.applicationCategory;

    it('reads only active, non-deleted registration_fee tiers of the target program', async () => {
      const prisma = openProgramPrisma([]);
      await ensureProgramApplication(prisma, { participantId: 'participant-1', brandId: 'brand-1', programId: 'program-1' });

      expect(prisma.programPricingTier.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { programId: 'program-1', isActive: true, deletedAt: null, feeType: 'registration_fee' },
        }),
      );
    });

    it('creates under Self Funded and reports the fallback when a closed Fully Funded is requested', async () => {
      const prisma = openProgramPrisma([ffTier(lapsed), sfTier(running)]);

      const result = await ensureProgramApplication(prisma, {
        participantId: 'participant-1',
        brandId: 'brand-1',
        programId: 'program-1',
        applicationCategory: ApplicationCategory.fully_funded,
      });

      expect(createdCategory(prisma)).toBe(ApplicationCategory.self_funded);
      const fallback = { requested: ApplicationCategory.fully_funded, assigned: ApplicationCategory.self_funded };
      expect(result).toEqual({
        status: 'created',
        program: baseProgram,
        applicationId: 'application-new-1',
        categoryFallback: fallback,
      });
      expect(toProgramRegistrationInfo(result)).toEqual({
        status: 'created',
        programId: baseProgram.id,
        programName: baseProgram.name,
        categoryFallback: fallback,
      });
    });

    it('keeps the requested Fully Funded while its window is open', async () => {
      const prisma = openProgramPrisma([ffTier(running), sfTier(running)]);

      const result = await ensureProgramApplication(prisma, {
        participantId: 'participant-1',
        brandId: 'brand-1',
        programId: 'program-1',
        applicationCategory: ApplicationCategory.fully_funded,
      });

      expect(createdCategory(prisma)).toBe(ApplicationCategory.fully_funded);
      expect(result).not.toHaveProperty('categoryFallback');
    });

    it('silently picks the open category when none was requested and the default has closed', async () => {
      // The participation-info default prefers Fully Funded.
      const prisma = openProgramPrisma(
        [ffTier(lapsed), sfTier(running)],
        [
          { category: ApplicationCategory.fully_funded, isActive: true },
          { category: ApplicationCategory.self_funded, isActive: true },
        ],
      );

      const result = await ensureProgramApplication(prisma, {
        participantId: 'participant-1',
        brandId: 'brand-1',
        programId: 'program-1',
      });

      expect(createdCategory(prisma)).toBe(ApplicationCategory.self_funded);
      expect(result).not.toHaveProperty('categoryFallback');
    });

    it('returns closed without creating when the requested category closed and nothing else is open', async () => {
      const prisma = openProgramPrisma([ffTier(lapsed), sfTier(lapsed)]);

      const result = await ensureProgramApplication(prisma, {
        participantId: 'participant-1',
        brandId: 'brand-1',
        programId: 'program-1',
        applicationCategory: ApplicationCategory.fully_funded,
      });

      expect(result).toEqual({ status: 'closed', program: baseProgram });
      expect(prisma.participantApplication.create).not.toHaveBeenCalled();
    });

    it('does not fall back to a category the programme does not offer', async () => {
      const prisma = openProgramPrisma(
        [ffTier(lapsed), sfTier(running)],
        [{ category: ApplicationCategory.fully_funded, isActive: true }],
      );

      const result = await ensureProgramApplication(prisma, {
        participantId: 'participant-1',
        brandId: 'brand-1',
        programId: 'program-1',
        applicationCategory: ApplicationCategory.fully_funded,
      });

      expect(result.status).toBe('closed');
      expect(prisma.participantApplication.create).not.toHaveBeenCalled();
    });

    it('does not fall back to a category with no registration tier at all', async () => {
      const prisma = openProgramPrisma([sfTier(lapsed)]);

      const result = await ensureProgramApplication(prisma, {
        participantId: 'participant-1',
        brandId: 'brand-1',
        programId: 'program-1',
        applicationCategory: ApplicationCategory.self_funded,
      });

      expect(result.status).toBe('closed');
    });

    it('leaves a category with no registration tier ungated', async () => {
      const prisma = openProgramPrisma([sfTier(running)]);

      const result = await ensureProgramApplication(prisma, {
        participantId: 'participant-1',
        brandId: 'brand-1',
        programId: 'program-1',
        applicationCategory: ApplicationCategory.fully_funded,
      });

      expect(createdCategory(prisma)).toBe(ApplicationCategory.fully_funded);
      expect(result.status).toBe('created');
    });

    it('keeps an upcoming category when nothing is open yet', async () => {
      const prisma = openProgramPrisma([ffTier(future), sfTier(future)]);

      const result = await ensureProgramApplication(prisma, {
        participantId: 'participant-1',
        brandId: 'brand-1',
        programId: 'program-1',
        applicationCategory: ApplicationCategory.fully_funded,
      });

      expect(createdCategory(prisma)).toBe(ApplicationCategory.fully_funded);
      expect(result).not.toHaveProperty('categoryFallback');
    });

    it('moves an upcoming request to an open category', async () => {
      const prisma = openProgramPrisma([ffTier(future), sfTier(running)]);

      const result = await ensureProgramApplication(prisma, {
        participantId: 'participant-1',
        brandId: 'brand-1',
        programId: 'program-1',
        applicationCategory: ApplicationCategory.fully_funded,
      });

      expect(createdCategory(prisma)).toBe(ApplicationCategory.self_funded);
      expect(result).toHaveProperty('categoryFallback', {
        requested: ApplicationCategory.fully_funded,
        assigned: ApplicationCategory.self_funded,
      });
    });

    it('never consults tier windows when the programme itself is closed', async () => {
      const prisma = createPrismaMock();
      prisma.program.findUnique.mockResolvedValue({ ...baseProgram, allowRegistration: false });
      prisma.participantApplication.findUnique.mockResolvedValue(null);

      const result = await ensureProgramApplication(prisma, {
        participantId: 'participant-1',
        brandId: 'brand-1',
        programId: 'program-1',
        applicationCategory: ApplicationCategory.fully_funded,
      });

      expect(result.status).toBe('closed');
      expect(prisma.programPricingTier.findMany).not.toHaveBeenCalled();
    });
  });
});
