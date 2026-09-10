// src/modules/auth/application/commands/handlers/verify-email.handler.spec.ts

import { BadRequestException } from '@nestjs/common';
import { VerifyEmailHandler } from './verify-email.handler';
import { VerifyEmailCommand } from '../verify-email.command';
import { PrismaService } from '../../../../../shared/infrastructure/prisma/prisma.service';
import { UnitOfWork } from '../../../../../shared/infrastructure/database/unit-of-work.service';
import { AuthLoggingService } from '../../services/auth-logging.service';
import { RabbitMQProducerService } from '../../../../../shared/infrastructure/rabbitmq/rabbitmq-producer.service';
import { hashToken } from '@shared/utils/hash-token.util';

// Audit M144: emailVerificationToken is stored hashed (see
// register.handler.ts / resend-verification-email.handler.ts), so this
// handler must hash the incoming raw token before it can match the stored
// value. This spec is new - VerifyEmailHandler had no test coverage before
// this fix.
describe('VerifyEmailHandler - hashed token lookup (M144)', () => {
  let handler: VerifyEmailHandler;

  const prisma = {
    user: { findFirst: jest.fn() },
    brand: { findUnique: jest.fn() },
  };
  const unitOfWork = { execute: jest.fn() };
  const authLogging = { logEmailVerification: jest.fn() };
  const rabbitmqProducer = { emitSafe: jest.fn() };

  const existingUser = {
    id: 'user-1',
    email: 'user@example.com',
    brandId: 'brand-1',
  };

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.user.findFirst.mockResolvedValue(existingUser);
    prisma.brand.findUnique.mockResolvedValue(null);
    rabbitmqProducer.emitSafe.mockResolvedValue(true);
    unitOfWork.execute.mockImplementation(async (work: any) =>
      work({
        tx: {
          user: { update: jest.fn().mockResolvedValue(existingUser) },
          participant: { update: jest.fn().mockRejectedValue(new Error('no participant')) },
        },
      }),
    );
    handler = new VerifyEmailHandler(
      prisma as unknown as PrismaService,
      unitOfWork as unknown as UnitOfWork,
      authLogging as unknown as AuthLoggingService,
      rabbitmqProducer as unknown as RabbitMQProducerService,
    );
  });

  it('hashes the raw incoming token before looking the user up', async () => {
    await handler.execute(new VerifyEmailCommand('raw-verification-token'));

    expect(prisma.user.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          emailVerificationToken: hashToken('raw-verification-token'),
        }),
      }),
    );
  });

  it('never queries by the raw token value', async () => {
    await handler.execute(new VerifyEmailCommand('raw-verification-token'));

    expect(prisma.user.findFirst).not.toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ emailVerificationToken: 'raw-verification-token' }),
      }),
    );
  });

  it('rejects with a generic error when no row matches the hashed token', async () => {
    prisma.user.findFirst.mockResolvedValue(null);

    await expect(handler.execute(new VerifyEmailCommand('bad-token'))).rejects.toThrow(
      new BadRequestException('Invalid or expired verification token'),
    );
  });
});
