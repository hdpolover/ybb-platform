import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { ResetPasswordCommand } from '../reset-password.command';
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service';
import { AuthLoggingService } from '../../services/auth-logging.service';
import * as bcrypt from 'bcrypt';

@Injectable()
export class ResetPasswordHandler {
  constructor(
    private readonly prisma: PrismaService,
    private readonly authLoggingService: AuthLoggingService,
  ) {}

  async execute(command: ResetPasswordCommand): Promise<{ message: string }> {
    const { token, newPassword } = command;

    // Find user with valid token
    const user = await this.prisma.user.findFirst({
      where: {
        passwordResetToken: token,
        passwordResetExpires: {
          gt: new Date(), // Token must not be expired
        },
      },
    });

    if (!user) {
      throw new BadRequestException('Invalid or expired password reset token');
    }

    // Hash new password
    const salt = await bcrypt.genSalt();
    const passwordHash = await bcrypt.hash(newPassword, salt);

    // Update user: set new password, clear reset token/expiry
    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash,
        passwordResetToken: null,
        passwordResetExpires: null,
        lastPasswordChange: new Date(),
        // Also ensure user is active if they reset password
        isActive: true, 
      },
    });

    await this.authLoggingService.logPasswordReset(
        user.id,
        command.ipAddress || '0.0.0.0',
        command.userAgent || 'unknown',
    );

    return {
      message: 'Password has been successfully reset. You can now login with your new password.',
    };
  }
}
