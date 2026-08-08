import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { LoaRenderDataService } from './loa-render-data.service';
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service';

describe('LoaRenderDataService', () => {
  let service: LoaRenderDataService;
  let prisma: jest.Mocked<PrismaService>;

  const mockApplication = {
    id: 'app-1',
    programId: 'program-1',
    personalData: null,
    participant: { fullName: 'John Doe' },
    participationCategory: { name: 'International' },
  };
  const mockProgram = {
    id: 'program-1',
    name: 'YBB 2026',
    year: 2026,
    startDate: new Date('2026-07-01'),
    endDate: new Date('2026-07-14'),
    location: 'Bali, Indonesia',
  };
  const defaultOpts = { documentNumber: 'LOA-2026-0001', signerName: '', signerTitle: '' };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LoaRenderDataService,
        {
          provide: PrismaService,
          useValue: {
            participantApplication: { findFirst: jest.fn() },
            program: { findUnique: jest.fn() },
          },
        },
      ],
    }).compile();

    service = module.get<LoaRenderDataService>(LoaRenderDataService);
    prisma = module.get(PrismaService) as jest.Mocked<PrismaService>;
  });

  it('throws NotFoundException when the application does not exist', async () => {
    (prisma.participantApplication.findFirst as jest.Mock).mockResolvedValue(null);

    await expect(service.buildSourceMapForApplication('missing-app', defaultOpts)).rejects.toThrow(NotFoundException);
    expect(prisma.program.findUnique).not.toHaveBeenCalled();
  });

  it('throws NotFoundException when the application programId points at a missing program', async () => {
    (prisma.participantApplication.findFirst as jest.Mock).mockResolvedValue(mockApplication);
    (prisma.program.findUnique as jest.Mock).mockResolvedValue(null);

    await expect(service.buildSourceMapForApplication('app-1', defaultOpts)).rejects.toThrow(NotFoundException);
  });

  it('splits "Program Name Batch N" into program.batch, and degrades new placeholders to "" (never "null"/"undefined") when participant fields are missing', async () => {
    const applicationWithNullableFields = {
      ...mockApplication,
      participant: {
        fullName: 'John Doe',
        // institution/nationality/birthdate/gender/originCountry/phoneCountryCode/
        // phoneNumber/major/occupation/user all intentionally absent to exercise the
        // null-guard fallback on every new placeholder.
      },
    };
    const programWithBatchSuffix = { ...mockProgram, name: 'Japan Youth Summit 2026 Batch 2' };

    (prisma.participantApplication.findFirst as jest.Mock).mockResolvedValue(applicationWithNullableFields);
    (prisma.program.findUnique as jest.Mock).mockResolvedValue(programWithBatchSuffix);

    const result = await service.buildSourceMapForApplication('app-1', {
      documentNumber: 'LOA-2026-0001',
      signerName: '',
      signerTitle: '',
    });

    expect(result.programDisplayName).toBe('Japan Youth Summit 2026');
    expect(result.programBatch).toBe('2');
    expect(result.sourceMap['program.batch']).toBe('2');
    expect(result.sourceMap['participant.nationality']).toBe('');
    expect(result.sourceMap['participant.birthdate']).toBe('');
    expect(result.sourceMap['participant.gender']).toBe('');
    expect(result.sourceMap['participant.originCountry']).toBe('');
    expect(result.sourceMap['signer_name']).toBe('');
    expect(result.sourceMap['signer_title']).toBe('');
    expect(result.sourceMap['program.year']).toBe('2026');
    expect(result.sourceMap['participant.email']).toBe('');
    expect(result.sourceMap['participant.phone']).toBe('');
    expect(result.sourceMap['participant.major']).toBe('');
    expect(result.sourceMap['participant.occupation']).toBe('');

    for (const value of Object.values(result.sourceMap)) {
      expect(value).not.toBe('null');
      expect(value).not.toBe('undefined');
    }
  });

  describe('personalData fallback for institution/nationality/major/occupation', () => {
    it('(a) takes institution/nationality/major/occupation from personalData when present', async () => {
      (prisma.participantApplication.findFirst as jest.Mock).mockResolvedValue({
        ...mockApplication,
        personalData: {
          institution: 'Harvard University',
          nationality: 'American',
          major: 'Computer Science',
          occupation: 'Student',
        },
        participant: { fullName: 'John Doe', institution: '', nationality: '', major: '', occupation: '', gender: 'male' },
      });
      (prisma.program.findUnique as jest.Mock).mockResolvedValue(mockProgram);

      const result = await service.buildSourceMapForApplication('app-1', defaultOpts);

      expect(result.sourceMap['participant.institution']).toBe('Harvard University');
      expect(result.sourceMap['participant.nationality']).toBe('American');
      expect(result.sourceMap['participant.major']).toBe('Computer Science');
      expect(result.sourceMap['participant.occupation']).toBe('Student');
    });

    it('(b) falls back to the participant column when personalData lacks the key or is null', async () => {
      (prisma.participantApplication.findFirst as jest.Mock).mockResolvedValue({
        ...mockApplication,
        personalData: { institution: 'Harvard University' },
        participant: {
          fullName: 'John Doe',
          institution: 'Should Be Overridden',
          nationality: 'Indonesian',
          major: 'Biology',
          occupation: 'Engineer',
          gender: 'male',
        },
      });
      (prisma.program.findUnique as jest.Mock).mockResolvedValue(mockProgram);

      const result = await service.buildSourceMapForApplication('app-1', defaultOpts);

      expect(result.sourceMap['participant.institution']).toBe('Harvard University');
      expect(result.sourceMap['participant.nationality']).toBe('Indonesian');
      expect(result.sourceMap['participant.major']).toBe('Biology');
      expect(result.sourceMap['participant.occupation']).toBe('Engineer');
    });

    it('(b2) falls back to the participant column when personalData itself is null', async () => {
      (prisma.participantApplication.findFirst as jest.Mock).mockResolvedValue({
        ...mockApplication,
        personalData: null,
        participant: {
          fullName: 'John Doe',
          institution: 'Fallback University',
          nationality: 'Indonesian',
          major: 'Biology',
          occupation: 'Engineer',
          gender: 'male',
        },
      });
      (prisma.program.findUnique as jest.Mock).mockResolvedValue(mockProgram);

      const result = await service.buildSourceMapForApplication('app-1', defaultOpts);

      expect(result.sourceMap['participant.institution']).toBe('Fallback University');
      expect(result.sourceMap['participant.nationality']).toBe('Indonesian');
      expect(result.sourceMap['participant.major']).toBe('Biology');
      expect(result.sourceMap['participant.occupation']).toBe('Engineer');
    });

    it('(c) treats a whitespace-only personalData value as absent and falls back rather than rendering blank', async () => {
      (prisma.participantApplication.findFirst as jest.Mock).mockResolvedValue({
        ...mockApplication,
        personalData: { institution: '   ', nationality: '\t', major: '', occupation: '  ' },
        participant: {
          fullName: 'John Doe',
          institution: 'Fallback University',
          nationality: 'Indonesian',
          major: 'Biology',
          occupation: 'Engineer',
          gender: 'male',
        },
      });
      (prisma.program.findUnique as jest.Mock).mockResolvedValue(mockProgram);

      const result = await service.buildSourceMapForApplication('app-1', defaultOpts);

      expect(result.sourceMap['participant.institution']).toBe('Fallback University');
      expect(result.sourceMap['participant.nationality']).toBe('Indonesian');
      expect(result.sourceMap['participant.major']).toBe('Biology');
      expect(result.sourceMap['participant.occupation']).toBe('Engineer');
    });

    it('(e) takes birthdate from personalData (checking both birthdate and date_of_birth keys) over a real participant.birthdate', async () => {
      (prisma.participantApplication.findFirst as jest.Mock).mockResolvedValue({
        ...mockApplication,
        personalData: { birthdate: '1998-05-12' },
        participant: { fullName: 'John Doe', birthdate: new Date('1990-03-03T00:00:00.000Z'), gender: 'male' },
      });
      (prisma.program.findUnique as jest.Mock).mockResolvedValue(mockProgram);

      const result = await service.buildSourceMapForApplication('app-1', defaultOpts);

      expect(result.sourceMap['participant.birthdate']).toBe('12 May 1998');
    });

    it('(f) reads date_of_birth from personalData when the birthdate key is absent', async () => {
      (prisma.participantApplication.findFirst as jest.Mock).mockResolvedValue({
        ...mockApplication,
        personalData: { date_of_birth: '2001-11-20' },
        participant: { fullName: 'John Doe', gender: 'male' },
      });
      (prisma.program.findUnique as jest.Mock).mockResolvedValue(mockProgram);

      const result = await service.buildSourceMapForApplication('app-1', defaultOpts);

      expect(result.sourceMap['participant.birthdate']).toBe('20 November 2001');
    });

    it('(g) falls back to participant.birthdate when personalData has no birthdate, as long as it is a real (non-Jan-1) date', async () => {
      (prisma.participantApplication.findFirst as jest.Mock).mockResolvedValue({
        ...mockApplication,
        personalData: null,
        participant: { fullName: 'John Doe', birthdate: new Date('1995-07-20T00:00:00.000Z'), gender: 'male' },
      });
      (prisma.program.findUnique as jest.Mock).mockResolvedValue(mockProgram);

      const result = await service.buildSourceMapForApplication('app-1', defaultOpts);

      expect(result.sourceMap['participant.birthdate']).toBe('20 July 1995');
    });

    it('(h) renders blank rather than the onboarding year-only placeholder when personalData has no birthdate and participant.birthdate is Jan 1', async () => {
      (prisma.participantApplication.findFirst as jest.Mock).mockResolvedValue({
        ...mockApplication,
        personalData: null,
        participant: { fullName: 'John Doe', birthdate: new Date('1990-01-01T00:00:00.000Z'), gender: 'male' },
      });
      (prisma.program.findUnique as jest.Mock).mockResolvedValue(mockProgram);

      const result = await service.buildSourceMapForApplication('app-1', defaultOpts);

      expect(result.sourceMap['participant.birthdate']).toBe('');
    });

    it('(d) leaves an already-correct participant field (fullName, gender) unchanged', async () => {
      (prisma.participantApplication.findFirst as jest.Mock).mockResolvedValue({
        ...mockApplication,
        personalData: {
          institution: 'Harvard University',
          nationality: 'American',
          major: 'Computer Science',
          occupation: 'Student',
        },
        participant: { fullName: 'Jane Smith', institution: '', nationality: '', major: '', occupation: '', gender: 'female' },
      });
      (prisma.program.findUnique as jest.Mock).mockResolvedValue(mockProgram);

      const result = await service.buildSourceMapForApplication('app-1', defaultOpts);

      expect(result.sourceMap['participant.fullName']).toBe('Jane Smith');
      expect(result.sourceMap['participant.gender']).toBe('Female');
    });
  });
});
