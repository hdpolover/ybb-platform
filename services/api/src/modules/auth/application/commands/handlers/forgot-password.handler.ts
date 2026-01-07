import { Injectable, Inject, Logger, BadRequestException } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { ForgotPasswordCommand } from '../forgot-password.command';
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service';
import { randomBytes } from 'crypto';
import { lastValueFrom } from 'rxjs';

@Injectable()
export class ForgotPasswordHandler {
    private readonly logger = new Logger(ForgotPasswordHandler.name);

    constructor(
        private readonly prisma: PrismaService,
        @Inject('NOTIFICATION_SERVICE') private readonly notificationClient: ClientProxy,
    ) { }

    /**
     * Resolve domain to programCategoryId
     * Similar logic to login/register handlers
     */
    private async resolveProgramCategoryId(programCategoryId?: string, domain?: string): Promise<string> {
        // If programCategoryId is explicitly provided, use it
        if (programCategoryId) {
            return programCategoryId;
        }

        // If no programCategoryId and no domain, try to get default category
        if (!domain) {
            const defaultCategory = await this.prisma.programCategory.findFirst({
                where: { isActive: true },
                orderBy: { createdAt: 'asc' },
                select: { id: true }
            });

            if (!defaultCategory) {
                throw new BadRequestException('No active program category found. Please provide programCategoryId or use a valid domain.');
            }

            return defaultCategory.id;
        }

        // Try to find category by domain
        // First try exact match
        let category = await this.prisma.programCategory.findFirst({
            where: { 
                websiteUrl: domain,
                isActive: true 
            },
            select: { id: true }
        });

        // If not found, try contains match (handles subdomains and protocols)
        if (!category) {
            category = await this.prisma.programCategory.findFirst({
                where: {
                    websiteUrl: { contains: domain, mode: 'insensitive' },
                    isActive: true
                },
                select: { id: true }
            });
        }

        if (!category) {
            throw new BadRequestException(`No program category found for domain: ${domain}. Please provide programCategoryId.`);
        }

        return category.id;
    }

    async execute(command: ForgotPasswordCommand, domain?: string): Promise<{ message: string }> {
        // Resolve programCategoryId from command or domain
        const programCategoryId = await this.resolveProgramCategoryId(command.programCategoryId, domain);

        const user = await this.prisma.user.findUnique({
            where: {
                email_programCategoryId: {
                    email: command.email,
                    programCategoryId: programCategoryId,
                },
            },
        });

        if (user) {
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

            this.logger.log(`Emitting user.forgot-password for ${command.email}`);
            await lastValueFrom(
                this.notificationClient.emit('user.forgot-password', {
                    email: user.email,
                    name: user.email.split('@')[0], // Fallback name
                    token,
                    programCategoryId, // Pass category ID for email customization
                })
            );
        } else {
            this.logger.warn(`Forgot password requested for non-existent email: ${command.email}`);
        }

        // Always return success to prevent user enumeration
        return {
            message: 'If the email exists, a password reset link has been sent.',
        };
    }
}
