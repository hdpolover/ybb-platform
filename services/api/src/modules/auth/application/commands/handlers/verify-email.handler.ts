import { Injectable, BadRequestException } from '@nestjs/common';
import { VerifyEmailCommand } from '../verify-email.command';
import { PrismaService } from '../../../../../shared/infrastructure/prisma/prisma.service';
import { AuthLoggingService } from '../../services/auth-logging.service';

@Injectable()
export class VerifyEmailHandler {
  constructor(
    private readonly prisma: PrismaService,
    private readonly authLoggingService: AuthLoggingService,
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

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        emailVerified: true,
        emailVerifiedAt: new Date(),
        emailVerificationToken: null,
        emailVerificationExpires: null,
      },
    });
    
    // Also update Participant if exists
    // But we don't have direct link easily unless we query
    // Wait, we have user.id
    
    // We can try to update participant if it exists
    try {
        await this.prisma.participant.update({
            where: { userId: user.id },
            data: { emailVerifiedAt: new Date() }
        });
    } catch (e) {
        // Participant might not exist yet, ignore
    }

    await this.authLoggingService.logEmailVerification(
      user.id,
      command.ipAddress || '0.0.0.0',
      command.userAgent || 'unknown',
    );

    return { success: true, message: 'Email successfully verified' };
  }
}
