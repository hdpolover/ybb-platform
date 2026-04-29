import { Controller, Get, Put, Param, Body, Query, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { Request as ExpressRequest } from 'express';
import { JwtAuthGuard } from '@modules/auth/infrastructure/guards/jwt-auth.guard';
import { AuditTrail } from '@shared/decorators/audit-trail.decorator';
import { CacheInvalidate } from '@shared/decorators/cache-invalidate.decorator';
import { PROGRAM_CONTENT_PATTERNS } from '@shared/constants/cache-patterns';
import { ChangeType } from '@prisma/client';
import { UpdateExchangeRateHandler } from '../application/commands/handlers/update-exchange-rate.handler';
import {
    UpdateExchangeRateDto,
    ExchangeRateResponseDto,
    ExchangeRateHistoryResponseDto,
} from './dto/exchange-rate.dto';
import { Public } from '@shared/decorators/public.decorator';

interface AuthenticatedRequest extends ExpressRequest {
    user: { id: string; userId: string; email: string; brandId: string };
}

@ApiTags('Program Exchange Rate')
@Controller('programs/:programId/exchange-rate')
export class ProgramExchangeRateController {
    constructor(
        private readonly exchangeRateHandler: UpdateExchangeRateHandler,
    ) {}

    @Get()
    @Public()
    @ApiOperation({ summary: 'Get current exchange rate for a program (with brand fallback)' })
    @ApiResponse({ status: 200, type: ExchangeRateResponseDto })
    async getExchangeRate(
        @Param('programId') programId: string,
    ): Promise<ExchangeRateResponseDto> {
        return this.exchangeRateHandler.getExchangeRate(programId);
    }

    @Put()
    @UseGuards(JwtAuthGuard)
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Update exchange rate for a program (Admin only)' })
    @ApiResponse({ status: 200, type: ExchangeRateResponseDto })
    @AuditTrail({ entityType: 'Program', action: ChangeType.update })
    @CacheInvalidate(PROGRAM_CONTENT_PATTERNS)
    async updateExchangeRate(
        @Param('programId') programId: string,
        @Body() dto: UpdateExchangeRateDto,
        @Request() req: AuthenticatedRequest,
    ): Promise<ExchangeRateResponseDto> {
        return this.exchangeRateHandler.updateExchangeRate(
            programId,
            dto.usdInIdr,
            req.user.id,
            dto.reason,
        );
    }

    @Get('history')
    @UseGuards(JwtAuthGuard)
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Get exchange rate change history for a program' })
    @ApiResponse({ status: 200, type: ExchangeRateHistoryResponseDto })
    @ApiQuery({ name: 'page', required: false, type: Number })
    @ApiQuery({ name: 'limit', required: false, type: Number })
    async getExchangeRateHistory(
        @Param('programId') programId: string,
        @Query('page') page?: number,
        @Query('limit') limit?: number,
    ): Promise<ExchangeRateHistoryResponseDto> {
        return this.exchangeRateHandler.getExchangeRateHistory(
            programId,
            page ? Number(page) : 1,
            limit ? Number(limit) : 20,
        );
    }
}
