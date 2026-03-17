import { BadRequestException } from '@nestjs/common';
import { ApplicationCategory } from '@prisma/client';
import {
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
      },
      participantApplication: {
        findUnique: jest.fn(),
        create: jest.fn(),
      },
      programParticipationInfo: {
        findMany: jest.fn(),
      },
    } as any;
  }

  describe('isProgramRegistrationOpen', () => {
    it('returns false when registrationCloseDate has passed', () => {
      expect(
        isProgramRegistrationOpen(
          {
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
      prisma.program.findFirst.mockResolvedValue(baseProgram);

      const result = await resolveAuthTargetProgram(prisma, {
        brandId: 'brand-1',
        fallbackToLatestOpenProgram: true,
      });

      expect(prisma.program.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ brandId: 'brand-1' }),
        }),
      );
      expect(result).toEqual(baseProgram);
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