import { Injectable, Logger, BadRequestException, NotFoundException } from '@nestjs/common';
import { ForgotPasswordCommand } from '../forgot-password.command';
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service';
import { randomBytes } from 'crypto';
import { RabbitMQProducerService } from '@shared/infrastructure/rabbitmq/rabbitmq-producer.service';
import { AuthLoggingService } from '../../services/auth-logging.service';

@Injectable()
export class ForgotPasswordHandler {
    private readonly logger = new Logger(ForgotPasswordHandler.name);

    constructor(
        private readonly prisma: PrismaService,
        private readonly rabbitmqProducer: RabbitMQProducerService,
        private readonly authLoggingService: AuthLoggingService,
    ) { }

    /**
     * Resolve domain to brandId
     * Similar logic to login/register handlers
     */
    private async resolveBrandId(brandId?: string, domain?: string): Promise<string> {
        // If brandId is explicitly provided, use it
        if (brandId) {
            return brandId;
        }

        // If no brandId and no domain, try to get default category
        if (!domain) {
            const defaultCategory = await this.prisma.brand.findFirst({
                where: { isActive: true },
                orderBy: { createdAt: 'asc' },
                select: { id: true }
            });

            if (!defaultCategory) {
                throw new BadRequestException('No active program category found. Please provide brandId or use a valid domain.');
            }

            return defaultCategory.id;
        }

        // Try to find category by domain
        // First try exact match
        let category = await this.prisma.brand.findFirst({
            where: { 
                websiteUrl: domain,
                isActive: true 
            },
            select: { id: true }
        });

        // If not found, try contains match (handles subdomains and protocols)
        if (!category) {
            category = await this.prisma.brand.findFirst({
                where: {
                    websiteUrl: { contains: domain, mode: 'insensitive' },
                    isActive: true
                },
                select: { id: true }
            });
        }

        if (!category) {
            throw new BadRequestException(`No program category found for domain: ${domain}. Please provide brandId.`);
        }

        return category.id;
    }

    async execute(command: ForgotPasswordCommand, domain?: string): Promise<{ message: string }> {
        // Resolve brandId from command or domain
        const brandId = await this.resolveBrandId(command.brandId, domain);

        const user = await this.prisma.user.findUnique({
            where: {
                email_brandId: {
                    email: command.email,
                    brandId: brandId,
                },
            },
        });

        if (!user) {
            this.logger.warn('Forgot password requested for non-existent account');
            throw new NotFoundException(`User not found.`);
        }

        // Generate a fake reset token for simulation
        const token = randomBytes(32).toString('hex');
        const expires = new Date();
        expires.setHours(expires.getHours() + 1); // Token valid for 1 hour

        // Save token to database
        await this.prisma.user.update({
            where: { id: user.id },
            data: {
                passwordResetToken: token,
                passwordResetExpires: expires,
            },
        });

        // Fetch full brand details for email customization
        const brand = await this.prisma.brand.findUnique({
            where: { id: brandId },
            include: {
                settings: true
            }
        });

        const programCategory = brand ? {
            name: brand.name,
            primaryColor: brand.primaryColor,
            logoUrl: brand.logoUrl,
            websiteUrl: brand.websiteUrl,
            contactEmail: brand.contactEmail,
            contactAddress: brand.contactAddress, // Send address
            socialMediaLinks: brand.socialMediaLinks,
            website: brand.websiteUrl, // for legacy templates using .website
            settings: brand.settings ? {
                footerNavigation: brand.settings.footerNavigation,
                supportEmail: brand.settings.supportEmail
            } : null
        } : null;

        this.logger.log('Emitting user.forgot-password event');
        await this.rabbitmqProducer.emit('user.forgot-password', {
            email: user.email,
            name: user.email.split('@')[0], // Fallback name
            token,
            brandId, 
            brand: programCategory // Pass full brand object
        });

        await this.authLoggingService.logForgotPasswordRequest(
            command.email,
            command.ipAddress || '0.0.0.0',
            command.userAgent || 'unknown',
        );

        return {
            message: 'A password reset link has been sent to your email.',
        };
    }
}
