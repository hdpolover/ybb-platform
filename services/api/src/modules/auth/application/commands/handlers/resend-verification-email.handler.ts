import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../../../shared/infrastructure/prisma/prisma.service';
import { ResendVerificationEmailCommand } from '../resend-verification-email.command';
import * as crypto from 'crypto';
import { RabbitMQProducerService } from '@shared/infrastructure/rabbitmq/rabbitmq-producer.service';
import { AuthLoggingService } from '../../services/auth-logging.service';

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
      },
      orderBy: { createdAt: 'asc' },
    });

    if (!user) {
      // User explicitly asked to check first - so we fail if not found
      throw new NotFoundException(`User with email ${command.email} not found.`);
    }

    if (user.emailVerified) {
      throw new BadRequestException('Email is already verified.');
    }

    // Generate new token
    const emailVerificationToken = crypto.randomBytes(32).toString('hex');
    const emailVerificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        emailVerificationToken,
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

    
    return { success: true, message: 'Verification email sent successfully.' };
  }
}
