import { Injectable } from '@nestjs/common';
import { LogoutCommand } from '../logout.command';
import { TokenBlacklistService } from '../../../infrastructure/services/token-blacklist.service';

@Injectable()
export class LogoutHandler {
    constructor(
        private readonly tokenBlacklistService: TokenBlacklistService,
    ) { }

    async execute(command: LogoutCommand): Promise<{ success: boolean; message: string }> {
        // Calculate remaining time until token expires (in milliseconds)
        const now = Math.floor(Date.now() / 1000);
        const remainingTimeMs = Math.max((command.tokenExpiresAt - now) * 1000, 0);

        // Only blacklist if token hasn't already expired
        if (remainingTimeMs > 0) {
            await this.tokenBlacklistService.blacklistToken(command.jti, remainingTimeMs);
        }

        return {
            success: true,
            message: 'Successfully logged out',
        };
    }
}
