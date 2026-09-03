// src/modules/auth/application/commands/handlers/ambassador-login.handler.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service';
import { GeoIpService } from '@shared/infrastructure/geoip/geoip.service';
import { MetricsService } from '@shared/infrastructure/monitoring/metrics.service';
import { AuthLoggingService } from '../../services/auth-logging.service';
import { AmbassadorLoginHandler } from './ambassador-login.handler';
import { AmbassadorLoginCommand } from '../ambassador-login.command';

describe('AmbassadorLoginHandler', () => {
    let handler: AmbassadorLoginHandler;

    const BRAND_ID = 'brand-1';
    const USER_ID = 'user-1';

    const mockPrismaService = {
        brand: { findFirst: jest.fn() },
        user: { findFirst: jest.fn(), update: jest.fn() },
        ambassador: { findFirst: jest.fn() },
        userSession: { create: jest.fn() },
    };
    const mockAuthLoggingService = {
        logFailedLogin: jest.fn(),
        logSuccessfulLogin: jest.fn(),
    };
    const mockMetricsService = { loginTotal: { inc: jest.fn() } };
    const mockGeoIpService = { lookup: jest.fn().mockReturnValue({ country: 'ID', city: 'Surabaya' }) };
    const mockJwtService = { sign: jest.fn().mockReturnValue('mock_token') };
    const mockConfigService = { get: jest.fn().mockReturnValue('1h') };

    const command = new AmbassadorLoginCommand(
        'ambassador@example.com',
        'URO19948',
        '127.0.0.1',
        'node',
        BRAND_ID,
    );

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [
                AmbassadorLoginHandler,
                { provide: PrismaService, useValue: mockPrismaService },
                { provide: JwtService, useValue: mockJwtService },
                { provide: ConfigService, useValue: mockConfigService },
                { provide: AuthLoggingService, useValue: mockAuthLoggingService },
                { provide: GeoIpService, useValue: mockGeoIpService },
                { provide: MetricsService, useValue: mockMetricsService },
            ],
        }).compile();

        handler = module.get<AmbassadorLoginHandler>(AmbassadorLoginHandler);
        jest.clearAllMocks();

        // recordFailedAttempt reads the counter back from the write, the way
        // Prisma returns it, instead of trusting the value it read earlier.
        mockPrismaService.user.update.mockResolvedValue({ failedLoginAttempts: 1 });

        mockPrismaService.user.findFirst.mockResolvedValue({
            id: USER_ID,
            email: 'ambassador@example.com',
            brandId: BRAND_ID,
            isActive: true,
            isOnboardingCompleted: true,
            failedLoginAttempts: 0,
            lockedUntil: null,
        });
    });

    it('excludes soft-deleted ambassadors from the login lookup', async () => {
        mockPrismaService.ambassador.findFirst.mockResolvedValue({ id: 'amb-1' });

        await handler.execute(command);

        expect(mockPrismaService.ambassador.findFirst).toHaveBeenCalledWith({
            where: {
                userId: USER_ID,
                referralCode: 'URO19948',
                isActive: true,
                deletedAt: null,
            },
        });
    });

    it('rejects login when no matching active ambassador exists', async () => {
        mockPrismaService.ambassador.findFirst.mockResolvedValue(null);

        await expect(handler.execute(command)).rejects.toThrow(UnauthorizedException);
        expect(mockAuthLoggingService.logFailedLogin).toHaveBeenCalledWith(
            'ambassador@example.com',
            '127.0.0.1',
            'node',
            'Invalid ambassador referral code',
        );
    });

    it('normalizes a lowercase referral code before lookup', async () => {
        mockPrismaService.ambassador.findFirst.mockResolvedValue({ id: 'amb-1' });

        await handler.execute(
            new AmbassadorLoginCommand('ambassador@example.com', '  uro19948 ', '127.0.0.1', 'node', BRAND_ID),
        );

        expect(mockPrismaService.ambassador.findFirst).toHaveBeenCalledWith(
            expect.objectContaining({
                where: expect.objectContaining({ referralCode: 'URO19948' }),
            }),
        );
    });

    it('rejects login for an inactive user without reaching the ambassador lookup', async () => {
        mockPrismaService.user.findFirst.mockResolvedValue({
            id: USER_ID,
            email: 'ambassador@example.com',
            brandId: BRAND_ID,
            isActive: false,
        });

        await expect(handler.execute(command)).rejects.toThrow(UnauthorizedException);
        expect(mockPrismaService.ambassador.findFirst).not.toHaveBeenCalled();
    });
    // The referral code is the ONLY credential this route takes — no password —
    // and the handler hands back full access and refresh tokens. Until these
    // landed, a wrong code cost the guesser nothing at all.
    describe('account lockout', () => {
        it('counts a wrong referral code as a failed attempt', async () => {
            mockPrismaService.ambassador.findFirst.mockResolvedValue(null);
            mockPrismaService.user.update.mockResolvedValue({ failedLoginAttempts: 1 });

            await expect(handler.execute(command)).rejects.toThrow(UnauthorizedException);

            // The DATABASE increments. Reading the counter into JS and writing
            // back n+1 let N concurrent guesses all write the same value.
            expect(mockPrismaService.user.update).toHaveBeenCalledWith({
                where: { id: USER_ID },
                data: { failedLoginAttempts: { increment: 1 }, lastFailedLogin: expect.any(Date) },
                select: { failedLoginAttempts: true },
            });
            // Below the threshold nothing else is written — notably no
            // `lockedUntil: null`, which is how a stale request un-locks an
            // account another request just locked.
            expect(mockPrismaService.user.update).toHaveBeenCalledTimes(1);
        });

        it('locks the account once failed attempts reach the threshold', async () => {
            mockPrismaService.ambassador.findFirst.mockResolvedValue(null);
            mockPrismaService.user.findFirst.mockResolvedValue({
                id: USER_ID,
                email: 'ambassador@example.com',
                brandId: BRAND_ID,
                isActive: true,
                failedLoginAttempts: 4,
                lockedUntil: null,
            });
            // The threshold is decided by what the increment RETURNED, not by
            // what this stale read said.
            mockPrismaService.user.update.mockResolvedValue({ failedLoginAttempts: 5 });

            await expect(handler.execute(command)).rejects.toThrow(UnauthorizedException);

            expect(mockPrismaService.user.update).toHaveBeenLastCalledWith({
                where: { id: USER_ID },
                data: { lockedUntil: expect.any(Date) },
            });
        });

        it('rejects a locked account without ever comparing the code', async () => {
            mockPrismaService.user.findFirst.mockResolvedValue({
                id: USER_ID,
                email: 'ambassador@example.com',
                brandId: BRAND_ID,
                isActive: true,
                failedLoginAttempts: 5,
                lockedUntil: new Date(Date.now() + 60_000),
            });

            await expect(handler.execute(command)).rejects.toThrow(
                'Too many failed attempts. Try again later.',
            );
            // No lookup means no oracle: a locked account cannot be used to test
            // whether a guessed code is right.
            expect(mockPrismaService.ambassador.findFirst).not.toHaveBeenCalled();
        });

        it('lets the account back in once the lockout has expired', async () => {
            mockPrismaService.ambassador.findFirst.mockResolvedValue({ id: 'amb-1' });
            mockPrismaService.user.findFirst.mockResolvedValue({
                id: USER_ID,
                email: 'ambassador@example.com',
                brandId: BRAND_ID,
                isActive: true,
                failedLoginAttempts: 5,
                lockedUntil: new Date(Date.now() - 60_000),
            });

            await expect(handler.execute(command)).resolves.toBeDefined();
        });

        it('clears the counter AND the lock on success', async () => {
            mockPrismaService.ambassador.findFirst.mockResolvedValue({ id: 'amb-1' });

            await handler.execute(command);

            expect(mockPrismaService.user.update).toHaveBeenCalledWith({
                where: { id: USER_ID },
                data: expect.objectContaining({ failedLoginAttempts: 0, lockedUntil: null }),
            });
        });
    });
});
