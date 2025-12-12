import { Injectable, Inject, Logger } from '@nestjs/common';
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

    async execute(command: ForgotPasswordCommand): Promise<{ message: string }> {
        const user = await this.prisma.user.findUnique({
            where: {
                email_programCategoryId: {
                    email: command.email,
                    programCategoryId: command.programCategoryId,
                },
            },
        });

        if (user) {
            // Generate a fake reset token for simulation
            const token = randomBytes(32).toString('hex');

            this.logger.log(`Emitting user.forgot-password for ${command.email}`);
            await lastValueFrom(
                this.notificationClient.emit('user.forgot-password', {
                    email: user.email,
                    name: user.email.split('@')[0], // Fallback name
                    token,
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
