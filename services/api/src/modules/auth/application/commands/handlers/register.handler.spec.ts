
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
import { hashToken } from '@shared/utils/hash-token.util';
import { GeoIpService } from '../../../../../shared/infrastructure/geoip/geoip.service';
import { RegisterCommand } from '../register.command';
import { BadRequestException, ConflictException, Logger } from '@nestjs/common';
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
      findMany: jest.fn(),
      create: jest.fn().mockResolvedValue({ id: 'application-created-1' }),
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
    },
    // Audit M142: ambassador referral linking now runs AFTER the
    // registration transaction commits, via its own small
    // this.prisma.$transaction([create, update]) (array form) - not through
    // UnitOfWork/repos.createAmbassadorReferral any more. Array-form
    // $transaction just needs to resolve the passed promises.
    $transaction: jest.fn((ops: unknown[]) => Promise.all(ops)),
  };

  const mockUnitOfWork = {
    execute: jest.fn(),
  };

  const mockJwtService = {
    sign: jest.fn().mockReturnValue('mock_token'),
  };

  const mockRabbitMQProducer = {
    emit: jest.fn(),
    emitSafe: jest.fn().mockResolvedValue(true),
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
    // Audit M142: the transaction callback now only creates the user and
    // participant - ambassador referral linking is a best-effort call made
    // AFTER this transaction commits (see RegisterHandler.linkAmbassadorReferral),
    // not part of the work UnitOfWork.execute runs here.
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
      }),
    );
    mockPrismaService.participantApplication.findUnique.mockResolvedValue(null);
    // getRegisteredPrograms (shared auth-program-linking.util helper, audit
    // M128) — queries off the already-loaded newParticipant.id, no user
    // re-fetch.
    mockPrismaService.participantApplication.findMany.mockResolvedValue([]);
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
        // BRAND being registered under — an ambassador holds one brand-wide code, so
        // a referral must not earn credit for a participant registering under a
        // different brand.
        expect(mockPrismaService.ambassador.findFirst).toHaveBeenCalledWith({
            where: { referralCode: 'REFCODE', deletedAt: null, user: { brandId: 'category-id-123' } },
        });

        // Verify Referral Tracking — attributed to the target program resolved for
        // this registration. Runs AFTER the registration transaction commits
        // (audit M142), via RegisterHandler.linkAmbassadorReferral's own
        // this.prisma.$transaction([create, update]) — not through
        // UnitOfWork/repos any more.
        expect(mockPrismaService.ambassadorReferral.create).toHaveBeenCalledWith({
            data: {
                participantId: 'participant-id-123',
                ambassadorId: 'ambassador-id-123',
                programId: 'program-id-123',
                referredAt: expect.any(Date),
            }
        });

        // Verify Application Creation
        expect(mockPrismaService.participantApplication.create).toHaveBeenCalledWith({
            data: {
                participantId: 'participant-id-123',
                programId: 'program-id-123',
                status: 'draft',
            applicationCategory: ApplicationCategory.self_funded,
            },
            select: { id: true },
        });

        // Verify Stats Increment
        expect(mockPrismaService.ambassador.update).toHaveBeenCalledWith({
            where: { id: 'ambassador-id-123' },
            data: {
                totalReferrals: { increment: 1 },
            }
        });

        expect(result).toHaveProperty('accessToken', 'mock_token');
        expect(result).toHaveProperty('user');

        // Audit M128: registeredPrograms is built off the already-loaded
        // newParticipant.id (queried via participant.findUnique above), not a
        // fresh user.findUnique re-fetch with a 3-level include.
        expect(mockPrismaService.user.findUnique).not.toHaveBeenCalled();
        expect(mockPrismaService.participantApplication.findMany).toHaveBeenCalledWith({
            where: { participantId: 'participant-id-123', program: { brandId: 'category-id-123' } },
            include: { program: true },
        });
    });

    // Audit M142: a try/catch INSIDE the registration transaction used to
    // swallow exactly this failure, which — under Postgres aborted-transaction
    // semantics — silently rolled back the just-created user/participant while
    // the handler carried on as if registration had succeeded. Referral
    // linking now runs after the transaction has committed, so a failure here
    // must be logged and swallowed WITHOUT affecting the registration result.
    it('logs and swallows an ambassador referral link failure without failing registration — regression for M142', async () => {
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
        mockPrismaService.ambassador.findFirst.mockResolvedValue({
            id: 'ambassador-id-123',
            referralCode: 'REFCODE',
            isActive: true,
        });
        mockPrismaService.user.findFirst.mockResolvedValue(null);
        mockPrismaService.user.create.mockResolvedValue({
            id: 'new-user-id',
            email: 'test@example.com',
            brandId: 'category-id-123',
            isActive: true,
            isOnboardingCompleted: false,
            identities: [{ providerId: 'provider-id-123' }],
        });
        mockPrismaService.participant.findUnique.mockResolvedValue({
            id: 'participant-id-123',
            userId: 'new-user-id',
        });
        mockPrismaService.participant.create.mockResolvedValue({
            id: 'participant-id-123',
            userId: 'new-user-id',
        });
        mockPrismaService.participantApplication.findUnique.mockResolvedValue(null);

        // Simulates a real FK/unique-constraint failure on the referral write.
        mockPrismaService.$transaction.mockRejectedValueOnce(new Error('unique constraint violation'));

        const errorSpy = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);

        const result = await handler.execute(command);

        // The already-committed user registration must still succeed.
        expect(result).toHaveProperty('accessToken', 'mock_token');
        expect(result).toHaveProperty('user');
        expect(mockPrismaService.user.create).toHaveBeenCalled();

        // The failure must be logged loudly, not silently discarded.
        expect(errorSpy).toHaveBeenCalledWith(
            expect.stringContaining('Failed to link ambassador referral'),
        );

        errorSpy.mockRestore();
    });

    it('awaits the verification email publish and logs an error (without failing registration) when the broker publish fails — regression for M86/M131', async () => {
        // Mock Provider (local, so the verify-email branch is reachable)
        mockPrismaService.authProvider.findUnique.mockResolvedValue({
            id: 'provider-id-123',
            name: 'local',
            isActive: true,
            isOAuth: false,
        });

        // requireEmailVerification: true so an emailVerificationToken is minted
        // and the 'user.verify-email' emit is actually reached.
        mockPrismaService.brand.findUnique.mockResolvedValue({
            id: 'category-id-123',
            isActive: true,
            name: 'Test Category',
            requireEmailVerification: true,
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
            // Program-level setting wins over the brand-level default set
            // above (see register.handler.ts) — must also be true here so
            // the token is actually minted.
            requireEmailVerification: true,
        });

        mockPrismaService.ambassador.findFirst.mockResolvedValue(null);
        mockPrismaService.user.findFirst.mockResolvedValue(null);
        mockPrismaService.user.create.mockResolvedValue({
            id: 'new-user-id',
            email: 'test@example.com',
            brandId: 'category-id-123',
            isActive: true,
            isOnboardingCompleted: false,
            identities: [{ providerId: 'provider-id-123' }],
        });
        mockPrismaService.participant.findUnique.mockResolvedValue({
            id: 'participant-id-123',
            userId: 'new-user-id',
        });
        mockPrismaService.participant.create.mockResolvedValue({
            id: 'participant-id-123',
            userId: 'new-user-id',
        });
        mockPrismaService.participantApplication.findUnique.mockResolvedValue(null);

        // The underlying broker publish "fails" — emitSafe never rejects, it
        // resolves false. This is exactly what a broker hiccup looks like to
        // callers now that the fire-and-forget .emit() call has been replaced.
        mockRabbitMQProducer.emitSafe.mockResolvedValueOnce(false);

        const errorSpy = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);

        const result = await handler.execute(command);

        // The publish must have been awaited with the verification token —
        // not fired-and-forgotten.
        expect(mockRabbitMQProducer.emitSafe).toHaveBeenCalledWith(
            'user.verify-email',
            expect.objectContaining({ email: 'test@example.com', token: expect.any(String) }),
        );

        // A failed publish must be logged loudly, not swallowed.
        expect(errorSpy).toHaveBeenCalledWith(
            expect.stringContaining('Failed to publish verification email'),
        );

        // Registration itself must still succeed — a broker hiccup must not
        // cost the user their whole registration.
        expect(result).toHaveProperty('accessToken', 'mock_token');
        expect(result).toHaveProperty('user');

        errorSpy.mockRestore();
    });

    // Audit M144: only the hash goes into the user row; the raw token is
    // what gets emitted for the verification email link.
    it('persists only the sha256 hash of the email verification token, while the emitted event carries the matching raw token', async () => {
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
            requireEmailVerification: true,
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
            requireEmailVerification: true,
        });
        mockPrismaService.ambassador.findFirst.mockResolvedValue(null);
        mockPrismaService.user.findFirst.mockResolvedValue(null);
        mockPrismaService.user.create.mockResolvedValue({
            id: 'new-user-id',
            email: 'test@example.com',
            brandId: 'category-id-123',
            isActive: true,
            isOnboardingCompleted: false,
            identities: [{ providerId: 'provider-id-123' }],
        });
        mockPrismaService.participant.findUnique.mockResolvedValue({
            id: 'participant-id-123',
            userId: 'new-user-id',
        });
        mockPrismaService.participant.create.mockResolvedValue({
            id: 'participant-id-123',
            userId: 'new-user-id',
        });
        mockPrismaService.participantApplication.findUnique.mockResolvedValue(null);
        mockRabbitMQProducer.emitSafe.mockResolvedValueOnce(true);

        await handler.execute(command);

        const persistedHash: string = mockPrismaService.user.create.mock.calls[0][0].data.emailVerificationToken;
        const rawToken: string = mockRabbitMQProducer.emitSafe.mock.calls[0][1].token;

        expect(persistedHash).toBe(hashToken(rawToken));
        expect(persistedHash).not.toBe(rawToken);

        // Audit M144 (widened): the userSession row created for this same
        // registration must hold the hashed refresh token too, not the raw
        // signed JWT the response returns.
        expect(mockPrismaService.userSession.create).toHaveBeenCalledWith(
            expect.objectContaining({
                data: expect.objectContaining({ refreshToken: hashToken('mock_token') }),
            }),
        );
    });

    it('persists ad click ids captured at signup onto the new participant, with a capturedAt stamp', async () => {
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
        mockPrismaService.user.findFirst.mockResolvedValue(null);
        mockPrismaService.user.create.mockResolvedValue({
            id: 'new-user-id',
            email: 'test@example.com',
            brandId: 'category-id-123',
            isActive: true,
            isOnboardingCompleted: false,
        });
        mockPrismaService.participant.findUnique.mockResolvedValue({
            id: 'participant-id-123',
            userId: 'new-user-id',
        });
        mockPrismaService.participant.create.mockResolvedValue({
            id: 'participant-id-123',
            userId: 'new-user-id',
        });
        mockPrismaService.participantApplication.findUnique.mockResolvedValue(null);

        const commandWithAttribution = new RegisterCommand(
            'test@example.com',
            'provider-id-123',
            'password123',
            'category-id-123',
            'provider-user-id-123',
            undefined,
            'program-slug-123',
            undefined,
            '127.0.0.1',
            'Mozilla/5.0',
            undefined,
            { fbp: 'fb.1.111.222', fbc: 'fb.1.111.click', ttclid: 'tt-click-1' },
        );

        await handler.execute(commandWithAttribution);

        const createArgs = mockPrismaService.participant.create.mock.calls[0][0];
        expect(createArgs.data.adAttribution).toEqual({
            fbp: 'fb.1.111.222',
            fbc: 'fb.1.111.click',
            ttclid: 'tt-click-1',
            capturedAt: expect.any(String),
        });
    });

    it('writes undefined (no column write) when no ad attribution was captured', async () => {
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
        mockPrismaService.user.findFirst.mockResolvedValue(null);
        mockPrismaService.user.create.mockResolvedValue({
            id: 'new-user-id',
            email: 'test@example.com',
            brandId: 'category-id-123',
            isActive: true,
            isOnboardingCompleted: false,
        });
        mockPrismaService.participant.findUnique.mockResolvedValue({
            id: 'participant-id-123',
            userId: 'new-user-id',
        });
        mockPrismaService.participant.create.mockResolvedValue({
            id: 'participant-id-123',
            userId: 'new-user-id',
        });
        mockPrismaService.participantApplication.findUnique.mockResolvedValue(null);

        await handler.execute(command);

        const createArgs = mockPrismaService.participant.create.mock.calls[0][0];
        expect(createArgs.data.adAttribution).toBeUndefined();
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
            },
            select: { id: true },
        });
    });
  });
});
