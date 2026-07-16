import { Test, TestingModule } from '@nestjs/testing';
import { StatsService } from './stats.service';
import { PrismaReadService } from '../../shared/infrastructure/prisma/prisma-read.service';
import { CacheService } from '../../shared/infrastructure/cache/cache.service';
import { StatSection } from './dto/get-stats.dto';

describe('StatsService', () => {
  let service: StatsService;
  const mockPrismaService = {
    brand: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
    },
    program: {
      findUnique: jest.fn(),
    },
    participant: {
      count: jest.fn(),
      groupBy: jest.fn(),
    },
    participantApplication: {
      count: jest.fn(),
      findMany: jest.fn(),
    },
    ambassador: {
      count: jest.fn(),
      findMany: jest.fn(),
    },
    ambassadorReferral: {
      count: jest.fn(),
    },
    $queryRaw: jest.fn(),
  };
  const mockCacheService = {
    get: jest.fn(),
    set: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StatsService,
        { provide: PrismaReadService, useValue: mockPrismaService },
        { provide: CacheService, useValue: mockCacheService },
      ],
    }).compile();

    service = module.get<StatsService>(StatsService);
    jest.clearAllMocks();
  });

  it('returns impact stats using normalized distinct countries', async () => {
    mockPrismaService.brand.findUnique.mockResolvedValue({ id: 'brand-1' });
    mockCacheService.get.mockResolvedValue(null);
    mockPrismaService.participant.count.mockResolvedValue(120);
    mockPrismaService.participant.groupBy.mockResolvedValue([
      { originCountry: 'ID', _count: { id: 40 } },
      { originCountry: 'Indonesia', _count: { id: 20 } },
      { originCountry: 'JP', _count: { id: 10 } },
      { originCountry: null, _count: { id: 5 } },
    ]);
    mockPrismaService.participantApplication.count.mockResolvedValue(32);

    const result = await service.getStats({
      brandId: 'brand-1',
      sections: [StatSection.IMPACT],
    });

    expect(result.impact).toEqual({
      total_participants: 120,
      total_countries: 2,
      alumni: 32,
    });
  });

  it('returns geography stats with distinct-country total from raw SQL', async () => {
    mockPrismaService.brand.findUnique.mockResolvedValue({ id: 'brand-1' });
    mockCacheService.get.mockResolvedValue(null);
    mockPrismaService.participant.count.mockResolvedValue(10);
    mockPrismaService.participant.groupBy.mockResolvedValue([
      { originCountry: 'ID', _count: { id: 4 } },
      { originCountry: 'Indonesia', _count: { id: 2 } },
      { originCountry: 'JP', _count: { id: 2 } },
      { originCountry: '', _count: { id: 1 } },
    ]);

    const result = await service.getStats({
      brandId: 'brand-1',
      sections: [StatSection.GEOGRAPHY],
      page: 1,
      limit: 2,
    });

    expect(result.geography).toEqual({
      items: [
        { country: 'Indonesia', participants: 6, percentage: 60 },
        { country: 'Japan', participants: 2, percentage: 20 },
      ],
      meta: {
        total: 2,
        page: 1,
        limit: 2,
        totalPages: 1,
      },
    });
  });

  it('returns dashboard funnel stats for registered users, started forms, and submitted applications', async () => {
    mockPrismaService.program.findUnique.mockResolvedValue({
      id: 'program-1',
      status: 'published',
      isActive: true,
      registrationCloseDate: new Date('2026-07-15T07:00:00.000Z'),
      endDate: null,
    });
    mockPrismaService.participantApplication.findMany.mockResolvedValue([
      {
        createdAt: new Date(),
        lastEditedAt: null,
        submittedAt: null,
        status: 'draft',
        participant: {
          gender: 'female',
          birthdate: new Date('2004-04-02'),
          originCountry: 'ID',
          nationality: 'Indonesia',
          profileCompletedAt: null,
        },
      },
      {
        createdAt: new Date('2026-05-05T00:00:00.000Z'),
        lastEditedAt: new Date('2026-05-05T10:00:00.000Z'),
        submittedAt: null,
        status: 'draft',
        participant: {
          gender: 'male',
          birthdate: new Date('2001-06-12'),
          originCountry: 'JP',
          nationality: 'Japan',
          profileCompletedAt: new Date('2026-05-05T09:00:00.000Z'),
        },
      },
      {
        createdAt: new Date('2026-05-04T00:00:00.000Z'),
        lastEditedAt: new Date('2026-05-04T08:00:00.000Z'),
        submittedAt: new Date('2026-05-04T09:00:00.000Z'),
        status: 'submitted',
        participant: {
          gender: null,
          birthdate: null,
          originCountry: null,
          nationality: '',
          profileCompletedAt: new Date('2026-05-04T08:00:00.000Z'),
        },
      },
    ]);
    mockPrismaService.ambassador.count
      .mockResolvedValueOnce(5)
      .mockResolvedValueOnce(4);
    mockPrismaService.ambassadorReferral.count.mockResolvedValue(2);
    mockPrismaService.ambassador.findMany.mockResolvedValue([
      {
        fullName: 'Alya Putri',
        institution: 'Tokyo University',
        successfulReferrals: 2,
        totalReferrals: 3,
        _count: { referrals: 3 },
        user: {
          participant: {
            originCountry: 'ID',
            nationality: 'Indonesia',
          },
        },
      },
    ]);

    const result = await service.getAdminProgramDashboard('program-1');

    expect(result.kpis).toEqual({
      registeredUsers: 3,
      registrationsToday: 1,
      formsStarted: 2,
      submittedApplications: 1,
      registeredOnly: 1,
      totalAmbassadors: 5,
      activeAmbassadors: 4,
      referredParticipants: 2,
      referredParticipantsPercent: 66.7,
      programStatus: 'active',
      programStatusDate: '2026-07-15T07:00:00.000Z',
    });
    expect(result.topAmbassadors).toEqual([
      { name: 'Alya Putri', country: 'Indonesia', referrals: 2 },
    ]);
    expect(result.nationalities).toEqual([
      { country: 'Indonesia', count: 1 },
      { country: 'Japan', count: 1 },
    ]);
    expect(result.gender).toEqual([
      { name: 'Female', value: 1 },
      { name: 'Male', value: 1 },
      { name: 'Unknown', value: 1 },
    ]);
  });
});
