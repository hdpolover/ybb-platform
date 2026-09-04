import { Test, TestingModule } from '@nestjs/testing';
import { UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { LoginHandler } from './login.handler';
import { LoginCommand } from '../login.command';
import { PrismaService } from '../../../../../shared/infrastructure/prisma/prisma.service';
import { AuthLoggingService } from '../../services/auth-logging.service';
import { GeoIpService } from '../../../../../shared/infrastructure/geoip/geoip.service';
import { MetricsService } from '../../../../../shared/infrastructure/monitoring/metrics.service';

jest.mock('bcrypt', () => ({
  compare: jest.fn().mockResolvedValue(true),
}));

describe('LoginHandler', () => {
  let handler: LoginHandler;

  const mockPrismaService = {
    brand: {
      findFirst: jest.fn(),
    },
    user: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
    },
    participant: {
      findUnique: jest.fn(),
      create: jest.fn(),
    },
    participantApplication: {
      findUnique: jest.fn(),
      create: jest.fn(),
    },
    program: {
      findUnique: jest.fn(),
    },
    programParticipationInfo: {
      findMany: jest.fn(),
    },
    userIdentity: {
      update: jest.fn(),
    },
    userSession: {
      create: jest.fn(),
    },
  };

  const mockJwtService = {
    sign: jest.fn().mockReturnValue('mock-token'),
  };

  const mockConfigService = {
    get: jest.fn((key: string, fallback?: string) => fallback),
  };

  const mockAuthLoggingService = {
    logFailedLogin: jest.fn(),
    logSuccessfulLogin: jest.fn(),
  };

  const mockGeoIpService = {
    lookup: jest.fn().mockReturnValue({
      country: 'ID',
      city: 'Jakarta',
    }),
  };

  const mockMetricsService = {
    loginTotal: {
      inc: jest.fn(),
    },
  };

  const brandOneUser = {
    id: 'user-brand-1',
    email: 'same@example.com',
    brandId: 'brand-1',
    isActive: true,
    emailVerified: true,
    passwordHash: 'hashed-password',
    failedLoginAttempts: 0,
    isOnboardingCompleted: false,
    brand: {
      id: 'brand-1',
      requireEmailVerification: true,
    },
    identities: [
      {
        id: 'identity-1',
        providerId: 'provider-local',
        provider: { name: 'local' },
      },
    ],
    admin: null,
  };

  const brandTwoUser = {
    ...brandOneUser,
    id: 'user-brand-2',
    brandId: 'brand-2',
    brand: {
      id: 'brand-2',
      requireEmailVerification: true,
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LoginHandler,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: JwtService, useValue: mockJwtService },
        { provide: ConfigService, useValue: mockConfigService },
        { provide: AuthLoggingService, useValue: mockAuthLoggingService },
        { provide: GeoIpService, useValue: mockGeoIpService },
        { provide: MetricsService, useValue: mockMetricsService },
      ],
    }).compile();

    handler = module.get<LoginHandler>(LoginHandler);

    jest.clearAllMocks();
    (bcrypt.compare as jest.Mock).mockResolvedValue(true);
    mockPrismaService.brand.findFirst.mockResolvedValue({ id: 'brand-1' });
    mockPrismaService.participant.findUnique.mockResolvedValue({
      id: 'participant-1',
      userId: 'user-brand-1',
    });
    mockPrismaService.participantApplication.findUnique.mockResolvedValue({
      id: 'application-1',
      participantId: 'participant-1',
      programId: 'program-1',
    });
    mockPrismaService.program.findUnique.mockResolvedValue({
      id: 'program-1',
      brandId: 'brand-1',
      name: 'Brand One Program',
      slug: 'brand-one-program',
      year: 2026,
      isPublished: true,
      isActive: true,
      allowRegistration: true,
      registrationOpenDate: null,
      registrationCloseDate: null,
      startDate: new Date('2026-06-01T00:00:00.000Z'),
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
    });
    mockPrismaService.programParticipationInfo.findMany.mockResolvedValue([]);
    // findFirst handles email-based auth lookups (case-insensitive)
    mockPrismaService.user.findFirst.mockImplementation(async ({ where }: any) => {
      if (where?.brandId === 'brand-1') {
        return brandOneUser;
      }

      if (where?.brandId === 'brand-2') {
        return brandTwoUser;
      }

      return null;
    });

    // findUnique handles id-based lookups (getRegisteredPrograms helper)
    mockPrismaService.user.findUnique.mockImplementation(async ({ where }: any) => {
      if (where?.id === 'user-brand-1') {
        return {
          participant: {
            applications: [
              {
                id: 'application-1',
                programId: 'program-1',
                status: 'draft',
                program: {
                  id: 'program-1',
                  name: 'Brand One Program',
                  slug: 'brand-one-program',
                  year: 2026,
                },
              },
            ],
          },
        };
      }

      if (where?.id === 'user-brand-2') {
        return {
          participant: {
            applications: [
              {
                id: 'application-2',
                programId: 'program-2',
                status: 'draft',
                program: {
                  id: 'program-2',
                  name: 'Brand Two Program',
                  slug: 'brand-two-program',
                  year: 2026,
                },
              },
            ],
          },
        };
      }

      return null;
    });
  });

  it('logs into the account scoped to the explicit brand for the same email', async () => {
    const command = new LoginCommand(
      'same@example.com',
      'password123',
      '127.0.0.1',
      'Mozilla/5.0',
      'brand-2',
    );

    const result = await handler.execute(command);

    expect(mockPrismaService.user.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          email: { equals: 'same@example.com', mode: 'insensitive' },
          brandId: 'brand-2',
          deletedAt: null,
        },
      }),
    );
    expect(result.user.id).toBe('user-brand-2');
    expect(result.user.brandId).toBe('brand-2');
    expect(result.user.registeredPrograms).toEqual([
      expect.objectContaining({
        programId: 'program-2',
        programSlug: 'brand-two-program',
      }),
    ]);
  });

  it('resolves the brand from domain and logs into the matching same-email account', async () => {
    mockPrismaService.brand.findFirst
      .mockResolvedValueOnce({ id: 'brand-2' });
    mockPrismaService.program.findUnique.mockResolvedValue({
      id: 'program-2',
      brandId: 'brand-2',
      name: 'Brand Two Program',
      slug: 'brand-two-program',
      year: 2026,
      isPublished: true,
      isActive: true,
      allowRegistration: true,
      registrationOpenDate: null,
      registrationCloseDate: null,
      startDate: new Date('2026-06-01T00:00:00.000Z'),
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      requireEmailVerification: false,
    });

    const command = new LoginCommand(
      'same@example.com',
      'password123',
      '127.0.0.1',
      'Mozilla/5.0',
      undefined,
      'program-2',
    );

    const result = await handler.execute(command, 'brand-two.example.com');

    expect(mockPrismaService.brand.findFirst).toHaveBeenCalledWith({
      where: {
        websiteUrl: 'brand-two.example.com',
        isActive: true,
      },
      select: { id: true },
    });
    expect(mockPrismaService.user.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          email: { equals: 'same@example.com', mode: 'insensitive' },
          brandId: 'brand-2',
          deletedAt: null,
        },
      }),
    );
    expect(result.user.id).toBe('user-brand-2');
    expect(result.user.brandId).toBe('brand-2');
  });

  it('does not auto-create an application when the requested program is closed', async () => {
    mockPrismaService.participant.findUnique.mockResolvedValue({
      id: 'participant-1',
      userId: 'user-brand-1',
    });
    mockPrismaService.participantApplication.findUnique.mockResolvedValue(null);
    mockPrismaService.program.findUnique.mockResolvedValue({
      id: 'program-closed',
      brandId: 'brand-1',
      name: 'Closed Program',
      slug: 'closed-program',
      year: 2026,
      isPublished: true,
      isActive: true,
      allowRegistration: true,
      registrationOpenDate: new Date('2026-01-01T00:00:00.000Z'),
      registrationCloseDate: new Date('2026-01-31T00:00:00.000Z'),
      startDate: new Date('2026-06-01T00:00:00.000Z'),
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
    });

    const command = new LoginCommand(
      'same@example.com',
      'password123',
      '127.0.0.1',
      'Mozilla/5.0',
      'brand-1',
      'program-closed',
    );

    const result = await handler.execute(command);

    expect(mockPrismaService.participantApplication.create).not.toHaveBeenCalled();
    expect(result.user.id).toBe('user-brand-1');
    expect(result.user.registeredPrograms).toEqual([
      expect.objectContaining({
        programId: 'program-1',
        programSlug: 'brand-one-program',
      }),
    ]);
  });

  it('rejects login when the brand-scoped account does not exist', async () => {
    mockPrismaService.user.findFirst.mockResolvedValueOnce(null);

    const command = new LoginCommand(
      'missing@example.com',
      'password123',
      '127.0.0.1',
      'Mozilla/5.0',
      'brand-1',
    );

    await expect(handler.execute(command)).rejects.toThrow(UnauthorizedException);
  });

  it('rejects unverified user when selected program requires verification even if brand does not', async () => {
    mockPrismaService.user.findFirst.mockResolvedValueOnce({
      ...brandOneUser,
      emailVerified: false,
      brand: {
        ...brandOneUser.brand,
        requireEmailVerification: false,
      },
    });

    mockPrismaService.program.findUnique.mockResolvedValueOnce({
      id: 'program-1',
      brandId: 'brand-1',
      requireEmailVerification: true,
    });

    const command = new LoginCommand(
      'same@example.com',
      'password123',
      '127.0.0.1',
      'Mozilla/5.0',
      'brand-1',
      'program-1',
    );

    await expect(handler.execute(command)).rejects.toThrow(
      'Email not verified. Please verify your email before logging in.',
    );

    expect(mockPrismaService.program.findUnique).toHaveBeenCalledWith({
      where: { id: 'program-1' },
      select: {
        brandId: true,
        requireEmailVerification: true,
      },
    });
  });

  it('allows unverified user when selected program does not require verification even if brand does', async () => {
    mockPrismaService.user.findFirst.mockImplementationOnce(async () => ({
      ...brandOneUser,
      emailVerified: false,
      brand: {
        ...brandOneUser.brand,
        requireEmailVerification: true,
      },
    }));

    mockPrismaService.program.findUnique.mockResolvedValueOnce({
      id: 'program-1',
      brandId: 'brand-1',
      requireEmailVerification: false,
    });

    const command = new LoginCommand(
      'same@example.com',
      'password123',
      '127.0.0.1',
      'Mozilla/5.0',
      'brand-1',
      'program-1',
    );

    const result = await handler.execute(command);
    expect(result.user.id).toBe('user-brand-1');
  });

  it('rejects login while the account is locked out, without checking the password', async () => {
    mockPrismaService.user.findFirst.mockResolvedValueOnce({
      ...brandOneUser,
      lockedUntil: new Date(Date.now() + 60_000),
    });

    const command = new LoginCommand(
      'same@example.com',
      'password123',
      '127.0.0.1',
      'Mozilla/5.0',
      'brand-1',
    );

    await expect(handler.execute(command)).rejects.toThrow(
      'Too many failed attempts. Try again later.',
    );
    expect(bcrypt.compare).not.toHaveBeenCalled();
  });

  it('locks the account once failed attempts reach the threshold', async () => {
    (bcrypt.compare as jest.Mock).mockResolvedValueOnce(false);
    mockPrismaService.user.findFirst.mockResolvedValueOnce({
      ...brandOneUser,
      failedLoginAttempts: 4,
    });
    // The counter is incremented BY THE DATABASE and the lock is decided from
    // what that increment returned, so this stale read no longer picks the
    // written value — which is the point: N concurrent failures used to all
    // write the same n+1 and the lock never tripped.
    mockPrismaService.user.update.mockResolvedValue({ failedLoginAttempts: 5 });

    const command = new LoginCommand(
      'same@example.com',
      'wrong-password',
      '127.0.0.1',
      'Mozilla/5.0',
      'brand-1',
    );

    await expect(handler.execute(command)).rejects.toThrow(UnauthorizedException);

    expect(mockPrismaService.user.update).toHaveBeenCalledWith({
      where: { id: 'user-brand-1' },
      data: { failedLoginAttempts: { increment: 1 }, lastFailedLogin: expect.any(Date) },
      select: { failedLoginAttempts: true },
    });
    // The lock also ZEROES the streak. Without that the counter is a one-way
    // latch: lockedUntil expires, the count is still at the threshold, and the
    // next single failure re-locks — forever, from any IP.
    expect(mockPrismaService.user.update).toHaveBeenLastCalledWith({
      where: { id: 'user-brand-1' },
      data: { lockedUntil: expect.any(Date), failedLoginAttempts: 0 },
    });
  });
});