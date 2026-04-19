import { Controller, Get, Post, Body, Param, Query, UseGuards, UnauthorizedException } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { QueryBus } from '@nestjs/cqrs';
import { JwtAuthGuard } from '@modules/auth/infrastructure/guards/jwt-auth.guard';
import { CurrentUser, CurrentUserData } from '@shared/decorators/current-user.decorator';
import {
    GetPortalDashboardQuery,
    GetPortalSubmissionsQuery,
    GetPortalPaymentsQuery,
    GetPortalPaymentDetailQuery,
    GetPortalDocumentsQuery,
    ConfirmPortalPaymentCommand,
} from '../application/queries/portal-queries';
import { PortalDashboardResponseDto } from './dto/portal-dashboard.dto';
import { PortalSubmissionResponseDto } from './dto/portal-submission.dto';
import {
    PortalPaymentResponseDto,
    PortalPaymentDetailResponseDto,
    ConfirmPortalPaymentDto,
    ConfirmPortalPaymentResponseDto,
} from './dto/portal-payment.dto';
import { PortalDocumentResponseDto } from './dto/portal-document.dto';
import { ConfirmPortalPaymentHandler } from '../application/commands/handlers/confirm-portal-payment.handler';

@ApiTags('Portal')
@Controller('portal')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class PortalController {
    constructor(
        private readonly queryBus: QueryBus,
        private readonly confirmPortalPaymentHandler: ConfirmPortalPaymentHandler,
    ) {}

    @Get('dashboard')
    @ApiOperation({ summary: 'Get participant dashboard summary' })
    @ApiResponse({ status: 200, type: PortalDashboardResponseDto })
    async getDashboard(@CurrentUser() user: CurrentUserData): Promise<PortalDashboardResponseDto> {
        const userId = user.userId;
        if (!userId) throw new UnauthorizedException();
        return this.queryBus.execute(new GetPortalDashboardQuery(userId));
    }

    @Get('submissions')
    @ApiOperation({ summary: 'Get application submission progress' })
    @ApiResponse({ status: 200, type: PortalSubmissionResponseDto })
    async getSubmissions(
        @CurrentUser() user: CurrentUserData,
        @Query('programId') programId?: string,
    ): Promise<PortalSubmissionResponseDto> {
        const userId = user.userId;
        if (!userId) throw new UnauthorizedException();
        return this.queryBus.execute(new GetPortalSubmissionsQuery(userId, programId));
    }

    @Get('payments')
    @ApiOperation({ summary: 'Get payment history and outstanding items' })
    @ApiResponse({ status: 200, type: PortalPaymentResponseDto })
    async getPayments(
        @CurrentUser() user: CurrentUserData,
        @Query('programId') programId?: string,
    ): Promise<PortalPaymentResponseDto> {
        const userId = user.userId;
        if (!userId) throw new UnauthorizedException();
        return this.queryBus.execute(new GetPortalPaymentsQuery(userId, programId));
    }

    @Get('payments/:id')
    @ApiOperation({ summary: 'Get payment invoice detail with transaction history' })
    @ApiResponse({ status: 200, type: PortalPaymentDetailResponseDto })
    async getPaymentDetail(
        @Param('id') id: string,
        @CurrentUser() user: CurrentUserData,
    ): Promise<PortalPaymentDetailResponseDto> {
        const userId = user.userId;
        if (!userId) throw new UnauthorizedException();
        return this.queryBus.execute(new GetPortalPaymentDetailQuery(userId, id));
    }

    @Post('payments/:id/confirm')
    @ApiOperation({ summary: 'Submit payment for an invoice (gateway or manual)' })
    @ApiResponse({ status: 200, type: ConfirmPortalPaymentResponseDto })
    async confirmPayment(
        @Param('id') id: string,
        @Body() dto: ConfirmPortalPaymentDto,
        @CurrentUser() user: CurrentUserData,
    ): Promise<ConfirmPortalPaymentResponseDto> {
        const userId = user.userId;
        if (!userId) throw new UnauthorizedException();
        return this.confirmPortalPaymentHandler.execute(
            new ConfirmPortalPaymentCommand(
                userId,
                id,
                dto.payment_type,
                dto.payment_method_id,
                {
                    accountName: dto.account_name,
                    sourceName: dto.source_name,
                    paymentDate: dto.payment_date,
                    notes: dto.notes,
                    gatewayToken: dto.gateway_token,
                },
            ),
        );
    }

    @Get('documents')
    @ApiOperation({ summary: 'Get program resources and my documents' })
    @ApiResponse({ status: 200, type: PortalDocumentResponseDto })
    async getDocuments(@CurrentUser() user: CurrentUserData): Promise<PortalDocumentResponseDto> {
        const userId = user.userId;
        if (!userId) throw new UnauthorizedException();
        return this.queryBus.execute(new GetPortalDocumentsQuery(userId));
    }
}
