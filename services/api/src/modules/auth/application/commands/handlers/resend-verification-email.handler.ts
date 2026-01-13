import { Injectable, BadRequestException, Inject, NotFoundException } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { PrismaService } from '../../../../../shared/infrastructure/prisma/prisma.service';
import { ResendVerificationEmailCommand } from '../resend-verification-email.command';
import * as crypto from 'crypto';

@Injectable()
export class ResendVerificationEmailHandler {
  constructor(
    private readonly prisma: PrismaService,
    @Inject('NOTIFICATION_SERVICE') private readonly notificationClient: ClientProxy,
  ) {}

  private async resolveProgramCategoryId(programCategoryId?: string, domain?: string): Promise<string> {
    if (programCategoryId) {
      return programCategoryId;
    }

    if (!domain) {
      // Fallback to default
      const defaultCategory = await this.prisma.programCategory.findFirst({
        where: { isActive: true },
        orderBy: { createdAt: 'asc' },
        select: { id: true }
      });
      if (!defaultCategory) throw new BadRequestException('Program Category could not be determined');
      return defaultCategory.id;
    }

    // Try finding by domain
    let category = await this.prisma.programCategory.findFirst({
      where: { websiteUrl: domain, isActive: true },
      select: { id: true }
    });

    if (!category) {
      category = await this.prisma.programCategory.findFirst({
        where: { websiteUrl: { contains: domain, mode: 'insensitive' }, isActive: true },
        select: { id: true }
      });
    }

    if (!category) throw new BadRequestException(`No program category found for domain: ${domain}`);
    return category.id;
  }

  async execute(command: ResendVerificationEmailCommand, domain?: string): Promise<{ success: boolean; message: string }> {
    const programCategoryId = await this.resolveProgramCategoryId(command.programCategoryId, domain);

    const user = await this.prisma.user.findUnique({
      where: {
        email_programCategoryId: {
          email: command.email,
          programCategoryId: programCategoryId,
        },
      },
    });

    if (!user) {
      // For security reasons, don't reveal if user exists or not, but in this specific flow 
      // where user is asking for their verification email, it might be confusing. 
      // Standard practice: return success even if user not found, OR give generic error.
      // However, to debug this implementation:
      throw new NotFoundException('User not found in this request context.');
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
    const programCategory = await this.prisma.programCategory.findUnique({
      where: { id: programCategoryId },
    });

    // Send notification
    this.notificationClient.emit('user.verify-email', {
      email: user.email,
      name: user.email.split('@')[0],
      token: emailVerificationToken,
      programCategory: programCategory ? {
        name: programCategory.name,
        logoUrl: programCategory.logoUrl,
        primaryColor: programCategory.primaryColor,
        websiteUrl: programCategory.websiteUrl,
        socialMediaLinks: programCategory.socialMediaLinks,
        contactEmail: programCategory.contactEmail,
      } : undefined,
    });

    return { success: true, message: 'Verification email sent successfully.' };
  }
}
