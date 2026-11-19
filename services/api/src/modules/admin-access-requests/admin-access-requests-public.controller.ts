// services/api/src/modules/admin-access-requests/admin-access-requests-public.controller.ts
import { Body, Controller, Get, HttpCode, HttpStatus, Post, Req, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Request } from 'express';
import { Public } from '@shared/decorators/public.decorator';
import { ClientIp } from '@shared/decorators/client-ip.decorator';
import { clientIpTracker } from '@shared/infrastructure/throttler/user-aware-throttler.guard';
import { TurnstileGuard } from '../auth/infrastructure/guards/turnstile.guard';
import { AdminAccessRequestsService } from './admin-access-requests.service';
import { CreateAccessRequestDto } from './dto/create-access-request.dto';

const ONE_HOUR = 3600000;
// Sized for the team submitting from one office NAT right after the announcement.
const SUBMITS_PER_HOUR = 20;

@ApiTags('admin-access-requests')
@Controller('admin-access-requests')
export class AdminAccessRequestsPublicController {
  constructor(private readonly service: AdminAccessRequestsService) {}

  @Public()
  @Get('options')
  @ApiOperation({ summary: 'Divisions and active programs for the request-access form' })
  getOptions() {
    return this.service.getOptions();
  }

  @Public()
  @Post()
  @HttpCode(HttpStatus.ACCEPTED)
  @UseGuards(TurnstileGuard)
  // Per client IP, named explicitly: the default tracker is user-aware and this route is anonymous.
  @Throttle({ default: { limit: SUBMITS_PER_HOUR, ttl: ONE_HOUR, getTracker: clientIpTracker } })
  @ApiOperation({ summary: 'Request admin dashboard access (always 202: no account enumeration)' })
  @ApiResponse({ status: 202, description: '{ submitted: true }' })
  async submit(@Body() dto: CreateAccessRequestDto, @ClientIp() ip: string, @Req() req: Request) {
    await this.service.submit(dto, ip || '0.0.0.0', req.headers['user-agent'] || 'unknown');
    return { submitted: true };
  }
}
