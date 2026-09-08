import {
  Body,
  Controller,
  Headers,
  Param,
  Post,
  Req,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { Public } from '@shared/decorators/public.decorator';
import { CurrentUser, CurrentUserData } from '@shared/decorators/current-user.decorator';
import { JwtAuthGuard } from '@modules/auth/infrastructure/guards/jwt-auth.guard';
import { RolesGuard } from '@modules/auth/infrastructure/guards/roles.guard';
import { Roles } from '@modules/auth/application/decorators/roles.decorator';
import { UserRole } from '../../../core/entities/user.entity';
import {
  ExchangeSupportImpersonationDto,
} from './dto/support-access.dto';
import { SupportAccessService } from '../application/services/support-access.service';
import { ClientIp } from '@shared/decorators/client-ip.decorator';

@ApiTags('admin-support-access')
@Controller('admins/support-access')
export class SupportAccessController {
  constructor(private readonly supportAccessService: SupportAccessService) {}

  @Public()
  @Post('impersonations/exchange')
  @ApiOperation({ summary: 'Exchange one-time impersonation token for participant auth tokens' })
  @ApiResponse({ status: 201, description: 'Token exchanged' })
  async exchangeImpersonationToken(
    @Body() dto: ExchangeSupportImpersonationDto,
    // @ClientIp() resolves the real caller through Cloudflare + Traefik and validates the result; @Ip() is the socket peer, i.e. Traefik's container address for every request (audit M88/M165).
        @ClientIp() ipAddress: string,
    @Req() req: Request,
    @Headers('x-brand-domain') _brandDomain?: string,
  ) {
    return this.supportAccessService.exchangeImpersonationToken(
      dto.token,
      ipAddress || '0.0.0.0',
      req.headers['user-agent'] || 'unknown',
    );
  }

  // Guarded the same way as the sibling support-access endpoints
  // (AdminsController's config/impersonations routes): JwtAuthGuard +
  // RolesGuard admit ADMIN/SUPER_ADMIN, and the actual Super-Admin-only gate
  // lives in the service (assertSuperAdmin), not here.
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @ApiBearerAuth()
  @Post('impersonations/:id/end')
  @ApiOperation({ summary: 'End an impersonation session, revoking its ticket and UserSession (Super Admin only)' })
  @ApiResponse({ status: 201, description: 'Impersonation ended' })
  async endImpersonation(
    @Param('id') id: string,
    @CurrentUser() currentUser: CurrentUserData,
  ) {
    if (!currentUser.adminId) throw new UnauthorizedException('Admin access required');
    return this.supportAccessService.endImpersonation(currentUser, id);
  }
}
