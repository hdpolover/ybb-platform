import { Injectable, BadRequestException } from '@nestjs/common';
import { VerifyEmailCommand } from '../verify-email.command';
import { PrismaService } from '../../../../../shared/infrastructure/prisma/prisma.service';
import { UnitOfWork } from '../../../../../shared/infrastructure/database/unit-of-work.service';
import { AuthLoggingService } from '../../services/auth-logging.service';
import { RabbitMQProducerService } from '../../../../../shared/infrastructure/rabbitmq/rabbitmq-producer.service';

@Injectable()
export class VerifyEmailHandler {
  constructor(
    private readonly prisma: PrismaService,
    private readonly unitOfWork: UnitOfWork,
    private readonly authLoggingService: AuthLoggingService,
    private readonly rabbitmqProducer: RabbitMQProducerService,
  ) {}

  async execute(command: VerifyEmailCommand): Promise<{ success: boolean; message: string }> {
    const user = await this.prisma.user.findFirst({
      where: {
        emailVerificationToken: command.token,
        emailVerificationExpires: {
          gt: new Date(),
        },
      },
    });

    if (!user) {
      throw new BadRequestException('Invalid or expired verification token');
    }

    // Fetch Program Category for email context
    const brand = await this.prisma.brand.findUnique({
      where: { id: user.brandId },
      include: {
        settings: true
      }
    });

    // ========================================
    // Unit of Work: User and Participant Email Verification
    // User and participant email verification must be synced atomically
    // ========================================
    await this.unitOfWork.execute(
      async (repos) => {
        await repos.tx.user.update({
          where: { id: user.id },
          data: {
            emailVerified: true,
            emailVerifiedAt: new Date(),
            emailVerificationToken: null,
            emailVerificationExpires: null,
          },
        });
        
        // Also update Participant if exists
        try {
          await repos.tx.participant.update({
            where: { userId: user.id },
            data: { emailVerifiedAt: new Date() }
          });
        } catch (e) {
          // Participant might not exist yet, ignore
        }
      },
      { name: 'verify-email-sync', timeout: 3000 }
    );

    await this.authLoggingService.logEmailVerification(
      user.id,
      command.ipAddress || '0.0.0.0',
      command.userAgent || 'unknown',
    );

    // Emit user.registered to send Welcome Email (delayed until verification)
    this.rabbitmqProducer.emit('user.registered', {
      email: user.email,
      name: user.email.split('@')[0],
      brand: brand,
    });

    // Emit user.email-verified for explicit confirmation
    this.rabbitmqProducer.emit('user.email-verified', {
        email: user.email,
        name: user.email.split('@')[0],
        brand: brand,
    });

    return { success: true, message: 'Email successfully verified' };
  }
}
