// services/api/src/modules/auth/presentation/admin-password.controller.ts
import { Body, Controller, HttpCode, HttpStatus, Post, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Request } from 'express';
import { Public } from '@shared/decorators/public.decorator';
import { ClientIp } from '@shared/decorators/client-ip.decorator';
import { CurrentUser, CurrentUserData } from '@shared/decorators/current-user.decorator';
import { clientIpTracker, emailTracker } from '@shared/infrastructure/throttler/user-aware-throttler.guard';
import { JwtAuthGuard } from '../infrastructure/guards/jwt-auth.guard';
import { TurnstileEnforced, TurnstileGuard } from '../infrastructure/guards/turnstile.guard';
import { AdminPasswordService } from '../application/services/admin-password.service';
import { AdminChangePasswordDto } from './dto/admin-change-password.dto';
import { AdminForgotPasswordDto } from './dto/admin-forgot-password.dto';

const ONE_HOUR = 3600000;

/**
 * Per mailbox (the inbox is the resource) plus a per-IP ceiling on the `long` tier, which a
 * route-level @Throttle would otherwise displace with the global 300/min. Keyed on the
 * caller-written body, so a 429 reveals nothing about whether the address is an admin.
 */
const FORGOT_THROTTLE = {
  default: { limit: 5, ttl: ONE_HOUR, getTracker: emailTracker },
  long: { limit: 30, ttl: ONE_HOUR, getTracker: clientIpTracker },
};

@ApiTags('auth')
@Controller('auth/admin')
export class AdminPasswordController {
  constructor(private readonly passwords: AdminPasswordService) {}

  @Post('change-password')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  // Per authenticated user (the throttler verifies the bearer itself). A wrong current password
  // also counts toward account lockout, so this only has to stop a flood.
  @Throttle({ default: { limit: 10, ttl: ONE_HOUR } })
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Change the signed-in admin\'s own password; other sessions are signed out' })
  @ApiResponse({ status: 200, description: '{ ok: true }' })
  changePassword(
    @CurrentUser() user: CurrentUserData,
    @Body() dto: AdminChangePasswordDto,
    @ClientIp() ip: string,
    @Req() req: Request,
  ) {
    return this.passwords.changeOwnPassword(
      user,
      dto.currentPassword,
      dto.newPassword,
      ip || '0.0.0.0',
      req.headers['user-agent'] || 'unknown',
    );
  }

  @Public()
  @Post('forgot-password')
  @HttpCode(HttpStatus.ACCEPTED)
  @UseGuards(TurnstileGuard)
  @TurnstileEnforced()
  @Throttle(FORGOT_THROTTLE)
  @ApiOperation({ summary: 'Email an admin a 1h set-password link (always 202: no account enumeration)' })
  @ApiResponse({ status: 202, description: '{ submitted: true }' })
  async forgotPassword(@Body() dto: AdminForgotPasswordDto) {
    await this.passwords.requestReset(dto.email);
    return { submitted: true };
  }
}
