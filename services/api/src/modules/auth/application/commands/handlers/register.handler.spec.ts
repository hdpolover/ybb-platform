
import { Test, TestingModule } from '@nestjs/testing';
import { RegisterHandler } from './register.handler';
import { ApplicationCategory } from '@prisma/client';
import { PrismaService } from '../../../../../shared/infrastructure/prisma/prisma.service';
import { UnitOfWork } from '../../../../../shared/infrastructure/database/unit-of-work.service';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { RabbitMQProducerService } from '../../../../../shared/infrastructure/rabbitmq/rabbitmq-producer.service';
import { AuthLoggingService } from '../../services/auth-logging.service';
import { MetricsService } from '../../../../../shared/infrastructure/monitoring/metrics.service';
import { GeoIpService } from '../../../../../shared/infrastructure/geoip/geoip.service';
import { RegisterCommand } from '../register.command';
import { BadRequestException, ConflictException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';

jest.mock('bcrypt', () => ({
  hash: jest.fn().mockResolvedValue('hashed_password'),
  compare: jest.fn().mockResolvedValue(true),
}));

describe('RegisterHandler', () => {
  let handler: RegisterHandler;
  let prismaService: any;
  let unitOfWork: any;
  let jwtService: any;
  let rabbitmqProducer: any;
  let authLoggingService: any;
  let metricsService: any;
  let geoIpService: any;

  const mockPrismaService = {
    authProvider: {
      findUnique: jest.fn(),
    },
    brand: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
    },
    program: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
    },
    ambassador: {
      findFirst: jest.fn(),
      update: jest.fn(),
    },
    user: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
      create: jest.fn(),
    },
    participant: {
      findUnique: jest.fn(),
      create: jest.fn(),
    },
    ambassadorReferral: {
      create: jest.fn(),
    },
    participantApplication: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
    },
    programParticipationInfo: {
      findMany: jest.fn(),
    },
    userIdentity: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    userSession: {
      create: jest.fn()
    }
  };

  const mockUnitOfWork = {
    execute: jest.fn(),
  };

  const mockJwtService = {
    sign: jest.fn().mockReturnValue('mock_token'),
  };

  const mockRabbitMQProducer = {
    emit: jest.fn(),
  };

  const mockAuthLoggingService = {
    parseUserAgent: jest.fn().mockReturnValue({
      deviceType: 'desktop',
      browser: 'chrome',
      os: 'mac',
    }),
    logRegistration: jest.fn(),
  };

  const mockMetricsService = {
    userRegistrationsTotal: {
      labels: jest.fn().mockReturnThis(),
      inc: jest.fn(),
    },
  };

  const mockGeoIpService = {
    lookup: jest.fn().mockReturnValue({
      country: 'ID',
      city: 'Jakarta',
    }),
  };

  const mockConfigService = {
    get: jest.fn((key: string, fallback?: string) => fallback),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RegisterHandler,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: UnitOfWork, useValue: mockUnitOfWork },
        { provide: JwtService, useValue: mockJwtService },
        { provide: RabbitMQProducerService, useValue: mockRabbitMQProducer },
        { provide: AuthLoggingService, useValue: mockAuthLoggingService },
        { provide: MetricsService, useValue: mockMetricsService },
        { provide: GeoIpService, useValue: mockGeoIpService },
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    handler = module.get<RegisterHandler>(RegisterHandler);
    prismaService = module.get<PrismaService>(PrismaService);
    unitOfWork = module.get<UnitOfWork>(UnitOfWork);
    jwtService = module.get<JwtService>(JwtService);
    rabbitmqProducer = module.get<RabbitMQProducerService>(RabbitMQProducerService);
    authLoggingService = module.get<AuthLoggingService>(AuthLoggingService);
    metricsService = module.get<MetricsService>(MetricsService);
    geoIpService = module.get<GeoIpService>(GeoIpService);

    jest.clearAllMocks();
    mockUnitOfWork.execute.mockImplementation(async (work: any) =>
      work({
        tx: {
          user: {
            create: mockPrismaService.user.create,
          },
          participant: {
            create: mockPrismaService.participant.create,
          },
        },
        createAmbassadorReferral: async ({ participantId, ambassadorId }: { participantId: string; ambassadorId: string }) =>
          mockPrismaService.ambassadorReferral.create({
            data: {
              ambassadorId,
              participantId,
              status: 'referred',
            },
          }),
        incrementAmbassadorReferrals: async (ambassadorId: string) =>
          mockPrismaService.ambassador.update({
            where: { id: ambassadorId },
            data: {
              totalReferrals: { increment: 1 },
              lastReferralAt: new Date(),
            },
          }),
      }),
    );
    mockPrismaService.participantApplication.findUnique.mockResolvedValue(null);
    mockPrismaService.programParticipationInfo.findMany.mockResolvedValue([]);
  });

  it('should be defined', () => {
    expect(handler).toBeDefined();
  });

  describe('execute', () => {
    const command = new RegisterCommand(
      'test@example.com',
      'provider-id-123',
      'password123',
      'category-id-123',
      'provider-user-id-123',
      undefined,
      'program-slug-123',
      'REFCODE',
      '127.0.0.1',
      'Mozilla/5.0',
    );

    it('should successfully register a new user with referral code', async () => {
        // Mock Provider
        mockPrismaService.authProvider.findUnique.mockResolvedValue({
            id: 'provider-id-123',
            name: 'local',
            isActive: true,
            isOAuth: false,
        });

        // Mock Category
        mockPrismaService.brand.findUnique.mockResolvedValue({
            id: 'category-id-123',
            isActive: true,
            name: 'Test Category',
            requireEmailVerification: false,
        });

        // Mock Program (by slug)
        mockPrismaService.program.findUnique.mockResolvedValue({
            id: 'program-id-123',
            brandId: 'category-id-123',
            status: 'published',
            isActive: true,
          isPublished: true,
          allowRegistration: true,
          registrationOpenDate: null,
          registrationCloseDate: null,
        });

        // Mock Ambassador (Referral)
        mockPrismaService.ambassador.findFirst.mockResolvedValue({
            id: 'ambassador-id-123',
            referralCode: 'REFCODE',
            isActive: true,
        });

        // Mock User (Not exists)
        mockPrismaService.user.findFirst.mockResolvedValue(null);

        // Mock Create User
        mockPrismaService.user.create.mockResolvedValue({
            id: 'new-user-id',
            email: 'test@example.com',
            brandId: 'category-id-123',
            isActive: true,
            isOnboardingCompleted: false,
            identities: [{ providerId: 'provider-id-123' }]
        });
        
        // Mock Participant (create)
        mockPrismaService.participant.findUnique.mockResolvedValue({
          id: 'participant-id-123',
          userId: 'new-user-id',
        });
        mockPrismaService.participant.create.mockResolvedValue({
            id: 'participant-id-123',
            userId: 'new-user-id',
        });

        // Mock Application (Not exists)
        mockPrismaService.participantApplication.findUnique.mockResolvedValue(null);

        const result = await handler.execute(command);

        // Verify User Creation
        expect(mockPrismaService.user.create).toHaveBeenCalled();
        const createArgs = mockPrismaService.user.create.mock.calls[0][0];
        expect(createArgs.data.email).toBe('test@example.com');
        
        // Verify Referral Lookup skips soft-deleted ambassadors and is scoped to the
        // program being registered for — an ambassador must not earn credit for a
        // referral into a program they are not an ambassador of.
        expect(mockPrismaService.ambassador.findFirst).toHaveBeenCalledWith({
            where: { referralCode: 'REFCODE', deletedAt: null, programId: 'program-id-123' },
        });

        // Verify Referral Tracking
        expect(mockPrismaService.ambassadorReferral.create).toHaveBeenCalledWith({
            data: {
                ambassadorId: 'ambassador-id-123',
                participantId: 'participant-id-123',
                status: 'referred',
            }
        });

        // Verify Application Creation
        expect(mockPrismaService.participantApplication.create).toHaveBeenCalledWith({
            data: {
                participantId: 'participant-id-123',
                programId: 'program-id-123',
                status: 'draft',
            applicationCategory: ApplicationCategory.self_funded,
            }
        });

        // Verify Stats Increment
        expect(mockPrismaService.ambassador.update).toHaveBeenCalledWith({
            where: { id: 'ambassador-id-123' },
            data: {
                totalReferrals: { increment: 1 },
                lastReferralAt: expect.any(Date),
            }
        });

        expect(result).toHaveProperty('accessToken', 'mock_token');
        expect(result).toHaveProperty('user');
    });

    it('should reject registration for an existing email without touching the account', async () => {
        mockPrismaService.authProvider.findUnique.mockResolvedValue({
            id: 'provider-id-123',
            name: 'local',
            isActive: true,
            isOAuth: false,
        });

        mockPrismaService.brand.findUnique.mockResolvedValue({
            id: 'category-id-123',
            isActive: true,
            name: 'Test Category',
            requireEmailVerification: false,
        });

        mockPrismaService.program.findUnique.mockResolvedValue({
            id: 'program-id-123',
            brandId: 'category-id-123',
            status: 'published',
            isActive: true,
            isPublished: true,
            allowRegistration: true,
            registrationOpenDate: null,
            registrationCloseDate: null,
        });

        mockPrismaService.ambassador.findFirst.mockResolvedValue(null);

        // Existing account, no local identity yet — the shape that previously let an
        // unauthenticated caller attach an identity and overwrite the password.
        mockPrismaService.user.findFirst.mockResolvedValue({
            id: 'victim-user-id',
            email: 'test@example.com',
            brandId: 'category-id-123',
            isActive: true,
            isOnboardingCompleted: true,
            identities: [],
        });

        await expect(handler.execute(command)).rejects.toThrow(ConflictException);

        expect(mockPrismaService.userIdentity.create).not.toHaveBeenCalled();
        expect(mockPrismaService.user.update).not.toHaveBeenCalled();
        expect(mockPrismaService.participant.create).not.toHaveBeenCalled();
        expect(mockPrismaService.participantApplication.create).not.toHaveBeenCalled();
        expect(mockJwtService.sign).not.toHaveBeenCalled();
    });

    it('should reject registration for an existing provider identity without issuing tokens', async () => {
        mockPrismaService.authProvider.findUnique.mockResolvedValue({
            id: 'provider-id-123',
            name: 'google',
            isActive: true,
            isOAuth: true,
        });

        mockPrismaService.brand.findUnique.mockResolvedValue({
            id: 'category-id-123',
            isActive: true,
            name: 'Test Category',
            requireEmailVerification: false,
        });

        mockPrismaService.program.findUnique.mockResolvedValue({
            id: 'program-id-123',
            brandId: 'category-id-123',
            status: 'published',
            isActive: true,
            isPublished: true,
            allowRegistration: true,
            registrationOpenDate: null,
            registrationCloseDate: null,
        });

        mockPrismaService.ambassador.findFirst.mockResolvedValue(null);
        mockPrismaService.user.findFirst.mockResolvedValue(null);

        mockPrismaService.userIdentity.findFirst.mockResolvedValue({
            id: 'identity-id-123',
            user: {
                id: 'victim-user-id',
                email: 'test@example.com',
                brandId: 'category-id-123',
                isActive: true,
                isOnboardingCompleted: true,
            },
        });

        await expect(handler.execute(command)).rejects.toThrow(ConflictException);

        expect(mockJwtService.sign).not.toHaveBeenCalled();
        expect(mockPrismaService.userIdentity.update).not.toHaveBeenCalled();
        expect(mockPrismaService.participantApplication.create).not.toHaveBeenCalled();
    });

    it('should throw BadRequestException if program slug is invalid', async () => {
         // Mock Provider
         mockPrismaService.authProvider.findUnique.mockResolvedValue({
            id: 'provider-id-123',
            name: 'local',
            isActive: true,
        });

        // Mock Category
        mockPrismaService.brand.findUnique.mockResolvedValue({
            id: 'category-id-123',
            isActive: true,
        });

        // Mock Program (by slug) - Return Null
        mockPrismaService.program.findUnique.mockResolvedValue(null);

        await expect(handler.execute(command)).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException if password is missing for local auth', async () => {
        // Mock Provider
        mockPrismaService.authProvider.findUnique.mockResolvedValue({
            id: 'provider-id-123',
            name: 'local',
            isActive: true,
        });
        
         // Mock Category
         mockPrismaService.brand.findUnique.mockResolvedValue({
            id: 'category-id-123',
            isActive: true,
            name: 'Test Category',
            requireEmailVerification: false,
        });

         // Mock Program (by slug)
         mockPrismaService.program.findUnique.mockResolvedValue({
            id: 'program-id-123',
            brandId: 'category-id-123',
            isActive: true,
        });
        
         // Mock User (Not exists)
         mockPrismaService.user.findFirst.mockResolvedValue(null);

        const noPassCommand = new RegisterCommand(
            'test@example.com', 'provider-id-123', '', 'category-id-123',
            'pid', 'program-id', '', '', '', ''
        );

        await expect(handler.execute(noPassCommand)).rejects.toThrow(BadRequestException);
    });

    it('should infer Program ID from active program if slug/id missing', async () => {
        const minimalCommand = new RegisterCommand(
            'test@example.com',
            'provider-id-123',
            'password123',
            'category-id-123',
            'provider-user-id-123',
            undefined,
            undefined, // No Slug
            undefined, // No Referral
            '127.0.0.1',
            'Mozilla/5.0',
        );

        // Mock Provider
        mockPrismaService.authProvider.findUnique.mockResolvedValue({
            id: 'provider-id-123',
            name: 'local',
            isActive: true,
            isOAuth: false,
        });

        // Mock Category
        mockPrismaService.brand.findUnique.mockResolvedValue({
            id: 'category-id-123',
            isActive: true,
            name: 'Test Category',
        });

        // Mock Latest Program
        mockPrismaService.program.findMany.mockResolvedValue([
          {
            id: 'latest-program-id',
            brandId: 'category-id-123',
            status: 'published',
            isActive: true,
            isPublished: true,
            allowRegistration: true,
            registrationOpenDate: null,
            registrationCloseDate: null,
            startDate: new Date('2026-06-01T00:00:00.000Z'),
            createdAt: new Date('2026-01-01T00:00:00.000Z'),
          },
        ]);
        mockPrismaService.program.findUnique.mockResolvedValue({
          id: 'latest-program-id',
          brandId: 'category-id-123',
          status: 'published',
          isActive: true,
          isPublished: true,
          allowRegistration: true,
          registrationOpenDate: null,
          registrationCloseDate: null,
        });

        // Mock User (Not exists)
        mockPrismaService.user.findFirst.mockResolvedValue(null);

        // Mock Create User
        mockPrismaService.user.create.mockResolvedValue({
            id: 'new-user-id',
            email: 'test@example.com',
            brandId: 'category-id-123',
            identities: [{ providerId: 'provider-id-123' }]
        });

         // Mock Participant (create)
         mockPrismaService.participant.findUnique.mockResolvedValue({
           id: 'participant-id-123',
           userId: 'new-user-id',
         });
         mockPrismaService.participant.create.mockResolvedValue({
             id: 'participant-id-123',
             userId: 'new-user-id',
         });
 
         // Mock Application (Not exists)
         mockPrismaService.participantApplication.findUnique.mockResolvedValue(null);

        await handler.execute(minimalCommand);

        // Verify Application Created for Latest Program
        expect(mockPrismaService.participantApplication.create).toHaveBeenCalledWith({
            data: {
                participantId: 'participant-id-123',
                programId: 'latest-program-id',
                status: 'draft',
            applicationCategory: ApplicationCategory.self_funded,
            }
        });
    });
  });
});
