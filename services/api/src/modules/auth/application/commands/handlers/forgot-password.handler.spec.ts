// src/modules/auth/application/commands/handlers/forgot-password.handler.spec.ts

import { Test, TestingModule } from '@nestjs/testing';
import { ForgotPasswordHandler } from './forgot-password.handler';
import { ForgotPasswordCommand } from '../forgot-password.command';
import { PrismaService } from '../../../../../shared/infrastructure/prisma/prisma.service';
import { RabbitMQProducerService } from '../../../../../shared/infrastructure/rabbitmq/rabbitmq-producer.service';
import { AuthLoggingService } from '../../services/auth-logging.service';

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
  };

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
