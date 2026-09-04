// src/modules/auth/application/commands/handlers/firebase-login.handler.spec.ts

import { Test, TestingModule } from '@nestjs/testing';
import { FirebaseLoginHandler } from './firebase-login.handler';
import { FirebaseLoginCommand } from '../firebase-login.command';
import { PrismaService } from '../../../../../shared/infrastructure/prisma/prisma.service';
import { UnitOfWork } from '../../../../../shared/infrastructure/database/unit-of-work.service';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { FirebaseAuthService } from '../../../infrastructure/services/firebase-auth.service';
import { AuthLoggingService } from '../../services/auth-logging.service';
import { GeoIpService } from '../../../../../shared/infrastructure/geoip/geoip.service';
import { MetricsService } from '../../../../../shared/infrastructure/monitoring/metrics.service';
import { resolveAuthTargetProgram, ensureProgramApplication } from '../../services/auth-program-linking.util';
import { ApplicationCategory } from '@prisma/client';

jest.mock('../../services/auth-program-linking.util');

describe('FirebaseLoginHandler - existing-participant referral attribution', () => {
  let handler: FirebaseLoginHandler;

  const mockPrismaService = {
    brand: {
      findFirst: jest.fn(),
    },
    authProvider: {
      findUnique: jest.fn(),
    },
    userIdentity: {
      findFirst: jest.fn(),
      create: jest.fn(),
    },
    user: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    participant: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    ambassador: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    ambassadorReferral: {
      findFirst: jest.fn(),
      create: jest.fn(),
    },
    participantApplication: {
      findFirst: jest.fn(),
    },
    userSession: {
      create: jest.fn(),
    },
    $transaction: jest.fn(),
  };

  const mockUnitOfWork = {
    execute: jest.fn(),
  };

  const mockJwtService = {
    sign: jest.fn(),
  };

  const mockConfigService = {
    get: jest.fn((key: string, fallback?: string) => fallback),
  };

  const mockFirebaseAuthService = {
    verifyIdToken: jest.fn(),
  };

  const mockAuthLoggingService = {
    logSuccessfulLogin: jest.fn(),
  };

  const mockGeoIpService = {
    lookup: jest.fn(),
  };

  const mockMetricsService = {
    loginTotal: { inc: jest.fn() },
    userRegistrationsTotal: { inc: jest.fn() },
  };

  // Shared fixtures
  const existingUser = {
    id: 'user-id-123',
    email: 'test@example.com',
    brandId: 'brand-id-123',
    isActive: true,
    isOnboardingCompleted: false,
    failedLoginAttempts: 0,
  };

  const existingParticipant = {
    id: 'participant-id-123',
    userId: 'user-id-123',
  };

  const existingAmbassador = {
    id: 'ambassador-id-123',
    referralCode: 'REFCODE',
    isActive: true,
    totalReferrals: 5,
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FirebaseLoginHandler,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: UnitOfWork, useValue: mockUnitOfWork },
        { provide: JwtService, useValue: mockJwtService },
        { provide: ConfigService, useValue: mockConfigService },
        { provide: FirebaseAuthService, useValue: mockFirebaseAuthService },
        { provide: AuthLoggingService, useValue: mockAuthLoggingService },
        { provide: GeoIpService, useValue: mockGeoIpService },
        { provide: MetricsService, useValue: mockMetricsService },
      ],
    }).compile();

    handler = module.get<FirebaseLoginHandler>(FirebaseLoginHandler);

    jest.clearAllMocks();

    // --- Login plumbing defaults (happy path) ---

    mockFirebaseAuthService.verifyIdToken.mockResolvedValue({
      email: 'test@example.com',
      uid: 'firebase-uid-123',
      picture: null,
      firebase: { sign_in_provider: 'google.com' },
      email_verified: true,
      name: 'Test User',
    });

    // Auth provider found via providerId
    mockPrismaService.authProvider.findUnique.mockResolvedValue({
      id: 'provider-id-123',
      name: 'google',
      isActive: true,
    });

    // User identity found -> user exists (skips user creation branch)
    mockPrismaService.userIdentity.findFirst.mockResolvedValue({
      id: 'identity-id-123',
      userId: existingUser.id,
      user: existingUser,
    });

    // Participant already exists (triggers the existing-participant attribution path)
    mockPrismaService.participant.findUnique.mockResolvedValue(existingParticipant);

    // Program-linking utilities are stubbed
    (resolveAuthTargetProgram as jest.Mock).mockResolvedValue(null);
    mockPrismaService.participantApplication.findFirst.mockResolvedValue(null);
    (ensureProgramApplication as jest.Mock).mockResolvedValue({
      status: 'existing',
      program: { id: 'prog-1', name: 'Test Program', slug: 'test-program', year: 2024 },
    });

    // UnitOfWork safety net (should not be called for existing-participant tests)
    mockUnitOfWork.execute.mockImplementation(async (work: any) =>
      work({
        tx: {
          participant: {
            create: jest.fn().mockResolvedValue(existingParticipant),
          },
        },
        createAmbassadorReferral: jest.fn(),
        incrementAmbassadorReferrals: jest.fn(),
      }),
    );

    // Token generation
    mockJwtService.sign.mockReturnValue('mock_token');
    mockConfigService.get.mockImplementation((_key: string, fallback?: string) => fallback);

    // Session creation
    mockPrismaService.userSession.create.mockResolvedValue({ id: 'session-id' });
    mockGeoIpService.lookup.mockReturnValue({ country: 'ID', city: 'Jakarta' });
    mockAuthLoggingService.logSuccessfulLogin.mockResolvedValue(undefined);

    // lastLoginAt update
    mockPrismaService.user.update.mockResolvedValue(existingUser);

    // Final user fetch (for registeredPrograms)
    mockPrismaService.user.findUnique.mockResolvedValue({
      ...existingUser,
      participant: {
        id: existingParticipant.id,
        applications: [],
      },
    });

    // $transaction: execute all ops in the received array
    mockPrismaService.$transaction.mockImplementation(async (ops: Promise<any>[]) =>
      Promise.all(ops),
    );
  });

  it('should be defined', () => {
    expect(handler).toBeDefined();
  });

  describe('attributeExistingParticipantReferral', () => {
    it('attributes referral to an existing participant when referralCode is provided and none exists yet', async () => {
      // No existing referral for this participant
      mockPrismaService.ambassadorReferral.findFirst.mockResolvedValue(null);
      mockPrismaService.ambassador.findUnique.mockResolvedValue(existingAmbassador);
      mockPrismaService.ambassadorReferral.create.mockResolvedValue({ id: 'new-ref-id' });
      mockPrismaService.ambassador.update.mockResolvedValue({
        ...existingAmbassador,
        totalReferrals: 6,
      });
      mockPrismaService.participant.update.mockResolvedValue({
        ...existingParticipant,
        referralCode: 'REFCODE',
      });

      const command = new FirebaseLoginCommand(
        'firebase-id-token',
        'provider-id-123',
        '127.0.0.1',
        'Mozilla/5.0 Chrome/120',
        'brand-id-123',
        undefined,
        undefined,
        'REFCODE',
      );

      const result = await handler.execute(command);

      // Login must still succeed
      expect(result).toHaveProperty('accessToken', 'mock_token');

      // Referral record created with correct data
      expect(mockPrismaService.ambassadorReferral.create).toHaveBeenCalledWith({
        data: {
          ambassadorId: existingAmbassador.id,
          participantId: existingParticipant.id,
          status: 'referred',
        },
      });

      // Ambassador totalReferrals incremented by 1
      expect(mockPrismaService.ambassador.update).toHaveBeenCalledWith({
        where: { id: existingAmbassador.id },
        data: {
          totalReferrals: { increment: 1 },
          lastReferralAt: expect.any(Date),
        },
      });

      // All three ops ran inside a single $transaction
      expect(mockPrismaService.$transaction).toHaveBeenCalledTimes(1);
    });

    it('is idempotent: does NOT create or increment when the participant already has a referral', async () => {
      // Participant already has an ambassador referral
      mockPrismaService.ambassadorReferral.findFirst.mockResolvedValue({
        id: 'existing-ref-id',
      });

      const command = new FirebaseLoginCommand(
        'firebase-id-token',
        'provider-id-123',
        '127.0.0.1',
        'Mozilla/5.0 Chrome/120',
        'brand-id-123',
        undefined,
        undefined,
        'REFCODE',
      );

      const result = await handler.execute(command);

      // Login must still succeed (attribution is best-effort, never blocks login)
      expect(result).toHaveProperty('accessToken', 'mock_token');

      // Idempotency guard fired: the existing referral was checked
      expect(mockPrismaService.ambassadorReferral.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({ where: { participantId: existingParticipant.id } }),
      );

      // No create, no update, no transaction
      expect(mockPrismaService.ambassadorReferral.create).not.toHaveBeenCalled();
      expect(mockPrismaService.ambassador.update).not.toHaveBeenCalled();
      expect(mockPrismaService.$transaction).not.toHaveBeenCalled();
    });

    it('does not run attribution when referralCode is omitted', async () => {
      const command = new FirebaseLoginCommand(
        'firebase-id-token',
        'provider-id-123',
        '127.0.0.1',
        'Mozilla/5.0 Chrome/120',
        'brand-id-123',
        undefined,
        undefined,
        undefined, // no referralCode
      );

      const result = await handler.execute(command);

      // Login must still succeed
      expect(result).toHaveProperty('accessToken', 'mock_token');

      // Attribution path never entered
      expect(mockPrismaService.ambassadorReferral.findFirst).not.toHaveBeenCalled();
      expect(mockPrismaService.ambassadorReferral.create).not.toHaveBeenCalled();
      expect(mockPrismaService.$transaction).not.toHaveBeenCalled();
    });
  });

  // Regression: Google signups sent programSlug but never applicationCategory,
  // so ensureProgramApplication always fell through to its self_funded default
  // (auth-program-linking.util.ts) even when the participant picked Fully
  // Funded on the edition-choice screen. The email/password path (RegisterDto)
  // already carried this field; Firebase was the one path that dropped it.
  describe('applicationCategory passthrough', () => {
    it('forwards the requested applicationCategory to ensureProgramApplication', async () => {
      const command = new FirebaseLoginCommand(
        'firebase-id-token',
        'provider-id-123',
        '127.0.0.1',
        'Mozilla/5.0 Chrome/120',
        'brand-id-123',
        undefined,
        'meys-7th',
        undefined,
        ApplicationCategory.fully_funded,
      );

      await handler.execute(command);

      expect(ensureProgramApplication).toHaveBeenCalledWith(
        mockPrismaService,
        expect.objectContaining({ applicationCategory: ApplicationCategory.fully_funded }),
      );
    });

    it('leaves applicationCategory undefined when the request omits it, so the util can apply its own default', async () => {
      const command = new FirebaseLoginCommand(
        'firebase-id-token',
        'provider-id-123',
        '127.0.0.1',
        'Mozilla/5.0 Chrome/120',
        'brand-id-123',
      );

      await handler.execute(command);

      expect(ensureProgramApplication).toHaveBeenCalledWith(
        mockPrismaService,
        expect.objectContaining({ applicationCategory: undefined }),
      );
    });
  });

  // Regression: the final `registeredPrograms` fetch had no orderBy, so
  // availableIds[0] on the frontend's active-program selector
  // (ybb-program-next/lib/dashboard/activeProgram.ts) was whichever row
  // Postgres happened to return first for a multi-program participant.
  describe('registeredPrograms application ordering', () => {
    it('orders applications by createdAt desc so availableIds[0] is deterministic', async () => {
      const command = new FirebaseLoginCommand(
        'firebase-id-token',
        'provider-id-123',
        '127.0.0.1',
        'Mozilla/5.0 Chrome/120',
        'brand-id-123',
      );

      await handler.execute(command);

      expect(mockPrismaService.user.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({
          include: expect.objectContaining({
            participant: expect.objectContaining({
              include: expect.objectContaining({
                applications: expect.objectContaining({
                  orderBy: { createdAt: 'desc' },
                }),
              }),
            }),
          }),
        }),
      );
    });
  });

  // A Firebase sign-in resets failedLoginAttempts. If it does so while a
  // lockout is running it refunds the guesser a full MAX_FAILED_LOGIN_ATTEMPTS
  // for the moment lockedUntil expires — a bypass of the lockout the password
  // and ambassador routes rely on. No failures are counted here (a
  // Firebase-signed token cannot be brute-forced); it just must not CLEAR one.
  describe('lockout is not cleared by a Firebase sign-in', () => {
    const lockedUser = {
      ...existingUser,
      failedLoginAttempts: 5,
      lockedUntil: new Date(Date.now() + 60_000),
    };

    const command = () =>
      new FirebaseLoginCommand(
        'firebase-id-token',
        'provider-id-123',
        '127.0.0.1',
        'Mozilla/5.0 Chrome/120',
        'brand-id-123',
      );

    it('leaves the counter alone while the account is locked', async () => {
      mockPrismaService.userIdentity.findFirst.mockResolvedValue({
        id: 'identity-id-123',
        userId: lockedUser.id,
        user: lockedUser,
      });

      await handler.execute(command());

      expect(mockPrismaService.user.update).toHaveBeenCalledWith({
        where: { id: lockedUser.id },
        data: { lastLoginAt: expect.any(Date) },
      });
      expect(mockPrismaService.user.update).not.toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ failedLoginAttempts: 0 }) }),
      );
    });

    it('still resets the counter once the lockout has expired', async () => {
      mockPrismaService.userIdentity.findFirst.mockResolvedValue({
        id: 'identity-id-123',
        userId: lockedUser.id,
        user: { ...lockedUser, lockedUntil: new Date(Date.now() - 60_000) },
      });

      await handler.execute(command());

      expect(mockPrismaService.user.update).toHaveBeenCalledWith({
        where: { id: lockedUser.id },
        data: { failedLoginAttempts: 0, lastLoginAt: expect.any(Date) },
      });
    });
  });
});
