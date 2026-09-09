// src/modules/auth/application/commands/handlers/resend-verification-email.handler.spec.ts

import { Test, TestingModule } from '@nestjs/testing';
import { ResendVerificationEmailHandler } from './resend-verification-email.handler';
import { ResendVerificationEmailCommand } from '../resend-verification-email.command';
import { PrismaService } from '../../../../../shared/infrastructure/prisma/prisma.service';
import { RabbitMQProducerService } from '../../../../../shared/infrastructure/rabbitmq/rabbitmq-producer.service';
import { AuthLoggingService } from '../../services/auth-logging.service';

describe('ResendVerificationEmailHandler - account enumeration hardening (M125)', () => {
  let handler: ResendVerificationEmailHandler;

  const mockPrismaService = {
    brand: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
    },
    user: {
      findFirst: jest.fn(),
      update: jest.fn(),
    },
  };

  const mockRabbitmqProducer = {
    emit: jest.fn(),
  };

  const mockAuthLoggingService = {
    logResendVerification: jest.fn(),
    logResendVerificationRequest: jest.fn(),
  };

  const activeBrand = { id: 'brand-id-123', isActive: true };

  const unverifiedUser = {
    id: 'user-id-123',
    email: 'unverified@example.com',
    brandId: 'brand-id-123',
    emailVerified: false,
  };

  const verifiedUser = { ...unverifiedUser, id: 'user-id-456', email: 'verified@example.com', emailVerified: true };

  const fullBrand = { id: 'brand-id-123', name: 'Test Brand', settings: null };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ResendVerificationEmailHandler,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: RabbitMQProducerService, useValue: mockRabbitmqProducer },
        { provide: AuthLoggingService, useValue: mockAuthLoggingService },
      ],
    }).compile();

    handler = module.get<ResendVerificationEmailHandler>(ResendVerificationEmailHandler);

    jest.clearAllMocks();

    mockPrismaService.brand.findFirst.mockResolvedValue(activeBrand);
    mockPrismaService.brand.findUnique.mockResolvedValue(fullBrand);
    mockPrismaService.user.update.mockResolvedValue(unverifiedUser);
    mockRabbitmqProducer.emit.mockResolvedValue(undefined);
    mockAuthLoggingService.logResendVerification.mockResolvedValue(undefined);
    mockAuthLoggingService.logResendVerificationRequest.mockResolvedValue(undefined);
  });

  it('should be defined', () => {
    expect(handler).toBeDefined();
  });

  // Regression guard for the enumeration oracle itself. On the pre-fix code,
  // the non-existent-account path threw NotFoundException (a distinct 404
  // with a distinguishing message) instead of resolving with a message, so
  // this assertion would have failed on old code: `execute()` would have
  // rejected rather than resolved, and the resolved value would never have
  // matched the hit-path message.
  it('resolves with a response byte-identical across non-existent, already-verified and unverified accounts', async () => {
    const brandId = 'brand-id-123';

    mockPrismaService.user.findFirst.mockResolvedValueOnce(null);
    const missResult = await handler.execute(
      new ResendVerificationEmailCommand('nobody@example.com', brandId),
    );

    mockPrismaService.user.findFirst.mockResolvedValueOnce(verifiedUser);
    const verifiedResult = await handler.execute(
      new ResendVerificationEmailCommand('verified@example.com', brandId),
    );

    mockPrismaService.user.findFirst.mockResolvedValueOnce(unverifiedUser);
    const sentResult = await handler.execute(
      new ResendVerificationEmailCommand('unverified@example.com', brandId),
    );

    // This is the load-bearing assertion: on the pre-fix handler, missResult
    // would never exist (it throws), verifiedResult.message would be
    // undefined (BadRequestException carries no `message` on a resolved
    // value either), and sentResult.message was the literal string
    // 'Verification email sent successfully.' — three distinguishable
    // outcomes. Post-fix, all three must be the identical object shape.
    expect(missResult).toEqual(verifiedResult);
    expect(verifiedResult).toEqual(sentResult);
  });

  it('does not throw for a non-existent account (old code threw NotFoundException here)', async () => {
    mockPrismaService.user.findFirst.mockResolvedValue(null);

    await expect(
      handler.execute(new ResendVerificationEmailCommand('nobody@example.com', 'brand-id-123')),
    ).resolves.toEqual({
      success: true,
      message: expect.any(String),
    });
  });

  it('does not throw for an already-verified account (old code threw BadRequestException here)', async () => {
    mockPrismaService.user.findFirst.mockResolvedValue(verifiedUser);

    await expect(
      handler.execute(new ResendVerificationEmailCommand('verified@example.com', 'brand-id-123')),
    ).resolves.toEqual({
      success: true,
      message: expect.any(String),
    });
  });

  it('sends no verification email and writes no token for a non-existent account', async () => {
    mockPrismaService.user.findFirst.mockResolvedValue(null);

    await handler.execute(new ResendVerificationEmailCommand('nobody@example.com', 'brand-id-123'));

    expect(mockPrismaService.user.update).not.toHaveBeenCalled();
    expect(mockRabbitmqProducer.emit).not.toHaveBeenCalled();
  });

  it('sends no verification email and writes no token for an already-verified account', async () => {
    mockPrismaService.user.findFirst.mockResolvedValue(verifiedUser);

    await handler.execute(new ResendVerificationEmailCommand('verified@example.com', 'brand-id-123'));

    expect(mockPrismaService.user.update).not.toHaveBeenCalled();
    expect(mockRabbitmqProducer.emit).not.toHaveBeenCalled();
  });

  it('does send a verification email for a genuine unverified account', async () => {
    mockPrismaService.user.findFirst.mockResolvedValue(unverifiedUser);

    await handler.execute(new ResendVerificationEmailCommand('unverified@example.com', 'brand-id-123'));

    expect(mockPrismaService.user.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: unverifiedUser.id } }),
    );
    expect(mockRabbitmqProducer.emit).toHaveBeenCalledWith(
      'user.verify-email',
      expect.objectContaining({ email: unverifiedUser.email }),
    );
  });

  it('logs the security event on the non-existent-account path too, so an enumeration sweep is still visible server-side', async () => {
    mockPrismaService.user.findFirst.mockResolvedValue(null);

    await handler.execute(new ResendVerificationEmailCommand('nobody@example.com', 'brand-id-123'));

    expect(mockAuthLoggingService.logResendVerificationRequest).toHaveBeenCalledWith(
      'nobody@example.com',
      'not-found',
      '0.0.0.0',
      'unknown',
    );
  });

  it('logs the security event with the already-verified outcome, distinct from not-found, for the internal audit trail', async () => {
    mockPrismaService.user.findFirst.mockResolvedValue(verifiedUser);

    await handler.execute(new ResendVerificationEmailCommand('verified@example.com', 'brand-id-123'));

    expect(mockAuthLoggingService.logResendVerificationRequest).toHaveBeenCalledWith(
      'verified@example.com',
      'already-verified',
      '0.0.0.0',
      'unknown',
    );
  });
});
