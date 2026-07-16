import {
  Body,
  Controller,
  Headers,
  Ip,
  Post,
  Req,
} from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { Public } from '@shared/decorators/public.decorator';
import {
  ExchangeSupportImpersonationDto,
} from './dto/support-access.dto';
import { SupportAccessService } from '../application/services/support-access.service';

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
    @Ip() ipAddress: string,
    @Req() req: Request,
    @Headers('x-brand-domain') _brandDomain?: string,
  ) {
    return this.supportAccessService.exchangeImpersonationToken(
      dto.token,
      ipAddress || '0.0.0.0',
      req.headers['user-agent'] || 'unknown',
    );
  }
}
