import { Injectable } from '@nestjs/common';
import { LogoutCommand } from '../logout.command';
import { TokenBlacklistService } from '../../../infrastructure/services/token-blacklist.service';
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service';

@Injectable()
export class LogoutHandler {
    constructor(
        private readonly tokenBlacklistService: TokenBlacklistService,
        private readonly prisma: PrismaService,
    ) { }

    async execute(command: LogoutCommand): Promise<{ success: boolean; message: string }> {
        // Calculate remaining time until token expires (in milliseconds)
        const now = Math.floor(Date.now() / 1000);
        const remainingTimeMs = Math.max((command.tokenExpiresAt - now) * 1000, 0);

        // Only blacklist if token hasn't already expired
        if (remainingTimeMs > 0) {
            await this.tokenBlacklistService.blacklistToken(command.jti, remainingTimeMs);
        }

        await this.prisma.userSession.updateMany({
            where: {
                userId: command.userId,
                sessionToken: command.sessionId,
                revokedAt: null,
            },
            data: {
                isActive: false,
                revokedAt: new Date(),
            },
        });

        return {
            success: true,
            message: 'Successfully logged out',
        };
    }
}
