import { BadRequestException } from '@nestjs/common';
import { ApplicationCategory } from '@prisma/client';
import {
  ensureParticipantExists,
  ensureProgramApplication,
  isProgramRegistrationOpen,
  resolveAuthTargetProgram,
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
        create: jest.fn(),
      },
      programParticipationInfo: {
        findMany: jest.fn(),
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
      });
      expect(result).toEqual({ status: 'created', program: baseProgram });
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
});