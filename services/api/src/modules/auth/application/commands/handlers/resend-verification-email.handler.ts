import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../../../../shared/infrastructure/prisma/prisma.service';
import { ResendVerificationEmailCommand } from '../resend-verification-email.command';
import * as crypto from 'crypto';
import { RabbitMQProducerService } from '@shared/infrastructure/rabbitmq/rabbitmq-producer.service';
import { AuthLoggingService } from '../../services/auth-logging.service';
import { hashToken } from '@shared/utils/hash-token.util';

// Audit M125: returned for a non-existent email, an already-verified email,
// and a genuine send — a single constant response so the endpoint can't be
// used to enumerate which addresses have accounts or their verification
// state. Mirrors forgot-password.handler.ts's FORGOT_PASSWORD_RESPONSE
// pattern. NOTE this is a deliberate UX regression versus the old three-way
// response: the participant frontend (ybb-program-next
// lib/auth/resendVerification.ts) used to tell an already-verified user
// "you're verified, just sign in" instead of leaving them to wait on an email
// that will never arrive. That distinction is gone until the frontend is
// updated to stop relying on it — see the audit report for the tradeoff.
const RESEND_VERIFICATION_RESPONSE = 'If an account exists for this email and needs verification, a verification email has been sent.';

@Injectable()
export class ResendVerificationEmailHandler {
  constructor(
    private readonly prisma: PrismaService,
    private readonly rabbitmqProducer: RabbitMQProducerService,
    private readonly authLoggingService: AuthLoggingService,
  ) {}

  private async resolveBrandId(brandId?: string, domain?: string): Promise<string> {
    if (brandId) {
      return brandId;
    }

    if (!domain) {
      // Fallback to default
      const defaultCategory = await this.prisma.brand.findFirst({
        where: { isActive: true },
        orderBy: { createdAt: 'asc' },
        select: { id: true }
      });
      if (!defaultCategory) throw new BadRequestException('Program Category could not be determined');
      return defaultCategory.id;
    }

    // Try finding by domain
    let category = await this.prisma.brand.findFirst({
      where: { websiteUrl: domain, isActive: true },
      select: { id: true }
    });

    if (!category) {
      category = await this.prisma.brand.findFirst({
        where: { websiteUrl: { contains: domain, mode: 'insensitive' }, isActive: true },
        select: { id: true }
      });
    }

    if (!category) throw new BadRequestException(`No program category found for domain: ${domain}`);
    return category.id;
  }

  async execute(command: ResendVerificationEmailCommand, domain?: string): Promise<{ success: boolean; message: string }> {
    const brandId = await this.resolveBrandId(command.brandId, domain);

    const user = await this.prisma.user.findFirst({
      where: {
        email: { equals: command.email, mode: 'insensitive' },
        brandId: brandId,
        deletedAt: null,
      },
      orderBy: { createdAt: 'asc' },
    });

    if (!user) {
      await this.authLoggingService.logResendVerificationRequest(
        command.email,
        'not-found',
        command.ipAddress || '0.0.0.0',
        command.userAgent || 'unknown',
      );
      return { success: true, message: RESEND_VERIFICATION_RESPONSE };
    }

    if (user.emailVerified) {
      await this.authLoggingService.logResendVerificationRequest(
        command.email,
        'already-verified',
        command.ipAddress || '0.0.0.0',
        command.userAgent || 'unknown',
      );
      return { success: true, message: RESEND_VERIFICATION_RESPONSE };
    }

    // Generate new token
    const emailVerificationToken = crypto.randomBytes(32).toString('hex');
    const emailVerificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    // Audit M144: only the hash is persisted; the raw emailVerificationToken
    // below still goes out in the email. Same hashToken() helper and pattern
    // as forgot-password.handler.ts / register.handler.ts.
    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        emailVerificationToken: hashToken(emailVerificationToken),
        emailVerificationExpires,
      },
    });

    // Get Program Category details for email template
    const brand = await this.prisma.brand.findUnique({
      where: { id: brandId },
      include: {
        settings: true
      }
    });

    // Send notification
    await this.rabbitmqProducer.emit('user.verify-email', {
      email: user.email,
      name: user.email.split('@')[0],
      token: emailVerificationToken,
      brand: brand
    });
await this.authLoggingService.logResendVerification(
        user.id,
        command.ipAddress || '0.0.0.0',
        command.userAgent || 'unknown',
    );
    await this.authLoggingService.logResendVerificationRequest(
        command.email,
        'sent',
        command.ipAddress || '0.0.0.0',
        command.userAgent || 'unknown',
    );

    return { success: true, message: RESEND_VERIFICATION_RESPONSE };
  }
}
