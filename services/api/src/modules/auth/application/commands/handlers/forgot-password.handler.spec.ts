// src/modules/auth/application/commands/handlers/forgot-password.handler.spec.ts

import { Test, TestingModule } from '@nestjs/testing';
import { ForgotPasswordHandler } from './forgot-password.handler';
import { ForgotPasswordCommand } from '../forgot-password.command';
import { PrismaService } from '../../../../../shared/infrastructure/prisma/prisma.service';
import { RabbitMQProducerService } from '../../../../../shared/infrastructure/rabbitmq/rabbitmq-producer.service';
import { AuthLoggingService } from '../../services/auth-logging.service';
import { hashToken } from '@shared/utils/hash-token.util';

describe('ForgotPasswordHandler - account enumeration hardening', () => {
  let handler: ForgotPasswordHandler;

  const mockPrismaService = {
    brand: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
    },
    user: {
      findFirst: jest.fn(),
      update: jest.fn(),
    },
    program: {
      findFirst: jest.fn(),
    },
  };

  const mockRabbitmqProducer = {
    emit: jest.fn(),
  };

  const mockAuthLoggingService = {
    logForgotPasswordRequest: jest.fn(),
  };

  // Shared fixtures
  const activeBrand = {
    id: 'brand-id-123',
    isActive: true,
  };

  const existingUser = {
    id: 'user-id-123',
    email: 'existing@example.com',
    brandId: 'brand-id-123',
    isActive: true,
  };

  const deactivatedUser = { ...existingUser, isActive: false };

  const fullBrand = {
    id: 'brand-id-123',
    name: 'Test Brand',
    primaryColor: '#000000',
    logoUrl: null,
    websiteUrl: 'https://example.com',
    contactEmail: 'contact@example.com',
    contactAddress: null,
    socialMediaLinks: null,
    settings: null,
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ForgotPasswordHandler,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: RabbitMQProducerService, useValue: mockRabbitmqProducer },
        { provide: AuthLoggingService, useValue: mockAuthLoggingService },
      ],
    }).compile();

    handler = module.get<ForgotPasswordHandler>(ForgotPasswordHandler);

    jest.clearAllMocks();

    // Brand resolution always succeeds by default (explicit brandId provided in commands below,
    // but resolveBrandId still touches brand.findFirst only when brandId is absent).
    mockPrismaService.brand.findFirst.mockResolvedValue(activeBrand);
    mockPrismaService.brand.findUnique.mockResolvedValue(fullBrand);

    // resolveActiveProgramContact's rule-1 lookup — only exercised when a user is found.
    mockPrismaService.program.findFirst.mockResolvedValue({
      contactEmail: 'contact@example.com',
      contactPhone: null,
      contactWhatsapp: null,
      contactAddress: null,
    });

    // Happy-path downstream calls, only exercised when a user is found.
    mockPrismaService.user.update.mockResolvedValue(existingUser);
    mockRabbitmqProducer.emit.mockResolvedValue(undefined);
    mockAuthLoggingService.logForgotPasswordRequest.mockResolvedValue(undefined);
  });

  it('should be defined', () => {
    expect(handler).toBeDefined();
  });

  it('resolves with the generic success response and does not throw when the account does not exist', async () => {
    // Arrange
    mockPrismaService.user.findFirst.mockResolvedValue(null);
    const command = new ForgotPasswordCommand('nobody@example.com', 'brand-id-123');

    // Act
    const result = await handler.execute(command);

    // Assert
    expect(result).toEqual({
      message: 'A password reset link has been sent to your email.',
    });
  });

  it('returns a response byte-identical to the non-existent-account response when the account exists', async () => {
    // Arrange: non-existent account
    mockPrismaService.user.findFirst.mockResolvedValueOnce(null);
    const missCommand = new ForgotPasswordCommand('nobody@example.com', 'brand-id-123');

    // Act: miss path
    const missResult = await handler.execute(missCommand);

    // Arrange: existing account
    mockPrismaService.user.findFirst.mockResolvedValueOnce(existingUser);
    const hitCommand = new ForgotPasswordCommand('existing@example.com', 'brand-id-123');

    // Act: hit path
    const hitResult = await handler.execute(hitCommand);

    // Assert: the two responses must be indistinguishable to the caller.
    // This is the regression guard — it fails the instant the two paths diverge,
    // regardless of what either message's literal text happens to be.
    expect(hitResult).toEqual(missResult);
  });

  // Audit M138: the handler already knows which account it resolved, so it
  // hands the id to the logger instead of letting it re-derive one by email.
  it('attributes the security log to the account it already resolved', async () => {
    mockPrismaService.user.findFirst.mockResolvedValueOnce(existingUser);

    await handler.execute(new ForgotPasswordCommand('existing@example.com', 'brand-id-123'));

    expect(mockAuthLoggingService.logForgotPasswordRequest).toHaveBeenCalledWith(
      'existing@example.com',
      '0.0.0.0',
      'unknown',
      existingUser.id,
    );
  });

  it('produces no side effects when the account does not exist', async () => {
    // Arrange
    mockPrismaService.user.findFirst.mockResolvedValue(null);
    const command = new ForgotPasswordCommand('nobody@example.com', 'brand-id-123');

    // Act
    await handler.execute(command);

    // Assert: no reset token generated/persisted, no event emitted
    expect(mockPrismaService.user.update).not.toHaveBeenCalled();
    expect(mockRabbitmqProducer.emit).not.toHaveBeenCalled();
    expect(mockRabbitmqProducer.emit).not.toHaveBeenCalledWith(
      'user.forgot-password',
      expect.anything(),
    );
  });

  it('sends no reset mail to a deactivated account, and says so in the log', async () => {
    // isActive: false is only ever set deliberately — admin deactivate, admin
    // delete, or an APPROVED account-deletion request. ResetPasswordHandler
    // refuses those tokens, so mailing one would only send a dead link.
    //
    // The account still EXISTS, so the server-side log has to say that.
    // Filtering isActive into the query instead would route this down the
    // "non-existent account" branch and log the opposite of what happened.
    mockPrismaService.user.findFirst.mockResolvedValue(deactivatedUser);
    const warnSpy = jest.spyOn((handler as any).logger, 'warn');
    const command = new ForgotPasswordCommand('deactivated@example.com', 'brand-id-123');

    const result = await handler.execute(command);

    expect(mockRabbitmqProducer.emit).not.toHaveBeenCalled();
    expect(mockPrismaService.user.update).not.toHaveBeenCalled();
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('deactivated'));
    expect(result).toEqual({
      message: 'A password reset link has been sent to your email.',
    });
  });

  it('emits the security log on the miss path too, so an enumeration sweep is still visible', async () => {
    mockPrismaService.user.findFirst.mockResolvedValue(null);

    await handler.execute(new ForgotPasswordCommand('nobody@example.com', 'brand-id-123'));

    // The trailing null says "resolved to no account" so the logger skips its
    // own email lookup rather than re-deriving one (audit M138).
    expect(mockAuthLoggingService.logForgotPasswordRequest).toHaveBeenCalledWith(
      'nobody@example.com',
      '0.0.0.0',
      'unknown',
      null,
    );
  });

  // Audit M144: the DB must never hold the raw reset token, only its hash -
  // a leaked users table should not be directly usable as working reset
  // links. The email/event still needs the raw token to build the link.
  it('persists only the sha256 hash of the reset token, while the emitted event carries the matching raw token', async () => {
    mockPrismaService.user.findFirst.mockResolvedValue(existingUser);

    await handler.execute(new ForgotPasswordCommand('existing@example.com', 'brand-id-123'));

    expect(mockPrismaService.user.update).toHaveBeenCalledTimes(1);
    const updateArgs = mockPrismaService.user.update.mock.calls[0][0];
    const persistedHash: string = updateArgs.data.passwordResetToken;

    expect(mockRabbitmqProducer.emit).toHaveBeenCalledTimes(1);
    const emittedPayload = mockRabbitmqProducer.emit.mock.calls[0][1];
    const rawToken: string = emittedPayload.token;

    expect(persistedHash).toBe(hashToken(rawToken));
    expect(persistedHash).not.toBe(rawToken);
  });

  it('logs a warning server-side when the account does not exist', async () => {
    // Arrange
    mockPrismaService.user.findFirst.mockResolvedValue(null);
    const command = new ForgotPasswordCommand('nobody@example.com', 'brand-id-123');
    const warnSpy = jest.spyOn((handler as any).logger, 'warn');

    // Act
    await handler.execute(command);

    // Assert: the leak is closed to the caller but stays visible in our own logs
    expect(warnSpy).toHaveBeenCalled();
  });
});
